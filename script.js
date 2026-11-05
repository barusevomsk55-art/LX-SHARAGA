const original={1:["Разговоры о важном","Информатика","Информатика","Алгебра","Алгебра","Физика","Физика"],2:["Англ. язык","Физкультура","Геометрия","Геометрия","Физика","История","Литература","Литература"],3:["Алгебра","Алгебра","Обществознание","ОБЗР","География","Информатика","Информатика"],4:["Рус. язык","Рус. язык","Физика","Физика","История","Обществознание","Литература","Физкультура"],5:["Геометрия","ВиС","Англ. язык","Англ. язык","Биология","Химия"],6:[],0:[]};
const bells=[["08:30","09:10"],["09:20","10:00"],["10:15","10:55"],["11:10","11:50"],["12:05","12:45"],["13:00","13:40"],["13:50","14:30"],["14:50","15:30"]];
const labels=["ВС","ПН","ВТ","СР","ЧТ","ПТ","СБ"];
const data=JSON.parse(localStorage.getItem("lx_schedule")||"null")||JSON.parse(JSON.stringify(original));
const lessonMeta=JSON.parse(localStorage.getItem("lx_lesson_meta")||"{}");
let selected=new Date().getDay();
const $=id=>document.getElementById(id);
const mins=s=>{const [h,m]=s.split(":").map(Number);return h*60+m;};
const fmt=n=>String(n).padStart(2,"0");
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function openLessonEditor(day,index){
 const subject=data[day][index];if(subject===undefined)return;
 const meta=lessonMeta[day+"-"+index]||{};
 let dialog=$("lessonDialog");
 if(!dialog){dialog=document.createElement("dialog");dialog.id="lessonDialog";dialog.className="lesson-dialog";document.body.appendChild(dialog);}
 dialog.innerHTML='<form class="editor-form"><div class="editor-top"><div><div class="editor-kicker">РЕДАКТОР УРОКА</div><h3>Урок '+(index+1)+'</h3></div><button type="button" class="icon-close">×</button></div><label>Предмет<input name="subject" maxlength="70" required></label><label>Кабинет<input name="room" maxlength="30" placeholder="Например, 214"></label><label>Преподаватель<input name="teacher" maxlength="70" placeholder="ФИО преподавателя"></label><label>Описание<textarea name="description" rows="3" maxlength="300"></textarea></label><div class="editor-actions"><button type="button" class="cancel-btn">Отмена</button><button type="submit" class="save-btn">Сохранить</button></div></form>';
 const form=dialog.querySelector("form");
 form.elements.subject.value=subject;form.elements.room.value=meta.room||"";form.elements.teacher.value=meta.teacher||"";form.elements.description.value=meta.description||"";
 dialog.querySelector(".icon-close").onclick=()=>dialog.close();
 dialog.querySelector(".cancel-btn").onclick=()=>dialog.close();
 form.onsubmit=e=>{
  e.preventDefault();const value=form.elements.subject.value.trim();if(!value)return;
  data[day][index]=value;
  lessonMeta[day+"-"+index]={room:form.elements.room.value.trim(),teacher:form.elements.teacher.value.trim(),description:form.elements.description.value.trim()};
  localStorage.setItem("lx_schedule",JSON.stringify(data));localStorage.setItem("lx_lesson_meta",JSON.stringify(lessonMeta));
  dialog.close();render();
 };
 dialog.showModal();
}
function render(){
 const nowDate=new Date(),day=selected,arr=data[day]||[];
 $("today").textContent=nowDate.toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long",year:"numeric"})+" · "+nowDate.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});
 $("days").innerHTML=labels.map((label,index)=>'<button data-day="'+index+'" class="'+(index===selected?"active":"")+'">'+label+'</button>').join("");
 $("days").querySelectorAll("[data-day]").forEach(button=>button.onclick=()=>{selected=Number(button.dataset.day);render();});
 const now=nowDate.getHours()*60+nowDate.getMinutes()+nowDate.getSeconds()/60;
 let current=-1,next=-1;
 arr.forEach((_,index)=>{const start=mins(bells[index][0]),end=mins(bells[index][1]);if(now>=start&&now<end)current=index;if(now<start&&next<0)next=index;});
 let state="Учебный день окончен",title="До завтра",target=0,detail="";
 if(!arr.length){state="Сегодня выходной";title="Отдых";}
 else if(current>=0){state="Сейчас идёт урок";title=arr[current];target=mins(bells[current][1]);detail="Урок "+(current+1)+" · до конца "+bells[current][1];}
 else if(next>=0){state=now<mins(bells[0][0])?"До начала первого урока":"Сейчас перемена";title=now<mins(bells[0][0])?arr[0]:"Перемена";target=mins(bells[next][0]);detail="Следующий урок: "+arr[next]+" · начало "+bells[next][0];}
 $("status").textContent=state;$("subject").textContent=title;$("detail").textContent=detail;$("timer").dataset.target=target;
 $("lessons").innerHTML=arr.map((subject,index)=>{
  const meta=lessonMeta[day+"-"+index]||{};
  const info=[meta.room?"Кабинет "+meta.room:"Кабинет не указан",meta.teacher,meta.description].filter(Boolean).join(" · ");
  return '<div class="lesson '+(current===index?"current":"")+'"><span class="num">'+(index+1)+'</span><div class="lesson-info"><div class="name">'+escapeHtml(subject)+'</div><div class="room">'+escapeHtml(info)+'</div></div><span class="time">'+bells[index][0]+'–'+bells[index][1]+'</span><button class="lesson-edit" type="button" data-edit="'+index+'" aria-label="Редактировать урок '+(index+1)+'" title="Редактировать урок">✎</button></div>';
 }).join("")||'<p class="muted">Выходной день</p>';
 $("lessons").querySelectorAll("[data-edit]").forEach(button=>button.onclick=()=>openLessonEditor(day,Number(button.dataset.edit)));
}
function tick(){
 const d=new Date(),target=Number($("timer").dataset.target||0),now=d.getHours()*60+d.getMinutes()+d.getSeconds()/60;
 const seconds=Math.max(0,Math.floor((target-now)*60));
 $("timer").textContent=fmt(Math.floor(seconds/3600))+":"+fmt(Math.floor(seconds%3600/60))+":"+fmt(seconds%60);
 if(d.getSeconds()===0)render();
}
$("export").onclick=()=>{
 const events=[];
 for(let day=1;day<=5;day++){
  const dt=new Date(2026,10,9+(day-1));
  (data[day]||[]).forEach((subject,index)=>{
   const start=new Date(dt),end=new Date(dt);
   let [h,m]=bells[index][0].split(":").map(Number);start.setHours(h,m,0);
   [h,m]=bells[index][1].split(":").map(Number);end.setHours(h,m,0);
   const stamp=x=>x.getFullYear()+fmt(x.getMonth()+1)+fmt(x.getDate())+"T"+fmt(x.getHours())+fmt(x.getMinutes())+"00";
   events.push("BEGIN:VEVENT\r\nUID:lx-"+day+"-"+index+"@lx-sharaga\r\nDTSTAMP:"+stamp(new Date())+"\r\nDTSTART:"+stamp(start)+"\r\nDTEND:"+stamp(end)+"\r\nSUMMARY:"+subject+"\r\nDESCRIPTION:Урок "+(index+1)+"\r\nEND:VEVENT");
  });
 }
 const blob=new Blob(["BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//LX SHARAGA//RU\r\n"+events.join("\r\n")+"\r\nEND:VCALENDAR"],{type:"text/calendar"});
 const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download="LX-SHARAGA.ics";link.click();URL.revokeObjectURL(link.href);
};
render();tick();setInterval(tick,1000);
