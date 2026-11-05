const original={1:["Разговоры о важном","Информатика","Информатика","Алгебра","Алгебра","Физика","Физика"],2:["Англ. язык","Физкультура","Геометрия","Геометрия","Физика","История","Литература","Литература"],3:["Алгебра","Алгебра","Обществознание","ОБЗР","География","Информатика","Информатика"],4:["Рус. язык","Рус. язык","Физика","Физика","История","Обществознание","Литература","Физкультура"],5:["Геометрия","ВиС","Англ. язык","Англ. язык","Биология","Химия"],6:[],0:[]};
const labels=["ВС","ПН","ВТ","СР","ЧТ","ПТ","СБ"];
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
 form.onsubmit=e=>{e.preventDefault();const value=form.elements.subject.value.trim();if(!value)return;data[day][index]=value;lessonMeta[day+"-"+index]={room:form.elements.room.value.trim(),teacher:form.elements.teacher.value.trim(),description:form.elements.description.value.trim()};localStorage.setItem("lx_schedule",JSON.stringify(data));localStorage.setItem("lx_lesson_meta",JSON.stringify(lessonMeta));dialog.close();render();};
 dialog.showModal();
}
function openSettings(){
 const dialog=$("settingsDialog");const breaks=settings.breaks;
 dialog.innerHTML='<form class="editor-form settings-form"><div class="editor-top"><div><div class="editor-kicker">ОБЩИЕ НАСТРОЙКИ</div><h3>Время занятий</h3></div><button type="button" class="icon-close">×</button></div><label>Начало первого урока<input name="start" type="time" required></label><label>Длительность одного урока (мин)<input name="lesson" type="number" min="5" max="120" required></label><div class="break-settings"><div class="break-title">Длительность перемен</div>'+breaks.map((value,index)=>'<label>Перемена '+(index+1)+' (мин)<input name="break'+index+'" type="number" min="0" max="90" required value="'+value+'"></label>').join("")+'</div><p class="settings-note">Новые значения автоматически пересчитают время всех уроков. Настройки сохраняются на этом устройстве.</p><div class="editor-actions"><button type="button" class="cancel-btn">Отмена</button><button type="submit" class="save-btn">Сохранить</button></div></form>';
 const form=dialog.querySelector("form");form.elements.start.value=settings.start;form.elements.lesson.value=settings.lesson;
 dialog.querySelector(".icon-close").onclick=()=>dialog.close();dialog.querySelector(".cancel-btn").onclick=()=>dialog.close();
 form.onsubmit=e=>{e.preventDefault();const lesson=Number(form.elements.lesson.value),start=form.elements.start.value;const breaksNext=breaks.map((_,i)=>Number(form.elements["break"+i].value));if(!start||!Number.isFinite(lesson)||lesson<5||lesson>120||breaksNext.some(n=>!Number.isFinite(n)||n<0||n>90))return;settings.start=start;settings.lesson=lesson;settings.breaks=breaksNext;localStorage.setItem("lx_settings",JSON.stringify(settings));dialog.close();render();tick();};
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
 let state="Учебный день окончен",title="До завтра",target=0,detail="";
 if(!arr.length){state="Сегодня выходной";title="Отдых";}
 else if(current>=0){state="Сейчас идёт урок";title=arr[current];target=toMinutes(bells[current][1]);detail="Урок "+(current+1)+" · до конца "+bells[current][1];}
 else if(next>=0){state=now<toMinutes(bells[0][0])?"До начала первого урока":"Сейчас перемена";title=now<toMinutes(bells[0][0])?arr[0]:"Перемена";target=toMinutes(bells[next][0]);detail="Следующий урок: "+arr[next]+" · начало "+bells[next][0];}
 $("status").textContent=state;$("subject").textContent=title;$("detail").textContent=detail;$("timer").dataset.target=target;
 $("lessons").innerHTML=arr.map((subject,index)=>{const meta=lessonMeta[day+"-"+index]||{};const info=[meta.room?"Кабинет "+meta.room:"Кабинет не указан",meta.teacher,meta.description].filter(Boolean).join(" · ");return '<div class="lesson '+(current===index?"current":"")+'"><span class="num">'+(index+1)+'</span><div class="lesson-info"><div class="name">'+escapeHtml(subject)+'</div><div class="room">'+escapeHtml(info)+'</div></div><span class="time">'+bells[index][0]+'–'+bells[index][1]+'</span><button class="lesson-edit" type="button" data-edit="'+index+'" aria-label="Редактировать урок '+(index+1)+'" title="Редактировать урок">✎</button></div>';}).join("")||'<p class="muted">Выходной день</p>';
 $("lessons").querySelectorAll("[data-edit]").forEach(button=>button.onclick=()=>openLessonEditor(day,Number(button.dataset.edit)));
}
function tick(){
 const d=new Date(),target=Number($("timer").dataset.target||0),now=d.getHours()*60+d.getMinutes()+d.getSeconds()/60;
 const seconds=Math.max(0,Math.floor((target-now)*60));$("timer").textContent=fmt(Math.floor(seconds/3600))+":"+fmt(Math.floor(seconds%3600/60))+":"+fmt(seconds%60);
 if(d.getSeconds()===0)render();
}
$("settings").onclick=openSettings;
render();tick();setInterval(tick,1000);
