const CORS = {
  "Access-Control-Allow-Origin": "https://barusevomsk55-art.github.io",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization"
};
const json = (data, status=200) => new Response(JSON.stringify(data), {status,headers:{...CORS,"Content-Type":"application/json; charset=utf-8"}});
const randomHex = (bytes=32) => [...crypto.getRandomValues(new Uint8Array(bytes))].map(x=>x.toString(16).padStart(2,"0")).join("");
const hash = async value => [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,"0")).join("");
const code = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6,"0");
const readJson = async request => { try { return await request.json(); } catch { return null; } };
async function auth(request, env) {
  const token=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token) return null;
  const digest=await hash(token);
  return await env.DB.prepare("SELECT id FROM users WHERE token_hash=?").bind(digest).first();
}
async function telegram(env, method, body) {
  if(!env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const response=await fetch("https://api.telegram.org/bot"+env.TELEGRAM_BOT_TOKEN+"/"+method,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const result=await response.json();
  if(!result.ok) throw new Error(result.description||"Telegram API error");
  return result;
}
async function handle(request, env) {
  const url=new URL(request.url),path=url.pathname;
  if(request.method==="OPTIONS") return new Response(null,{status:204,headers:CORS});
  if(path==="/health") return json({ok:true,service:"LX SHARAGA API"});
  if(path==="/telegram/webhook" && request.method==="POST") {
    if(env.TELEGRAM_WEBHOOK_SECRET && request.headers.get("X-Telegram-Bot-Api-Secret-Token")!==env.TELEGRAM_WEBHOOK_SECRET) return json({error:"Forbidden"},403);
    const update=await readJson(request),message=update?.message,text=message?.text||"",chatId=message?.chat?.id;
    if(!chatId || !text.startsWith("/start")) return json({ok:true});
    const payload=text.trim().split(/\s+/)[1]||"";
    if(!/^\d{6}$/.test(payload)) {
      await telegram(env,"sendMessage",{chat_id:chatId,text:"Чтобы подключить уведомления, откройте LX ШАРАГА → Настройки → Telegram и получите код подключения."});
      return json({ok:true});
    }
    const pair=await env.DB.prepare("SELECT user_id,purpose FROM pair_codes WHERE code=? AND expires_at>?").bind(payload,Date.now()).first();
    if(!pair || pair.purpose!=="telegram") {
      await telegram(env,"sendMessage",{chat_id:chatId,text:"Код не найден или срок его действия истёк. Создайте новый код в настройках LX ШАРАГА."});
      return json({ok:true});
    }
    await env.DB.prepare("UPDATE users SET telegram_chat_id=?,updated_at=? WHERE id=?").bind(String(chatId),Date.now(),pair.user_id).run();
    await env.DB.prepare("DELETE FROM pair_codes WHERE code=?").bind(payload).run();
    await telegram(env,"sendMessage",{chat_id:chatId,text:"LX ШАРАГА подключена. Уведомления будут приходить по расписанию."});
    return json({ok:true});
  }
  if(path==="/api/sync/create" && request.method==="POST") {
    const token=randomHex(32),id=randomHex(16),now=Date.now();
    await env.DB.prepare("INSERT INTO users(id,token_hash,state_json,timezone,created_at,updated_at) VALUES(?,?,?,?,?,?)").bind(id,await hash(token),JSON.stringify({schedule:null,settings:null}),"UTC",now,now).run();
    return json({userId:id,token});
  }
  if(path==="/api/sync/pair/claim" && request.method==="POST") {
    const body=await readJson(request),value=String(body?.code||"").trim();
    if(!/^\d{6}$/.test(value)) return json({error:"Введите шестизначный код"},400);
    const pair=await env.DB.prepare("SELECT user_id,purpose FROM pair_codes WHERE code=? AND expires_at>?").bind(value,Date.now()).first();
    if(!pair || pair.purpose!=="device") return json({error:"Код недействителен или истёк"},404);
    const user=await env.DB.prepare("SELECT token_hash FROM users WHERE id=?").bind(pair.user_id).first();
    if(!user) return json({error:"Аккаунт не найден"},404);
    // A one-time pairing code exchanges for a new device-specific access token.
    const token=randomHex(32),deviceId=randomHex(12);
    await env.DB.prepare("INSERT INTO devices(id,user_id,token_hash,created_at) VALUES(?,?,?,?)").bind(deviceId,pair.user_id,await hash(token),Date.now()).run();
    await env.DB.prepare("DELETE FROM pair_codes WHERE code=?").bind(value).run();
    return json({userId:pair.user_id,token});
  }
  if(path.startsWith("/api/")) {
    const user=await auth(request,env);
    let account=user;
    if(!account) {
      const token=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
      if(token) { const digest=await hash(token); account=await env.DB.prepare("SELECT user_id AS id FROM devices WHERE token_hash=?").bind(digest).first(); }
    }
    if(!account) return json({error:"Unauthorized"},401);
    if(path==="/api/sync/state" && request.method==="GET") {
      const row=await env.DB.prepare("SELECT state_json,timezone,telegram_chat_id FROM users WHERE id=?").bind(account.id).first();
      return json({state:JSON.parse(row?.state_json||"{}"),timezone:row?.timezone||"UTC",telegramConnected:!!row?.telegram_chat_id});
    }
    if(path==="/api/sync/state" && request.method==="PUT") {
      const body=await readJson(request);
      if(!body || typeof body.state!=="object") return json({error:"Invalid state"},400);
      const state={schedule:body.state.schedule||null,settings:body.state.settings||null,lessonMeta:body.state.lessonMeta||{}};
      const timezone=String(body.timezone||"UTC").slice(0,80);
      await env.DB.prepare("UPDATE users SET state_json=?,timezone=?,updated_at=? WHERE id=?").bind(JSON.stringify(state),timezone,Date.now(),account.id).run();
      return json({ok:true,savedAt:Date.now()});
    }
    if(path==="/api/sync/pair/start" && request.method==="POST") {
      const value=code(),expires=Date.now()+10*60*1000;
      await env.DB.prepare("DELETE FROM pair_codes WHERE user_id=? AND purpose='device'").bind(account.id).run();
      await env.DB.prepare("INSERT INTO pair_codes(code,user_id,purpose,expires_at) VALUES(?,?,?,?)").bind(value,account.id,"device",expires).run();
      return json({code:value,expiresAt:expires});
    }
    if(path==="/api/telegram/setup" && request.method==="POST") {
      if(!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) return json({error:"Telegram secrets are not configured"},500);
      const webhookUrl=new URL("/telegram/webhook",url.origin).toString();
      const result=await telegram(env,"setWebhook",{url:webhookUrl,secret_token:env.TELEGRAM_WEBHOOK_SECRET,allowed_updates:["message"],drop_pending_updates:false});
      return json({ok:true,webhookUrl,result:result.result});
    }
    if(path==="/api/telegram/link" && request.method==="POST") {
      const value=code(),expires=Date.now()+10*60*1000;
      await env.DB.prepare("DELETE FROM pair_codes WHERE user_id=? AND purpose='telegram'").bind(account.id).run();
      await env.DB.prepare("INSERT INTO pair_codes(code,user_id,purpose,expires_at) VALUES(?,?,?,?)").bind(value,account.id,"telegram",expires).run();
      return json({code:value,botUsername:env.TELEGRAM_BOT_USERNAME||null,expiresAt:expires});
    }
    if(path==="/api/telegram/unlink" && request.method==="POST") {
      await env.DB.prepare("UPDATE users SET telegram_chat_id=NULL WHERE id=?").bind(account.id).run();
      return json({ok:true});
    }
    return json({error:"Not found"},404);
  }
  return json({error:"Not found"},404);
}
async function notifyUser(user,env,now) {
  if(!user.telegram_chat_id) return;
  let state;try{state=JSON.parse(user.state_json||"{}");}catch{return;}
  const schedule=state.schedule||{},settings=state.settings||{};
  const tz=user.timezone||"UTC";
  let parts;try{parts=new Intl.DateTimeFormat("en-GB",{timeZone:tz,weekday:"short",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now); }catch{return;}
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  const dayMap={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:0},day=dayMap[p.weekday],minute=Number(p.hour)*60+Number(p.minute),date=p.year+"-"+p.month+"-"+p.day;
  const lessons=schedule[day]||[];if(!lessons.length)return;
  const start=String(settings.start||"08:30").split(":").map(Number);
  const duration=Math.max(5,Math.min(120,Number(settings.lesson)||40));
  const breaks=Array.isArray(settings.breaks)?settings.breaks:[10,15,15,15,15,10,20];
  let cursor=start[0]*60+start[1],events=[];
  lessons.forEach((subject,index)=>{
    const end=cursor+duration;
    if(index===0)events.push({at:cursor-15,key:"first",text:"Через 15 минут первый урок: "+subject+" ("+fmtTime(cursor)+")."});
    events.push({at:end-10,key:"lesson-"+index,text:"Через 10 минут закончится урок "+(index+1)+": "+subject+" ("+fmtTime(end)+")."});
    cursor=end+(Number(breaks[index]??10)||0);
    if(index<lessons.length-1)events.push({at:cursor-5,key:"break-"+index,text:"До конца перемены 5 минут. Следующий урок: "+lessons[index+1]+" ("+fmtTime(cursor)+")."});
  });
  for(const event of events) {
    if(event.at!==minute)continue;
    const eventKey=date+":"+event.key;
    const inserted=await env.DB.prepare("INSERT OR IGNORE INTO notification_logs(user_id,event_key,sent_at) VALUES(?,?,?)").bind(user.id,eventKey,Date.now()).run();
    if(inserted.meta?.changes) {
      try{await telegram(env,"sendMessage",{chat_id:user.telegram_chat_id,text:"LX ШАРАГА\n"+event.text});}
      catch(error){await env.DB.prepare("DELETE FROM notification_logs WHERE user_id=? AND event_key=?").bind(user.id,eventKey).run();}
    }
  }
}
function fmtTime(value){return String(Math.floor(value/60)%24).padStart(2,"0")+":"+String(value%60).padStart(2,"0");}
export default {
  async fetch(request,env) { try{return await handle(request,env);}catch(error){return json({error:"Server error",detail:env.ENVIRONMENT==="development"?String(error):undefined},500);} },
  async scheduled(controller,env,ctx) {
    const users=await env.DB.prepare("SELECT id,state_json,timezone,telegram_chat_id FROM users WHERE telegram_chat_id IS NOT NULL").all();
    const now=new Date();
    ctx.waitUntil(Promise.all((users.results||[]).map(user=>notifyUser(user,env,now))));
  }
};