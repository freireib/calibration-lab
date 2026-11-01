/* Calibration Lab v0.2: unlimited daily practice; ten judgments qualify a streak. */
'use strict';
const KEY='calibration-lab-data-v1';
const DAILY_GOAL=10;
const BATCH_SIZE=10;
const $=(selector)=>document.querySelector(selector);
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const round=(v,d=2)=>Number(v).toFixed(d);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function dateKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function freshState(){return {version:1,days:{},questionQueue:[],seen:[]};}
function load(){try{const v=JSON.parse(localStorage.getItem(KEY));if(v&&v.version===1&&v.days&&typeof v.days==='object'&&Array.isArray(v.seen)&&Array.isArray(v.questionQueue))return v;}catch(e){console.warn('Could not load local history',e);}return freshState();}
let state=load(),selected=null,confidence=75,starting=false,apiError=false;
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch(e){alert('Unable to save local data. Storage may be full or unavailable. Export your history now.');return false;}}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),16777619);}return (h>>>0).toString(36);}
function qObj(prompt,answer,category='Mixed',source='Offline practice',difficulty=''){return {id:hash(prompt.toLowerCase().replace(/\s+/g,' ').trim()),type:'boolean',prompt,answer,category,source,difficulty};}
const offlineRaw=[
 ['Venus takes longer to rotate once on its axis than to orbit the Sun.',true,'Astronomy'],
 ['The planet Mercury has no natural moons.',true,'Astronomy'],
 ['Pluto is larger in diameter than Earth’s Moon.',false,'Astronomy'],
 ['Jupiter is the largest planet in the Solar System.',true,'Astronomy'],
 ['A total solar eclipse occurs when the Moon passes between Earth and the Sun.',true,'Astronomy'],
 ['Uranus takes approximately 84 Earth years to orbit the Sun.',true,'Astronomy'],
 ['Venus is the hottest planet in the Solar System.',true,'Astronomy'],
 ['The Milky Way is a spiral galaxy.',true,'Astronomy'],
 ['The Earth’s atmosphere is mostly oxygen.',false,'Science'],
 ['Water at normal atmospheric pressure reaches its maximum density at approximately 4°C.',true,'Science'],
 ['Sound travels through a vacuum.',false,'Science'],
 ['Sound travels faster in air than in liquid water under ordinary conditions.',false,'Science'],
 ['The chemical symbol for gold is Ag.',false,'Chemistry'],
 ['Carbon has atomic number six.',true,'Chemistry'],
 ['The chemical symbol for iron is Fe.',true,'Chemistry'],
 ['Most ice floats on liquid water because ice is less dense.',true,'Science'],
 ['Photosynthesis in plants produces oxygen from water molecules.',true,'Biology'],
 ['An adult human skeleton typically has 206 bones.',true,'Biology'],
 ['Sharks are mammals.',false,'Biology'],
 ['An octopus has three hearts.',true,'Biology'],
 ['RNA normally uses thymine instead of uracil as one of its four bases.',false,'Biology'],
 ['The capital of Australia is Sydney.',false,'Geography'],
 ['The Pacific Ocean is the largest ocean on Earth.',true,'Geography'],
 ['Mount Kilimanjaro is located in Kenya.',false,'Geography'],
 ['Lake Baikal is the deepest freshwater lake on Earth.',true,'Geography'],
 ['Antarctica is classified as a desert.',true,'Geography'],
 ['The geographic North Pole is on a continent.',false,'Geography'],
 ['Greenland is the largest island in the world that is not a continent.',true,'Geography'],
 ['The number 2 is the only even prime number.',true,'Mathematics'],
 ['The square root of 2 is rational.',false,'Mathematics'],
 ['Zero factorial equals one.',true,'Mathematics'],
 ['In Euclidean geometry the angles of any triangle sum to 180 degrees.',true,'Mathematics'],
 ['The year 1900 was a leap year in the Gregorian calendar.',false,'History'],
 ['The Magna Carta was issued in 1215.',true,'History'],
 ['Johann Sebastian Bach was born before Wolfgang Amadeus Mozart.',true,'History'],
 ['The Wikipedia website launched in 2001.',true,'History'],
 ['The Great Wall of China is clearly visible from the Moon with the unaided eye.',false,'Geography'],
 ['Spanish and Portuguese are both Romance languages.',true,'Language'],
 ['Half of one-third equals one-sixth.',true,'Mathematics'],
 ['One astronomical unit is defined as exactly 149,597,870,700 metres.',true,'Astronomy']
];
const offlineBank=offlineRaw.map(row=>qObj(row[0],row[1],row[2]));
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function decodeURIComponentSafe(s){try{return decodeURIComponent(s);}catch{return s;}}
async function loadQuestions(){
 const seen=new Set([...state.seen,...state.questionQueue.map(q=>q.id)]);
 if(state.questionQueue.length>=BATCH_SIZE)return;
 try{
  const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),9000);
  let r;try{r=await fetch('https://opentdb.com/api.php?amount=30&type=boolean&encode=url3986',{signal:ctl.signal,cache:'no-store'});}finally{clearTimeout(timer);}
  if(!r.ok)throw Error('HTTP '+r.status);
  const data=await r.json();if(data.response_code!==0||!Array.isArray(data.results))throw Error('Trivia API: '+data.response_code);
  for(const item of data.results){if(item.type!=='boolean')continue;
   const prompt=decodeURIComponentSafe(item.question),answer=decodeURIComponentSafe(item.correct_answer)==='True';
   const q=qObj(prompt,answer,decodeURIComponentSafe(item.category),'Open Trivia DB',decodeURIComponentSafe(item.difficulty||''));
   if(!seen.has(q.id)){state.questionQueue.push(q);seen.add(q.id);}
  }
 }catch(e){console.info('Trivia unavailable; use offline questions.',e);apiError=true;}
 if(state.questionQueue.length<BATCH_SIZE){for(const q of shuffle([...offlineBank])){if(!seen.has(q.id)){state.questionQueue.push(q);seen.add(q.id);}}}
 save();
}
async function startToday(){
 if(starting)return;
 if(state.days[dateKey()]){render();return;}
 starting=true;
 const target=$('#practice-content');target.replaceChildren();
 const box=el('div','panel');box.append(el('p','muted','Preparing today’s questions…'));target.append(box);
 try{
  await loadQuestions();
  if(state.questionQueue.length===0){
   target.replaceChildren();const error=el('div','panel');
   error.append(el('h2','','No new questions available'),el('p','muted','Connect to the internet and try again. Your previous answers are safe.'));
   error.append(makeButton('Try again','primary',startToday));target.append(error);return;
  }
  const today=dateKey();
  const batch=state.questionQueue.splice(0,BATCH_SIZE);
  state.days[today]={date:today,questions:batch,responses:[],cursor:0,createdAt:new Date().toISOString()};
  for(const q of batch)state.seen.push(q.id);
  if(!save()){delete state.days[today];state.questionQueue.unshift(...batch);state.seen.splice(-batch.length);return;}
  selected=null;confidence=75;render();
 }finally{starting=false;}
}
async function loadMoreToday(){
 if(starting)return;
 const day=state.days[dateKey()];
 if(!day||day.cursor<day.questions.length)return;
 starting=true;
 const node=$('#practice-content');const button=node.querySelector('[data-more]');
 if(button){button.disabled=true;button.textContent='Loading questions…';}
 try{
  await loadQuestions();
  if(state.questionQueue.length===0){
   render();const box=$('#practice-content .panel');
   if(box)box.append(el('p','sm muted','No unused questions available right now. Connect to the internet and try again later.'));
   return;
  }
  const batch=state.questionQueue.splice(0,BATCH_SIZE);
  day.questions.push(...batch);
  state.seen.push(...batch.map(q=>q.id));
  if(!save()){
   day.questions.splice(-batch.length);state.seen.splice(-batch.length);state.questionQueue.unshift(...batch);return;
  }
  selected=null;confidence=75;render();
 }finally{starting=false;}
}
function completed(day){return (day?.responses?.length||0)>=DAILY_GOAL;}
function dayStats(day){const valid=day.responses.filter(r=>!r.flagged);const brier=valid.length?valid.reduce((s,r)=>s+r.brier,0)/valid.length:null;return {valid:valid.length,correct:valid.filter(r=>r.correct).length,brier};}
function getResponses(){const rows=[];for(const day of Object.values(state.days)){day.responses.forEach((r,i)=>rows.push({...r,date:day.date,question:day.questions[i]?.prompt||'',category:day.questions[i]?.category||'',source:day.questions[i]?.source||'',difficulty:day.questions[i]?.difficulty||'',id:day.questions[i]?.id||''}));}return rows.sort((a,b)=>b.timestamp.localeCompare(a.timestamp));}
function streak(){let d=new Date();let k=dateKey(d);if(!completed(state.days[k])){d.setDate(d.getDate()-1);k=dateKey(d);}let count=0;while(completed(state.days[k])){count++;d.setDate(d.getDate()-1);k=dateKey(d);}return count;}
function makeButton(label,cls,onClick){const b=el('button',cls,label);b.type='button';b.addEventListener('click',onClick);return b;}
function renderPractice(){
 const node=$('#practice-content');node.replaceChildren();const day=state.days[dateKey()];
 if(!day){
  const box=el('div','panel');
  box.append(el('p','micro','Ten answers maintain your streak'),el('h2','','Estimate, commit, learn.'),
   el('p','muted','Pick True or False, then estimate the chance your answer is correct. Keep practicing as long as you like.'));
  box.append(el('p','sm muted','10-question daily goal · unlimited extras · 50–100% confidence'));
  box.append(makeButton('Start today’s practice','primary',startToday));node.append(box);return;
 }
 const answered=day.responses.length;
 if(day.cursor>=day.questions.length){
  const stats=dayStats(day),met=completed(day),box=el('div','panel');
  box.append(el('p','micro',met?'Daily streak goal met':'Daily practice paused'),
   el('h2','',met?`${answered} judgments recorded today.`:`${answered} of ${DAILY_GOAL} completed.`));
  const progress=el('div','progress');const fill=el('div');fill.style.width=`${100*Math.min(answered,DAILY_GOAL)/DAILY_GOAL}%`;progress.append(fill);box.append(progress);
  const cards=el('div','stats');
  for(const [value,label] of [[`${answered}/${DAILY_GOAL}`,answered>=DAILY_GOAL?'Daily goal reached':'Toward daily goal'],
   [`${stats.correct}/${stats.valid}`,'Correct (unflagged)'],[stats.brier===null?'—':round(stats.brier,3),'Mean Brier loss']]){
   const card=el('div','stat');card.append(el('div','value mono',value),el('div','caption',label));cards.append(card);
  }
  box.append(cards);
  box.append(el('p','sm muted',met?'Your streak is secured for today. Every extra answer still counts toward your calibration statistics.':'Answer at least ten questions today to earn your streak.'));
  const more=makeButton(met?'Keep practicing — more questions':'Continue toward 10 questions','primary',loadMoreToday);
  more.dataset.more='true';box.append(more);
  box.append(makeButton('View calibration insights','secondary-btn',()=>setView('insights')));
  node.append(box);return;
 }
 const idx=day.cursor,q=day.questions[idx],response=day.responses[idx];
 const card=el('div','panel'),top=el('div','row between');
 top.append(el('span','micro',`QUESTION ${idx+1} TODAY`),el('span','chip',q.category||'Mixed'));card.append(top);
 const progress=el('div','progress');const fill=el('div');fill.style.width=`${100*Math.min(answered,DAILY_GOAL)/DAILY_GOAL}%`;progress.append(fill);card.append(progress);
 card.append(el('p','sm muted',answered>=DAILY_GOAL?`Daily goal met · ${answered} answered today`:`${answered} of ${DAILY_GOAL} completed toward your streak`));
 card.append(el('div','question',q.prompt));
 if(response){
  const fb=el('div',`feedback ${response.correct?'':'wrong'}`);fb.append(el('strong','',response.correct?'Correct.':'Not this time.'));
  fb.append(el('p','sm',`Answer: ${q.answer?'True':'False'}. You chose ${response.chosen?'True':'False'} with ${response.confidence}% confidence.`));
  fb.append(el('p','sm',`Brier loss: ${round(response.brier,3)} (lower is better).`));card.append(fb);
  const flagLine=el('div','row between');flagLine.style.marginTop='16px';
  flagLine.append(el('span','sm muted',response.flagged?'Excluded from calibration statistics':'Question ambiguous or incorrect?'));
  flagLine.append(makeButton(response.flagged?'Undo flag':'Flag question','secondary-btn',()=>{response.flagged=!response.flagged;save();render();}));card.append(flagLine);
  const last=idx===day.questions.length-1;
  card.append(makeButton(last?(completed(day)?'See today’s progress':'Continue today’s practice'):'Next question','primary',()=>{
   day.cursor=idx+1;selected=null;confidence=75;save();render();
  }));
 }else{
  const choices=el('div','choice-row');
  for(const [val,label] of [[true,'True'],[false,'False']]){
   const b=makeButton(label,`choice ${selected===val?'selected':''}`,()=>{selected=val;renderPractice();});
   b.setAttribute('aria-pressed',String(selected===val));choices.append(b);
  }card.append(choices);
  const head=el('div','confidence-head');head.append(el('span','','How confident are you?'),el('span','confidence-number mono',`${confidence}%`));card.append(head);
  const slider=el('input');slider.type='range';slider.min='50';slider.max='100';slider.step='5';slider.value=String(confidence);
  slider.setAttribute('aria-label','Confidence your selected answer is correct');
  slider.addEventListener('input',()=>{confidence=Number(slider.value);head.lastChild.textContent=`${confidence}%`;});card.append(slider);
  const range=el('div','range-labels');range.append(el('span','','50% · coin flip'),el('span','','100% · certain'));card.append(range);
  card.append(el('p','sm muted','Give the probability your chosen answer is correct, before revealing the answer.'));
  const submit=makeButton('Lock in answer','primary',()=>{
   if(selected===null)return;const conf=confidence/100;const correct=selected===q.answer;
   const pTrue=selected?conf:(1-conf);
   const record={kind:'boolean',chosen:selected,confidence,probTrue:pTrue,correct,flagged:false,brier:(pTrue-Number(q.answer))**2,timestamp:new Date().toISOString()};
   day.responses.push(record);if(!save()){day.responses.pop();return;}render();
  });submit.disabled=selected===null;card.append(submit);
 }
 node.append(card);
}
function svg(tag,attrs={},text){const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;return n;}
function makeCalibrationSvg(rows){const s=svg('svg',{viewBox:'0 0 390 280',role:'img','aria-label':'Reliability plot: observed accuracy versus stated confidence'});
 const L=44,R=364,B=232,T=18;const xp=p=>L+(p-0.5)/0.5*(R-L),yp=p=>B-p*(B-T);
 for(let k=0;k<=10;k+=2){const p=k/10;s.append(svg('line',{x1:L,y1:yp(p),x2:R,y2:yp(p),stroke:'#e4eaea','stroke-width':1}),svg('text',{x:L-8,y:yp(p)+4,'text-anchor':'end',class:'chart-tick'},`${k*10}%`));}
 for(const p of [0.5,0.6,0.7,0.8,0.9,1]){s.append(svg('text',{x:xp(p),y:251,'text-anchor':'middle',class:'chart-tick'},`${round(p*100,0)}%`));}
 s.append(svg('line',{x1:xp(.5),y1:yp(.5),x2:xp(1),y2:yp(1),stroke:'#b0c2c0','stroke-width':2,'stroke-dasharray':'6 5'}));
 const bins=[[],[],[],[],[]];rows.forEach(r=>bins[Math.min(4,Math.floor((r.confidence-50)/10))].push(r));
 bins.forEach((b,i)=>{if(!b.length)return;const x=b.reduce((s,r)=>s+r.confidence/100,0)/b.length;const y=b.filter(r=>r.correct).length/b.length;
 const rad=Math.min(12,4+Math.sqrt(b.length)*1.2);s.append(svg('circle',{cx:xp(x),cy:yp(y),r:rad,fill:'#147966',opacity:'.85'}));s.append(svg('text',{x:xp(x),y:yp(y)-rad-5,'text-anchor':'middle',class:'chart-tick'},`n=${b.length}`));
 });s.append(svg('text',{x:(L+R)/2,y:272,'text-anchor':'middle',class:'chart-label'},'Your stated confidence'));
 s.append(svg('text',{x:14,y:(B+T)/2,transform:`rotate(-90 14 ${(B+T)/2})`,'text-anchor':'middle',class:'chart-label'},'Actual accuracy'));
 return s;}
