const original={1:["Разговоры о важном","Информатика","Информатика","Алгебра","Алгебра","Физика","Физика"],2:["Англ. язык","Физкультура","Геометрия","Геометрия","Физика","История","Литература","Литература"],3:["Алгебра","Алгебра","Обществознание","ОБЗР","География","Информатика","Информатика"],4:["Рус. язык","Рус. язык","Физика","Физика","История","Обществознание","Литература","Физкультура"],5:["Геометрия","ВиС","Англ. язык","Англ. язык","Биология","Химия"],6:[],0:[]};
const labels=["ВС","ПН","ВТ","СР","ЧТ","ПТ","СБ"];
const API_BASE="https://lx-sharaga-api.barusevomsk55.workers.dev";
const apiToken=()=>localStorage.getItem("lx_api_token")||"";
async function apiRequest(path,options={}){if(API_BASE.includes("YOUR-WORKER"))throw new Error("Сначала нужно развернуть Cloudflare Worker и указать его адрес.");const headers={"Content-Type":"application/json",...(options.headers||{})};if(apiToken())headers.Authorization="Bearer "+apiToken();const response=await fetch(API_BASE+path,{...options,headers});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||"Ошибка API: "+response.status);return body;}
function localState(){return {schedule:data,settings:settings,lessonMeta:lessonMeta};}
async function syncPush(){if(!apiToken())return;await apiRequest("/api/sync/state",{method:"PUT",body:JSON.stringify({state:localState(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"})});}
async function syncPull(){const result=await apiRequest("/api/sync/state");if(result.state?.schedule){Object.keys(data).forEach(k=>delete data[k]);Object.assign(data,result.state.schedule);localStorage.setItem("lx_schedule",JSON.stringify(data));}if(result.state?.settings){Object.assign(settings,result.state.settings);localStorage.setItem("lx_settings",JSON.stringify(settings));}if(result.state?.lessonMeta){Object.keys(lessonMeta).forEach(k=>delete lessonMeta[k]);Object.assign(lessonMeta,result.state.lessonMeta);localStorage.setItem("lx_lesson_meta",JSON.stringify(lessonMeta));}render();tick();return result;}
const defaults={start:"08:30",lesson:40,breaks:[10,15,15,15,15,10,20]};
const settings={...defaults,...JSON.parse(localStorage.getItem("lx_settings")||"{}")};
settings.breaks=Array.isArray(settings.breaks)&&settings.breaks.length===7?settings.breaks:defaults.breaks.slice();
const data=JSON.parse(localStorage.getItem("lx_schedule")||"null")||JSON.parse(JSON.stringify(original));
const lessonMeta=JSON.parse(localStorage.getItem("lx_lesson_meta")||"{}");
let selected=new Date().getDay();
const $=id=>document.getElementById(id);
const fmt=n=>String(n).padStart(2,"0");
const toMinutes=value=>{const [h,m]=value.split(":").map(Number);return h*60+m;};
const timeText=value=>fmt(Math.floor(value/60)%24)+":"+fmt(value%60);
const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function getBells(count){
 const result=[];let start=toMinutes(settings.start);
 for(let i=0;i<count;i++){const end=start+Number(settings.lesson);result.push([timeText(start),timeText(end)]);start=end+Number(settings.breaks[i]??10);}
 return result;
}
function openLessonEditor(day,index){
 const subject=data[day][index];if(subject===undefined)return;
 const meta=lessonMeta[day+"-"+index]||{};const dialog=$("lessonDialog");
 dialog.innerHTML='<form class="editor-form"><div class="editor-top"><div><div class="editor-kicker">РЕДАКТОР УРОКА</div><h3>Урок '+(index+1)+'</h3></div><button type="button" class="icon-close">×</button></div><label>Предмет<input name="subject" maxlength="70" required></label><label>Кабинет<input name="room" maxlength="30" placeholder="Например, 214"></label><label>Преподаватель<input name="teacher" maxlength="70" placeholder="ФИО преподавателя"></label><label>Описание<textarea name="description" rows="3" maxlength="300"></textarea></label><div class="editor-actions"><button type="button" class="cancel-btn">Отмена</button><button type="submit" class="save-btn">Сохранить</button></div></form>';
 const form=dialog.querySelector("form");
 form.elements.subject.value=subject;form.elements.room.value=meta.room||"";form.elements.teacher.value=meta.teacher||"";form.elements.description.value=meta.description||"";
 dialog.querySelector(".icon-close").onclick=()=>dialog.close();dialog.querySelector(".cancel-btn").onclick=()=>dialog.close();
 form.onsubmit=e=>{e.preventDefault();const value=form.elements.subject.value.trim();if(!value)return;data[day][index]=value;lessonMeta[day+"-"+index]={room:form.elements.room.value.trim(),teacher:form.elements.teacher.value.trim(),description:form.elements.description.value.trim()};localStorage.setItem("lx_schedule",JSON.stringify(data));localStorage.setItem("lx_lesson_meta",JSON.stringify(lessonMeta));dialog.close();render();syncPush().catch(()=>{});};
 dialog.showModal();
}
function openSettings(){
 const dialog=$("settingsDialog"),breaks=settings.breaks,token=apiToken();
 dialog.innerHTML='<form class="editor-form settings-form"><div class="editor-top"><div><div class="editor-kicker">ОБЩИЕ НАСТРОЙКИ</div><h3>Время занятий</h3></div><button type="button" class="icon-close">×</button></div><label>Начало первого урока<input name="start" type="time" required></label><label>Длительность одного урока (мин)<input name="lesson" type="number" min="5" max="120" required></label><div class="break-settings"><div class="break-title">Длительность перемен</div>'+breaks.map((v,i)=>'<label>Перемена '+(i+1)+' (мин)<input name="break'+i+'" type="number" min="0" max="90" required value="'+v+'"></label>').join("")+'</div><div class="settings-divider"></div><div class="break-title">Синхронизация и Telegram</div><p class="settings-note" id="cloudStatus">'+(token?'Облачный аккаунт подключён на этом устройстве.':'Создай облачный аккаунт, чтобы переносить расписание на другие устройства.')+'</p><div class="cloud-actions"><button type="button" id="syncCreate">'+(token?'Синхронизировать сейчас':'Включить синхронизацию')+'</button><button type="button" id="pairStart">Создать код для другого устройства</button></div><div class="pair-row"><input id="pairCode" inputmode="numeric" maxlength="6" placeholder="Код с другого устройства"><button type="button" id="pairClaim">Подключить</button></div><p class="settings-note" id="pairInfo"></p><div class="cloud-actions"><button type="button" id="telegramConnect">Подключить Telegram</button><button type="button" id="telegramDisconnect">Отключить Telegram</button></div><div id="telegramInfo" class="settings-note"></div><div class="editor-actions"><button type="button" class="cancel-btn">Закрыть</button><button type="submit" class="save-btn">Сохранить время</button></div></form>';
 const form=dialog.querySelector("form");form.elements.start.value=settings.start;form.elements.lesson.value=settings.lesson;
 dialog.querySelector(".icon-close").onclick=()=>dialog.close();dialog.querySelector(".cancel-btn").onclick=()=>dialog.close();
 form.onsubmit=e=>{e.preventDefault();const lesson=Number(form.elements.lesson.value),start=form.elements.start.value,breaksNext=breaks.map((_,i)=>Number(form.elements["break"+i].value));if(!start||!Number.isFinite(lesson)||lesson<5||lesson>120||breaksNext.some(n=>!Number.isFinite(n)||n<0||n>90))return;settings.start=start;settings.lesson=lesson;settings.breaks=breaksNext;localStorage.setItem("lx_settings",JSON.stringify(settings));dialog.close();render();tick();syncPush().catch(()=>{});};
 const status=dialog.querySelector("#cloudStatus");
 dialog.querySelector("#syncCreate").onclick=async()=>{try{if(!apiToken()){const created=await apiRequest("/api/sync/create",{method:"POST",body:"{}"});localStorage.setItem("lx_api_token",created.token);localStorage.setItem("lx_user_id",created.userId);}await syncPush();status.textContent="Синхронизация включена. Расписание сохранено в облаке.";}catch(error){status.textContent=error.message;}};
 dialog.querySelector("#pairStart").onclick=async()=>{try{if(!apiToken())throw new Error("Сначала включи синхронизацию на этом устройстве.");const result=await apiRequest("/api/sync/pair/start",{method:"POST",body:"{}"});dialog.querySelector("#pairInfo").textContent="Код для второго устройства: "+result.code+" (действует 10 минут).";}catch(error){dialog.querySelector("#pairInfo").textContent=error.message;}};
 dialog.querySelector("#pairClaim").onclick=async()=>{try{const value=dialog.querySelector("#pairCode").value.trim();const result=await apiRequest("/api/sync/pair/claim",{method:"POST",body:JSON.stringify({code:value})});localStorage.setItem("lx_api_token",result.token);localStorage.setItem("lx_user_id",result.userId);await syncPull();status.textContent="Это устройство подключено. Данные загружены.";}catch(error){dialog.querySelector("#pairInfo").textContent=error.message;}};
 dialog.querySelector("#telegramConnect").onclick=async()=>{try{if(!apiToken())throw new Error("Сначала включи синхронизацию.");await apiRequest("/api/telegram/setup",{method:"POST",body:"{}"});const result=await apiRequest("/api/telegram/link",{method:"POST",body:"{}"});const info=dialog.querySelector("#telegramInfo");if(result.botUsername&&!result.botUsername.includes("PUT_YOUR")){info.innerHTML='Код: <b>'+result.code+'</b> · действует 10 минут<br><a target="_blank" rel="noopener" href="https://t.me/'+encodeURIComponent(result.botUsername)+'?start='+result.code+'">Открыть Telegram-бота и подключить</a>';}else{info.textContent="Код подключения: "+result.code+". Настрой имя бота в Cloudflare, затем отправь боту /start "+result.code;}}catch(error){dialog.querySelector("#telegramInfo").textContent=error.message;}};
 dialog.querySelector("#telegramDisconnect").onclick=async()=>{try{await apiRequest("/api/telegram/unlink",{method:"POST",body:"{}"});dialog.querySelector("#telegramInfo").textContent="Telegram отключён.";}catch(error){dialog.querySelector("#telegramInfo").textContent=error.message;}};
 dialog.showModal();
}
function render(){
 const nowDate=new Date(),day=selected,arr=data[day]||[],bells=getBells(arr.length);
 $("today").textContent=nowDate.toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long",year:"numeric"})+" · "+nowDate.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});
 $("days").innerHTML=labels.map((label,index)=>'<button data-day="'+index+'" class="'+(index===selected?"active":"")+'">'+label+'</button>').join("");
 $("days").querySelectorAll("[data-day]").forEach(button=>button.onclick=()=>{selected=Number(button.dataset.day);render();});
 const now=nowDate.getHours()*60+nowDate.getMinutes()+nowDate.getSeconds()/60;
 let current=-1,next=-1;
 arr.forEach((_,index)=>{const start=toMinutes(bells[index][0]),end=toMinutes(bells[index][1]);if(now>=start&&now<end)current=index;if(now<start&&next<0)next=index;});
 let state="Учебный день окончен",title="До завтра",targetAt=null,detail="";
 const midnight=new Date(nowDate);midnight.setHours(0,0,0,0);
 if(!arr.length){state="Сегодня выходной";title="Отдых";}
 else if(current>=0){state="Сейчас идёт урок";title=arr[current];const [h,m]=bells[current][1].split(":").map(Number);targetAt=new Date(midnight);targetAt.setHours(h,m,0,0);detail="Урок "+(current+1)+" · до конца "+bells[current][1];}
 else if(next>=0){state=now<toMinutes(bells[0][0])?"До начала первого урока":"Сейчас перемена";title=now<toMinutes(bells[0][0])?arr[0]:"Перемена";const [h,m]=bells[next][0].split(":").map(Number);targetAt=new Date(midnight);targetAt.setHours(h,m,0,0);detail="Следующий урок: "+arr[next]+" · начало "+bells[next][0];}
 else {
  let nextDay=(nowDate.getDay()+1)%7;
  for(let i=0;i<7&&!(data[nextDay]||[]).length;i++)nextDay=(nextDay+1)%7;
  const nextLessons=data[nextDay]||[],nextBells=getBells(nextLessons.length),[h,m]=nextBells[0][0].split(":").map(Number);
  targetAt=new Date(midnight);do{targetAt.setDate(targetAt.getDate()+1);}while(targetAt.getDay()!==nextDay);targetAt.setHours(h,m,0,0);
  detail="Следующий учебный день: "+labels[nextDay];
 }
 if(!targetAt&&!arr.length){
  let nextDay=(nowDate.getDay()+1)%7;
  for(let i=0;i<7&&!(data[nextDay]||[]).length;i++)nextDay=(nextDay+1)%7;
  const nextBells=getBells((data[nextDay]||[]).length),[h,m]=nextBells[0][0].split(":").map(Number);
  targetAt=new Date(midnight);do{targetAt.setDate(targetAt.getDate()+1);}while(targetAt.getDay()!==nextDay);targetAt.setHours(h,m,0,0);
  detail="Следующий учебный день: "+labels[nextDay];
 }
 $("status").textContent=state;$("subject").textContent=title;$("detail").textContent=detail;$("timer").dataset.target=targetAt?String(targetAt.getTime()):"";
 $("lessons").innerHTML=arr.map((subject,index)=>{const meta=lessonMeta[day+"-"+index]||{};const info=[meta.room?"Кабинет "+meta.room:"Кабинет не указан",meta.teacher,meta.description].filter(Boolean).join(" · ");return '<div class="lesson '+(current===index?"current":"")+'"><span class="num">'+(index+1)+'</span><div class="lesson-info"><div class="name">'+escapeHtml(subject)+'</div><div class="room">'+escapeHtml(info)+'</div></div><span class="time">'+bells[index][0]+'–'+bells[index][1]+'</span><button class="lesson-edit" type="button" data-edit="'+index+'" aria-label="Редактировать урок '+(index+1)+'" title="Редактировать урок">✎</button></div>';}).join("")||'<p class="muted">Выходной день</p>';
 $("lessons").querySelectorAll("[data-edit]").forEach(button=>button.onclick=()=>openLessonEditor(day,Number(button.dataset.edit)));
}
function tick(){
 const target=Number($("timer").dataset.target||0);
 const seconds=target?Math.max(0,Math.floor((target-Date.now())/1000)):0;
 $("timer").textContent=fmt(Math.floor(seconds/3600))+":"+fmt(Math.floor(seconds%3600/60))+":"+fmt(seconds%60);
 const d=new Date();if(d.getSeconds()===0)render();

}
$("settings").onclick=openSettings;
render();tick();if(apiToken())syncPull().catch(()=>{});setInterval(tick,1000);