function makeTrendSvg(days){const s=svg('svg',{viewBox:'0 0 390 205',role:'img','aria-label':'Mean Brier loss per completed day'});
 const L=48,R=366,T=18,B=163,yp=v=>B-clamp(v,0,1)*(B-T);
 for(const v of [0,.25,.5,.75,1]){s.append(svg('line',{x1:L,x2:R,y1:yp(v),y2:yp(v),stroke:'#e5ebeb'}),svg('text',{x:L-6,y:yp(v)+3,'text-anchor':'end',class:'chart-tick'},round(v,2)));}
 const x=i=>days.length===1?(L+R)/2:L+i/(days.length-1)*(R-L);
 if(days.length>1){s.append(svg('polyline',{points:days.map((d,i)=>`${x(i)},${yp(d.brier)}`).join(' '),fill:'none',stroke:'#147966','stroke-width':2.5,'stroke-linejoin':'round'}));}
 days.forEach((d,i)=>{s.append(svg('circle',{cx:x(i),cy:yp(d.brier),r:4.3,fill:'#147966'}));});
 if(days.length){s.append(svg('text',{x:L,y:186,class:'chart-tick'},days[0].date.slice(5)));s.append(svg('text',{x:R,y:186,'text-anchor':'end',class:'chart-tick'},days[days.length-1].date.slice(5)));}
 s.append(svg('text',{x:(L+R)/2,y:200,'text-anchor':'middle',class:'chart-label'},'Session date (lower Brier is better)'));return s;
}
function renderInsights(){const node=$('#insights-content');node.replaceChildren();const rows=getResponses().filter(r=>!r.flagged);if(!rows.length){node.append(el('div','empty','No scored answers yet. Complete your first set of questions to see calibration data.'));return;}
 const brier=rows.reduce((s,r)=>s+r.brier,0)/rows.length;const correct=rows.filter(r=>r.correct).length;const panel=el('div','panel');const grid=el('div','stats');for(const [val,label] of [[rows.length,'Scored judgments'],[`${round(100*correct/rows.length,1)}%`,'Accuracy'],[round(brier,3),'Mean Brier loss']]){const c=el('div','stat');c.append(el('div','value mono',val),el('div','caption',label));grid.append(c);}panel.append(grid,el('p','message',rows.length<50?'Early data: calibration estimates will be noisy until you accumulate at least several dozen questions.':'Compare calibration bins cautiously; bin-specific sample sizes can still be small.'));node.append(panel);
 const a=el('div','panel chart');a.append(el('h3','','Calibration by confidence'));a.append(makeCalibrationSvg(rows));a.append(el('p','legend','Dashed diagonal = perfect calibration. Dots = observed accuracy within 10-point confidence bins; dot size reflects sample count.'));node.append(a);
 const completedDays=Object.values(state.days).filter(d=>completed(d)).sort((a,b)=>a.date.localeCompare(b.date)).map(d=>({date:d.date,...dayStats(d)})).filter(x=>x.brier!==null).slice(-30);
 const b=el('div','panel chart');b.append(el('h3','','Daily Brier history'));b.append(makeTrendSvg(completedDays));b.append(el('p','legend','Each point summarizes all unflagged answers on a day with at least ten completed questions. Daily sample sizes may differ; look for trends across many days.'));node.append(b);
}
function download(filename,contents,type){const blob=new Blob([contents],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function exportJson(){download(`calibration-lab-${dateKey()}.json`,JSON.stringify({exportedAt:new Date().toISOString(),...state},null,2),'application/json');}
function csvEscape(s){const v=String(s??'');return `"${v.replaceAll('"','""')}"`;}
function exportCsv(){const cols=['date','timestamp','id','kind','question','category','source','difficulty','correct_answer','chosen_answer','confidence_percent','p_true','correct','brier','flagged'];const rows=getResponses().map(r=>[r.date,r.timestamp,r.id,r.kind,r.question,r.category,r.source,r.difficulty,r.correct?r.chosen:!r.chosen,r.chosen,r.confidence,r.probTrue,r.correct,r.brier,r.flagged]);
 const csv=[cols.join(','),...rows.map(row=>row.map(csvEscape).join(','))].join('\r\n');download(`calibration-lab-${dateKey()}.csv`,csv,'text/csv;charset=utf-8');}
function importJson(file){const reader=new FileReader();reader.onload=()=>{try{const v=JSON.parse(String(reader.result));if(v.version!==1||!v.days||typeof v.days!=='object'||Array.isArray(v.days)||!Array.isArray(v.seen)||!Array.isArray(v.questionQueue))throw Error('Not a Calibration Lab v1 backup.');
 for(const day of Object.values(v.days)){if(!Array.isArray(day.questions)||!Array.isArray(day.responses)||!Number.isInteger(day.cursor))throw Error('Invalid day record.');}
 if(!confirm('Replace all data on this device with the imported backup? Export your current history first if you want to preserve it.'))return;
 const current=state;state={version:1,days:v.days,questionQueue:v.questionQueue,seen:v.seen};if(!save()){state=current;return;}selected=null;confidence=75;render();alert('History restored.');
 }catch(e){alert('Could not restore backup: '+e.message);}};reader.readAsText(file);}
function renderData(){const node=$('#data-content');node.replaceChildren();const box=el('div','panel');box.append(el('h3','','Backup and restore'),el('p','sm muted','History is stored in this browser/app on this device—not in GitHub or an account. Export JSON backups regularly; use CSV for analysis in Python.'));
 const buttons=el('div','button-row');buttons.append(makeButton('Export JSON backup','secondary-btn',exportJson),makeButton('Export CSV','secondary-btn',exportCsv));
 const fileInput=el('input');fileInput.type='file';fileInput.accept='.json,application/json';fileInput.addEventListener('change',()=>{if(fileInput.files?.[0])importJson(fileInput.files[0]);fileInput.value='';});
 buttons.append(makeButton('Restore JSON','secondary-btn',()=>fileInput.click()));box.append(buttons,fileInput);node.append(box);
 const rows=getResponses();const hist=el('div','panel');hist.append(el('h3','',`Recent answers (${rows.length} recorded)`));if(!rows.length)hist.append(el('p','muted','No answers yet.'));else{
 rows.slice(0,25).forEach(r=>{const item=el('div','history-row');const top=el('div','row between');top.append(el('span','tiny muted',`${r.date} · ${r.category||'Mixed'}`),el('span',`chip ${r.flagged?'':r.correct?'good':'bad'}`,r.flagged?'Excluded':r.correct?'Correct':'Incorrect'));item.append(top);item.append(el('div','',r.question));item.append(el('div','tiny muted',`${r.chosen?'True':'False'} · ${r.confidence}% confident · Brier ${round(r.brier,3)}${r.flagged?' · flagged':''}`));hist.append(item);});
 }node.append(hist);const alertBox=el('div','alert','Local browser storage is not a permanent backup. Export a JSON copy before clearing Safari website data, deleting the Home Screen app, or switching devices.');node.append(alertBox);
}
function setView(view){for(const b of document.querySelectorAll('.tab')){const on=b.dataset.view===view;b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}for(const s of document.querySelectorAll('.view'))s.classList.toggle('active',s.id===view);render();}
function render(){const today=state.days[dateKey()];$('#today-status').textContent=completed(today)?`${today.responses.length} answered · goal met`:today?`${today.responses.length}/${DAILY_GOAL} toward streak`:'Daily practice';$('#streak').textContent=`${streak()}-day streak`;renderPractice();renderInsights();renderData();}
for(const b of document.querySelectorAll('.tab'))b.addEventListener('click',()=>setView(b.dataset.view));
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(e=>console.info('Offline install unavailable',e)));
render();