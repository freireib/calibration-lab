/* Calibration Lab v0.8: visible runtime version and explicit update action. */
'use strict';
const APP_VERSION='0.8';
const KEY='calibration-lab-data-v1';
const DAILY_GOAL=10;
const BATCH_SIZE=10;
const SUBJECTS=[
 {id:'general',label:'General knowledge',api:9},
 {id:'science',label:'Science & nature',api:17},
 {id:'computers',label:'Computers',api:18},
 {id:'math',label:'Mathematics',api:19},
 {id:'geography',label:'Geography',api:22},
 {id:'history',label:'History',api:23},
 {id:'politics',label:'Politics',api:24},
 {id:'art',label:'Art',api:25},
 {id:'animals',label:'Animals',api:27},
 {id:'other',label:'Other / entertainment',api:null}
];
const DEFAULT_PRACTICE=SUBJECTS.filter(x=>x.id!=='other').map(x=>x.id);
const ALL_SUBJECTS=SUBJECTS.map(x=>x.id);
function subjectOf(q){
 switch(q?.category){
 case 'General Knowledge':case 'Language':case 'Mixed':return 'general';
 case 'Science & Nature':case 'Astronomy':case 'Science':case 'Chemistry':case 'Biology':return 'science';
 case 'Science: Computers':return 'computers';
 case 'Science: Mathematics':case 'Mathematics':return 'math';
 case 'Geography':return 'geography';
 case 'History':return 'history';
 case 'Politics':return 'politics';
 case 'Art':return 'art';
 case 'Animals':return 'animals';
 default:return 'other';
 }
}
function normalizeSubjects(raw,fallback){
 const valid=SUBJECTS.filter(x=>Array.isArray(raw)&&raw.includes(x.id)).map(x=>x.id);
 return valid.length?valid:[...fallback];
}
function hydrateState(v){
 v.practiceSubjects=normalizeSubjects(v.practiceSubjects,DEFAULT_PRACTICE);
 v.insightSubjects=normalizeSubjects(v.insightSubjects,ALL_SUBJECTS);
 v.questionQueue=v.questionQueue.filter(q=>v.practiceSubjects.includes(subjectOf(q)));
 return v;
}
const $=(selector)=>document.querySelector(selector);
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const round=(v,d=2)=>Number(v).toFixed(d);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function dateKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function freshState(){return hydrateState({version:1,days:{},questionQueue:[],seen:[]});}
function load(){try{const v=JSON.parse(localStorage.getItem(KEY));if(v&&v.version===1&&v.days&&typeof v.days==='object'&&Array.isArray(v.seen)&&Array.isArray(v.questionQueue))return hydrateState(v);}catch(e){console.warn('Could not load local history',e);}return freshState();}
let state=load(),selected=null,confidence=75,starting=false,apiError=false,rollingWindow=25,rollingExclude50=false,practiceChooserOpen=false,insightChooserOpen=false,supplyNotice=null;
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
// Open Trivia DB's token tracks questions handed out in the active session,
// while state.seen continues to prevent repeats across expired sessions.
const TRIVIA_GAP_MS=5800;
const TOKEN_IDLE_MS=5*60*60*1000; // The provider expires tokens after six hours idle.
let nextTriviaRequestAt=0;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function triviaGet(url,onProgress){
 const wait=Math.max(0,nextTriviaRequestAt-Date.now());
 if(wait>0){onProgress('Waiting for trivia service ('+Math.ceil(wait/1000)+'s)…');await delay(wait);}
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),9000);
 nextTriviaRequestAt=Date.now()+TRIVIA_GAP_MS;
 try{
  const response=await fetch(url,{signal:ctl.signal,cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  return await response.json();
 }finally{clearTimeout(timer);}
}
async function obtainTriviaToken(onProgress){
 const prev=state.triviaToken;
 if(prev&&typeof prev.value==='string'&&Date.now()-(prev.lastUsed||0)<TOKEN_IDLE_MS)return prev.value;
 // A token is helpful, not mandatory: continue without one if token service fails.
 try{
  onProgress('Starting a nonrepeating trivia session…');
  const data=await triviaGet('https://opentdb.com/api_token.php?command=request',onProgress);
  if(data.response_code===0&&typeof data.token==='string'){
   state.triviaToken={value:data.token,lastUsed:Date.now()};
   save();
   return data.token;
  }
 }catch(err){console.info('Could not start trivia session; using local duplicate filter',err);}
 delete state.triviaToken;return null;
}
async function loadQuestions(onProgress=()=>{}){
 state.questionQueue=state.questionQueue.filter(q=>state.practiceSubjects.includes(subjectOf(q)));
 const original=state.questionQueue.length;
 const seen=new Set([...state.seen,...state.questionQueue.map(q=>q.id)]);
 if(state.questionQueue.length>=BATCH_SIZE)return {count:state.questionQueue.length,added:0,issue:null};
 const choices=SUBJECTS.filter(x=>state.practiceSubjects.includes(x.id)&&x.api!==null);
 const targeted=state.practiceSubjects.length<=2&&choices.length===state.practiceSubjects.length;
 let amount=targeted?10:50,issue=null,attempts=0;
 let token=await obtainTriviaToken(onProgress);
 for(let attempt=0;attempt<3&&state.questionQueue.length<BATCH_SIZE;attempt++){
  attempts++;
  const target=targeted?choices[(Math.floor(Math.random()*choices.length)+attempt)%choices.length]:null;
  onProgress('Finding unused '+(target?target.label.toLowerCase():'trivia')+' questions…');
  const url='https://opentdb.com/api.php?amount='+amount+'&type=boolean&encode=url3986'+(target?'&category='+target.api:'')+(token?'&token='+encodeURIComponent(token):'');
  let data;
  try{data=await triviaGet(url,onProgress);}
  catch(err){
   issue=err?.name==='AbortError'?'Trivia service timed out.':'Trivia service could not be reached.';
   console.info('Trivia request failed',err);
   continue;
  }
  if(data.response_code===5){
   issue='Trivia service is rate-limiting requests. Please retry shortly.';
   nextTriviaRequestAt=Math.max(nextTriviaRequestAt,Date.now()+7000);
   continue;
  }
  if(data.response_code===3){
   // Token expired unexpectedly. A new one can be requested on the next try.
   delete state.triviaToken;token=null;issue='Trivia session expired; please retry.';
   continue;
  }
  if(data.response_code===4){
   // An exhausted token cannot produce new questions; don't reset and repeat old ones.
   issue='All available questions in this trivia session have been used for the selected subjects.';
   break;
  }
  if(data.response_code===1){
   issue='Not enough remaining true/false questions in the selected subject pool for this request.';
   if(amount>1){amount=Math.max(1,Math.floor(amount/2));continue;}
   break;
  }
  if(data.response_code!==0||!Array.isArray(data.results)){
   issue='Trivia provider returned an error (code '+data.response_code+').';
   break;
  }
  if(token&&state.triviaToken)state.triviaToken.lastUsed=Date.now();
  let newInBatch=0;
  for(const item of data.results){
   if(item.type!=='boolean')continue;
   const prompt=decodeURIComponentSafe(item.question);
   const q=qObj(prompt,decodeURIComponentSafe(item.correct_answer)==='True',decodeURIComponentSafe(item.category),'Open Trivia DB',decodeURIComponentSafe(item.difficulty||''));
   if(!state.practiceSubjects.includes(subjectOf(q))||seen.has(q.id))continue;
   state.questionQueue.push(q);seen.add(q.id);newInBatch++;
  }
  if(newInBatch===0)issue='No new questions were found; returned items were already answered or outside your selected subjects.';
  else issue=null;
 }
 if(state.questionQueue.length<BATCH_SIZE){
  for(const q of shuffle([...offlineBank])){
   if(state.practiceSubjects.includes(subjectOf(q))&&!seen.has(q.id)){
    state.questionQueue.push(q);seen.add(q.id);
   }
  }
 }
 save();
 const count=state.questionQueue.length;
 return {count,added:count-original,attempts,issue:issue||(count===0?'No unused questions found in the selected subjects.':null)};
}

function supplyMessage(result){
 if(result.count===0)return {kind:'error',message:result.issue||'No unused questions were found in these subjects.'};
 if(result.count<BATCH_SIZE)return {kind:'warning',message:'Only '+result.count+' unused question'+(result.count===1?' was':'s were')+' retrieved this time. You may need to enable more subjects to continue. '+(result.issue||'')};
 return null;
}
function broadenPracticeAndRetry(){
 state.practiceSubjects=[...DEFAULT_PRACTICE];
 state.questionQueue=state.questionQueue.filter(q=>state.practiceSubjects.includes(subjectOf(q)));
 save();supplyNotice=null;
 practiceChooserOpen=false;
 if(state.days[dateKey()])loadMoreToday();else startToday();
}
function makeSupplyAlert(notice){
 const panel=el('div','alert supply-warning');
 panel.setAttribute('role',notice.kind==='error'?'alert':'status');
 panel.append(el('strong','',notice.kind==='error'?'No new questions loaded':'Limited question supply'));
 panel.append(el('p','',notice.message));
 const options=el('div','button-row');
 options.append(makeButton('Broaden subjects and retry','secondary-btn',broadenPracticeAndRetry));
 panel.append(options);return panel;
}
async function startToday(){
 if(starting)return;
 if(state.days[dateKey()]){render();return;}
 starting=true;
 const node=$('#practice-content');
 node.replaceChildren();
 const panel=el('div','panel');
 panel.append(el('p','muted','Preparing today’s questions…'));
 node.append(panel);
 try{
  const result=await loadQuestions(message=>{const p=node.querySelector('.muted');if(p)p.textContent=message;});
  supplyNotice=supplyMessage(result);
  if(result.count===0){render();return;}
  const today=dateKey(),batch=state.questionQueue.splice(0,BATCH_SIZE);
  state.days[today]={date:today,questions:batch,responses:[],cursor:0,createdAt:new Date().toISOString()};
  state.seen.push(...batch.map(q=>q.id));
  if(!save()){
   delete state.days[today];state.questionQueue.unshift(...batch);state.seen.splice(-batch.length);return;
  }
  selected=null;confidence=75;render();
 }finally{starting=false;}
}
async function loadMoreToday(){
 if(starting)return;
 const day=state.days[dateKey()];
 if(!day||day.cursor<day.questions.length)return;
 starting=true;
 const node=$('#practice-content'),button=node.querySelector('[data-more]');
 if(button){button.disabled=true;button.textContent='Loading questions…';}
 try{
  const result=await loadQuestions(message=>{if(button)button.textContent=message;});
  supplyNotice=supplyMessage(result);
  if(result.count===0){render();return;}
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
function getResponses(){const rows=[];for(const day of Object.values(state.days)){day.responses.forEach((r,i)=>{const q=day.questions[i];rows.push({...r,date:day.date,question:q?.prompt||'',category:q?.category||'',subject:subjectOf(q),source:q?.source||'',difficulty:q?.difficulty||'',id:q?.id||''});});}return rows.sort((a,b)=>b.timestamp.localeCompare(a.timestamp));}
function streak(){let d=new Date();let k=dateKey(d);if(!completed(state.days[k])){d.setDate(d.getDate()-1);k=dateKey(d);}let count=0;while(completed(state.days[k])){count++;d.setDate(d.getDate()-1);k=dateKey(d);}return count;}
function makeButton(label,cls,onClick){const b=el('button',cls,label);b.type='button';b.addEventListener('click',onClick);return b;}
function makeSubjectPicker(mode){
 const isPractice=mode==='practice';
 const ids=isPractice?state.practiceSubjects:state.insightSubjects;
 const d=el('details','subject-picker');
 d.open=isPractice?practiceChooserOpen:insightChooserOpen;
 d.addEventListener('toggle',()=>{if(isPractice)practiceChooserOpen=d.open;else insightChooserOpen=d.open;});
 d.append(el('summary','',(isPractice?'Question subjects':'Statistics subjects')+' · '+ids.length+' selected'));
 const grid=el('div','subject-grid');
 for(const subject of SUBJECTS){
  const item=el('label','subject-option');
  const input=el('input');input.type='checkbox';input.checked=ids.includes(subject.id);
  input.addEventListener('change',()=>{
   const current=isPractice?state.practiceSubjects:state.insightSubjects;
   const next=input.checked?[...current,subject.id]:current.filter(id=>id!==subject.id);
   if(!next.length){input.checked=true;return;}
   if(isPractice){
    state.practiceSubjects=normalizeSubjects(next,DEFAULT_PRACTICE);
    state.questionQueue=state.questionQueue.filter(q=>state.practiceSubjects.includes(subjectOf(q)));
    practiceChooserOpen=true;supplyNotice=null;
   }else{
    state.insightSubjects=normalizeSubjects(next,ALL_SUBJECTS);
    insightChooserOpen=true;
   }
   save();
   if(isPractice)renderPractice();else renderInsights();
  });
  item.append(input,el('span','',subject.label));grid.append(item);
 }
 d.append(grid,el('p','legend',isPractice?'Applies to newly requested questions. Questions already loaded for today can still be answered or skipped.':'Changes the calibration graph, histogram and all score trends without changing saved answers.'));
 return d;
}
function renderPractice(){
 const node=$('#practice-content');node.replaceChildren();node.append(makeSubjectPicker('practice'));if(state.practiceSubjects.length<=2)node.append(el('div','subject-caution','Narrow selection: only '+state.practiceSubjects.length+' subject'+(state.practiceSubjects.length===1?' is':'s are')+' enabled. The true/false question supply may run low.'));if(supplyNotice)node.append(makeSupplyAlert(supplyNotice));const day=state.days[dateKey()];
 if(!day){
  const box=el('div','panel');
  box.append(el('p','micro','Ten answers maintain your streak'),el('h2','','Estimate, commit, learn.'),
   el('p','muted','Pick True or False, then estimate the chance your answer is correct. Keep practicing as long as you like.'));
  box.append(el('p','sm muted','10-question daily goal · unlimited extras · 50–100% confidence'));
  box.append(makeButton(supplyNotice?.kind==='error'?'Retry loading questions':'Start today’s practice','primary',startToday));node.append(box);return;
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
  const more=makeButton(supplyNotice?.kind==='error'?'Retry loading questions':met?'Keep practicing — more questions':'Continue toward 10 questions','primary',loadMoreToday);
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
  const skip=makeButton('Skip — not my topic','secondary-btn',()=>{
   const removed=day.questions.splice(idx,1)[0];
   if(!save()){day.questions.splice(idx,0,removed);return;}
   selected=null;confidence=75;render();
  });skip.style.marginTop='10px';card.append(skip);
  card.append(el('p','legend','Skip only irrelevant or badly worded questions. For an appropriate question whose answer you do not know, choose 50%. Skips do not count toward the daily goal or calibration scores.'));
 }
 node.append(card);
}
function svg(tag,attrs={},text){const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;return n;}
// Jeffreys-prior Beta(k + 1/2, n - k + 1/2) credible intervals.
// The posterior assumes exchangeable binary outcomes within each confidence bin.
function logGamma(z){
 const cof=[0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.6150291621406,12.507343278686905,-0.13857109526572012,9.984369578019572e-6,1.5056327351493116e-7];
 if(z<0.5)return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);
 z-=1;let x=cof[0];for(let i=1;i<cof.length;i++)x+=cof[i]/(z+i);
 const t=z+7.5;return 0.5*Math.log(2*Math.PI)+(z+0.5)*Math.log(t)-t+Math.log(x);
}
function betaFraction(a,b,x){
 const tiny=1e-300,epsilon=3e-13;let c=1,d=1-(a+b)*x/(a+1);
 if(Math.abs(d)<tiny)d=tiny;d=1/d;let h=d;
 for(let m=1;m<=200;m++){
  const m2=2*m;let aa=m*(b-m)*x/((a+m2-1)*(a+m2));
  d=1+aa*d;if(Math.abs(d)<tiny)d=tiny;c=1+aa/c;if(Math.abs(c)<tiny)c=tiny;
  d=1/d;h*=d*c;
  aa=-(a+m)*(a+b+m)*x/((a+m2)*(a+m2+1));
  d=1+aa*d;if(Math.abs(d)<tiny)d=tiny;c=1+aa/c;if(Math.abs(c)<tiny)c=tiny;
  d=1/d;const delta=d*c;h*=delta;if(Math.abs(delta-1)<epsilon)break;
 }
 return h;
}
function betaCDF(x,a,b){
 if(x<=0)return 0;if(x>=1)return 1;
 const logFront=logGamma(a+b)-logGamma(a)-logGamma(b)+a*Math.log(x)+b*Math.log1p(-x);
 const front=Math.exp(logFront);
 return x<(a+1)/(a+b+2)?clamp(front*betaFraction(a,b,x)/a,0,1):clamp(1-front*betaFraction(b,a,1-x)/b,0,1);
}
function betaQuantile(prob,a,b){
 let lo=0,hi=1;
 for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(betaCDF(mid,a,b)<prob)lo=mid;else hi=mid;}
 return (lo+hi)/2;
}
function calibrationBins(rows){
 const bins=[[],[],[],[],[]];
 rows.forEach(r=>{if(r.confidence>=50&&r.confidence<=100)bins[Math.min(4,Math.floor((r.confidence-50)/10))].push(r);});
 return bins.map((b,i)=>{
  if(!b.length)return null;
  const n=b.length,k=b.filter(r=>r.correct).length,alpha=k+0.5,beta=n-k+0.5;
  return {label:i===4?'90–100%':`${50+10*i}–${59+10*i}%`,n,k,meanConfidence:b.reduce((sum,r)=>sum+r.confidence/100,0)/n,accuracy:k/n,low:betaQuantile(.025,alpha,beta),high:betaQuantile(.975,alpha,beta)};
 }).filter(Boolean);
}
function makeCalibrationSvg(bins){
 const s=svg('svg',{viewBox:'0 0 390 280',role:'img','aria-label':'Calibration: observed accuracy and 95% Bayesian credible intervals for each confidence group'});
 const L=44,R=364,B=232,T=18;const xp=p=>L+(p-0.5)/0.5*(R-L),yp=p=>B-p*(B-T);
 for(let k=0;k<=10;k+=2){const p=k/10;s.append(svg('line',{x1:L,y1:yp(p),x2:R,y2:yp(p),stroke:'#e4eaea','stroke-width':1}),svg('text',{x:L-8,y:yp(p)+4,'text-anchor':'end',class:'chart-tick'},`${k*10}%`));}
 for(const p of [0.5,0.6,0.7,0.8,0.9,1])s.append(svg('text',{x:xp(p),y:251,'text-anchor':'middle',class:'chart-tick'},`${round(p*100,0)}%`));
 s.append(svg('line',{x1:xp(.5),y1:yp(.5),x2:xp(1),y2:yp(1),stroke:'#b0c2c0','stroke-width':2,'stroke-dasharray':'6 5'}));
 bins.forEach(b=>{
  const x=xp(b.meanConfidence),y=yp(b.accuracy),top=yp(b.high),bottom=yp(b.low);
  const group=svg('g');group.append(svg('line',{x1:x,y1:top,x2:x,y2:bottom,stroke:'#a56513','stroke-width':2.5}),
    svg('line',{x1:x-6,y1:top,x2:x+6,y2:top,stroke:'#a56513','stroke-width':2.5}),
    svg('line',{x1:x-6,y1:bottom,x2:x+6,y2:bottom,stroke:'#a56513','stroke-width':2.5}));
  const dot=svg('circle',{cx:x,cy:y,r:Math.min(10,4+Math.sqrt(b.n)*.6),fill:'#147966',stroke:'#fff','stroke-width':1.7});
  dot.append(svg('title',{},`${b.label}: ${b.k}/${b.n} correct (${round(100*b.accuracy,1)}%); 95% credible interval ${round(100*b.low,1)}–${round(100*b.high,1)}%`));group.append(dot);
  group.append(svg('text',{x,y:Math.max(10,top-7),'text-anchor':'middle',class:'chart-tick'},`n=${b.n}`));s.append(group);
 });
 s.append(svg('text',{x:(L+R)/2,y:272,'text-anchor':'middle',class:'chart-label'},'Your stated confidence'));
 s.append(svg('text',{x:14,y:(B+T)/2,transform:`rotate(-90 14 ${(B+T)/2})`,'text-anchor':'middle',class:'chart-label'},'Observed accuracy'));
 return s;
}
function makeCalibrationTable(bins){
 const table=el('table','calibration-table'),thead=el('thead'),head=el('tr');
 for(const label of ['Confidence','Correct','Accuracy','95% interval'])head.append(el('th','',label));
 thead.append(head);table.append(thead);const body=el('tbody');
 for(const b of bins){const tr=el('tr');for(const str of [b.label,`${b.k}/${b.n}`,`${round(100*b.accuracy,0)}%`,`${round(100*b.low,0)}–${round(100*b.high,0)}%`])tr.append(el('td','',str));body.append(tr);}
 table.append(body);return table;
}
function makeConfidenceHistogramSvg(rows){
 const s=svg('svg',{viewBox:'0 0 390 242',role:'img','aria-label':'Histogram of confidence ratings in 5-percentage-point increments from 50 to 100 percent'});
 const counts=Array(11).fill(0);
 for(const r of rows){if(Number.isFinite(r.confidence)&&r.confidence>=50&&r.confidence<=100)counts[Math.round((r.confidence-50)/5)]++;}
 const L=40,R=373,T=20,B=190,slot=(R-L)/11,bar=slot*.73;
 const step=Math.max(1,Math.ceil(Math.max(1,...counts)/4)),maxY=step*Math.ceil(Math.max(1,...counts)/step),yp=n=>B-n/maxY*(B-T);
 for(let n=0;n<=maxY;n+=step){const y=yp(n);s.append(svg('line',{x1:L,y1:y,x2:R,y2:y,stroke:'#e5ebeb','stroke-width':1}),svg('text',{x:L-7,y:y+3,'text-anchor':'end',class:'chart-tick'},String(n)));}
 counts.forEach((n,i)=>{
  const x=L+slot*(i+.5),h=n/maxY*(B-T);
  const rect=svg('rect',{x:x-bar/2,y:B-h,width:bar,height:h,rx:2,fill:i===0?'#a56513':'#147966'});
  rect.append(svg('title',{},`${50+i*5}% confidence: ${n} answers`));s.append(rect);
  if(n)s.append(svg('text',{x,y:Math.max(T-3,B-h-5),'text-anchor':'middle',class:'chart-tick'},String(n)));
  if(i%2===0)s.append(svg('text',{x,y:B+17,'text-anchor':'middle',class:'chart-tick'},`${50+i*5}%`));
 });
 s.append(svg('text',{x:(L+R)/2,y:235,'text-anchor':'middle',class:'chart-label'},'Confidence your chosen answer is correct'));
 return s;
}
function makeRollingBrierSvg(rows,windowSize){
 const s=svg('svg',{viewBox:'0 0 390 205',role:'img', 'aria-label':`Mean Brier loss over the previous ${windowSize} scored questions, ordered by when answered`});
 const L=48,R=366,T=18,B=163,yp=v=>B-clamp(v,0,1)*(B-T);
 for(const v of [0,.25,.5,.75,1])s.append(svg('line',{x1:L,x2:R,y1:yp(v),y2:yp(v),stroke:'#e5ebeb'}),svg('text',{x:L-6,y:yp(v)+3,'text-anchor':'end',class:'chart-tick'},round(v,2)));
 // One running mean for each successive scored judgment (excluded flags do not enter).
 const reverse=[...rows].sort((a,b)=>a.timestamp.localeCompare(b.timestamp));let sum=0;const series=[];
 reverse.forEach((r,i)=>{sum+=r.brier;if(i>=windowSize)sum-=reverse[i-windowSize].brier;series.push({idx:i+1,val:sum/Math.min(windowSize,i+1)});});
 const x=i=>series.length===1?(L+R)/2:L+i/(series.length-1)*(R-L);
 if(series.length>1)s.append(svg('polyline',{points:series.map((d,i)=>`${x(i)},${yp(d.val)}`).join(' '),fill:'none',stroke:'#147966','stroke-width':2.5,'stroke-linejoin':'round'}));
 const last=series[series.length-1];s.append(svg('circle',{cx:x(series.length-1),cy:yp(last.val),r:4.5,fill:'#147966'}));
 s.append(svg('text',{x:L,y:185,class:'chart-tick'},'1'),svg('text',{x:R,y:185,'text-anchor':'end',class:'chart-tick'},`${last.idx}`));
 s.append(svg('text',{x:(L+R)/2,y:200,'text-anchor':'middle',class:'chart-label'},'Scored question number (oldest to newest)'));
 return {svg:s,last:last.val};
}
function makeTrendSvg(days){const s=svg('svg',{viewBox:'0 0 390 205',role:'img','aria-label':'Mean Brier loss per completed day'});
 const L=48,R=366,T=18,B=163,yp=v=>B-clamp(v,0,1)*(B-T);
 for(const v of [0,.25,.5,.75,1]){s.append(svg('line',{x1:L,x2:R,y1:yp(v),y2:yp(v),stroke:'#e5ebeb'}),svg('text',{x:L-6,y:yp(v)+3,'text-anchor':'end',class:'chart-tick'},round(v,2)));}
 const x=i=>days.length===1?(L+R)/2:L+i/(days.length-1)*(R-L);
 if(days.length>1){s.append(svg('polyline',{points:days.map((d,i)=>`${x(i)},${yp(d.brier)}`).join(' '),fill:'none',stroke:'#147966','stroke-width':2.5,'stroke-linejoin':'round'}));}
 days.forEach((d,i)=>{s.append(svg('circle',{cx:x(i),cy:yp(d.brier),r:4.3,fill:'#147966'}));});
 if(days.length){s.append(svg('text',{x:L,y:186,class:'chart-tick'},days[0].date.slice(5)));s.append(svg('text',{x:R,y:186,'text-anchor':'end',class:'chart-tick'},days[days.length-1].date.slice(5)));}
 s.append(svg('text',{x:(L+R)/2,y:200,'text-anchor':'middle',class:'chart-label'},'Session date (lower Brier is better)'));return s;
}
function renderInsights(){
 const node=$('#insights-content');node.replaceChildren();
 node.append(makeSubjectPicker('insights'));
 const rows=getResponses().filter(r=>!r.flagged&&state.insightSubjects.includes(r.subject));
 if(!rows.length){
  node.append(el('div','empty','No scored answers for these subjects yet. Select other subjects or answer new questions.'));
  return;
 }
 const average=arr=>arr.reduce((sum,r)=>sum+r.brier,0)/arr.length;
 const confident=rows.filter(r=>r.confidence>50);
 const retained=confident.length,coverage=100*retained/rows.length;
 const correct=rows.filter(r=>r.correct).length;
 const panel=el('div','panel'),grid=el('div','stats');
 const measures=[
  [String(rows.length),'Scored judgments'],
  [round(100*correct/rows.length,1)+'%','Accuracy'],
  [round(average(rows),3),'Brier · all answers'],
  [retained?round(average(confident),3):'—','Brier · exclude 50%'],
  [round(coverage,1)+'%','Coverage · above 50%']
 ];
 for(const [value,label] of measures){
  const cell=el('div','stat');
  cell.append(el('div','value mono',value),el('div','caption',label));
  grid.append(cell);
 }
 panel.append(grid);
 panel.append(el('p','message','Trimmed Brier uses '+retained+' of '+rows.length+' answers. It is conditional on confidence above 50%; always compare it with coverage. Full Brier remains the primary score.'+(rows.length<50?' These are early data: bin-level estimates will be noisy.':'')));
 node.append(panel);
 const bins=calibrationBins(rows);
 const a=el('div','panel chart');
 a.append(el('h3','','Calibration by confidence'),makeCalibrationSvg(bins),makeCalibrationTable(bins));
 a.append(el('p','legend','Green dots = observed accuracy; amber bars = 95% Bayesian credible intervals with a Jeffreys Beta(½,½) prior. Dashed line = perfect calibration. Intervals assume approximately exchangeable questions within a bin.'));
 node.append(a);
 const fifty=rows.filter(r=>r.confidence===50).length;
 const hist=el('div','panel chart');
 hist.append(el('h3','','Confidence histogram'),makeConfidenceHistogramSvg(rows));
 hist.append(el('p','legend',fifty+' of '+rows.length+' answers ('+round(100*fifty/rows.length,1)+'%) were at exactly 50% confidence. Flagged questions are excluded.'));
 node.append(hist);
 const rolling=el('div','panel chart');rolling.append(el('h3','','Rolling Brier score'));
 const modes=el('div','trend-controls');modes.append(el('span','sm muted','Include:'));
 for(const [mode,label] of [[false,'All answers'],[true,'Exclude 50%']]){
  const button=makeButton(label,'window-btn '+(rollingExclude50===mode?'active':''),()=>{rollingExclude50=mode;renderInsights();});
  button.setAttribute('aria-pressed',String(rollingExclude50===mode));modes.append(button);
 }
 rolling.append(modes);
 const controls=el('div','trend-controls');controls.append(el('span','sm muted','Previous questions:'));
 for(const w of [10,25,50,100]){
  const button=makeButton(String(w),'window-btn '+(rollingWindow===w?'active':''),()=>{rollingWindow=w;renderInsights();});
  button.setAttribute('aria-pressed',String(rollingWindow===w));controls.append(button);
 }
 rolling.append(controls);
 const rollingRows=rollingExclude50?confident:rows;
 if(rollingRows.length){
  const result=makeRollingBrierSvg(rollingRows,rollingWindow);
  rolling.append(result.svg);
  rolling.append(el('p','legend','Latest rolling mean: '+round(result.last,3)+' over '+Math.min(rollingWindow,rollingRows.length)+' most recent '+(rollingExclude50?'above-50%':'scored')+' answers from selected subjects. Lower is better.'));
 }else rolling.append(el('p','muted','No answers above 50% confidence yet in these subjects.'));
 node.append(rolling);
 const byDay=new Map();
 for(const r of rows){
  if(!completed(state.days[r.date]))continue;
  if(!byDay.has(r.date))byDay.set(r.date,[]);
  byDay.get(r.date).push(r);
 }
 const dailyRows=[...byDay.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(-30).map(([date,rs])=>({date,brier:average(rs),n:rs.length}));
 const daily=el('div','panel chart');daily.append(el('h3','','Daily Brier history'));
 if(dailyRows.length)daily.append(makeTrendSvg(dailyRows));
 else daily.append(el('p','muted','No days meeting the ten-question streak goal yet.'));
 daily.append(el('p','legend','Full Brier of selected subjects on days when the overall ten-question practice goal was met. Daily counts may differ.'));
 node.append(daily);
}
function download(filename,contents,type){const blob=new Blob([contents],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function exportJson(){download(`calibration-lab-${dateKey()}.json`,JSON.stringify({exportedAt:new Date().toISOString(),...state},null,2),'application/json');}
function csvEscape(s){const v=String(s??'');return `"${v.replaceAll('"','""')}"`;}
function exportCsv(){const cols=['date','timestamp','id','kind','question','category','source','difficulty','correct_answer','chosen_answer','confidence_percent','p_true','correct','brier','flagged'];const rows=getResponses().map(r=>[r.date,r.timestamp,r.id,r.kind,r.question,r.category,r.source,r.difficulty,r.correct?r.chosen:!r.chosen,r.chosen,r.confidence,r.probTrue,r.correct,r.brier,r.flagged]);
 const csv=[cols.join(','),...rows.map(row=>row.map(csvEscape).join(','))].join('\r\n');download(`calibration-lab-${dateKey()}.csv`,csv,'text/csv;charset=utf-8');}
function importJson(file){const reader=new FileReader();reader.onload=()=>{try{const v=JSON.parse(String(reader.result));if(v.version!==1||!v.days||typeof v.days!=='object'||Array.isArray(v.days)||!Array.isArray(v.seen)||!Array.isArray(v.questionQueue))throw Error('Not a Calibration Lab v1 backup.');
 for(const day of Object.values(v.days)){if(!Array.isArray(day.questions)||!Array.isArray(day.responses)||!Number.isInteger(day.cursor))throw Error('Invalid day record.');}
 if(!confirm('Replace all data on this device with the imported backup? Export your current history first if you want to preserve it.'))return;
 const current=state;state=hydrateState({version:1,days:v.days,questionQueue:v.questionQueue,seen:v.seen,practiceSubjects:v.practiceSubjects||current.practiceSubjects,insightSubjects:v.insightSubjects||current.insightSubjects});if(!save()){state=current;return;}selected=null;confidence=75;render();alert('History restored.');
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
// The HTML and JS versions are displayed separately to expose stale cached assets.
const runtimeVersion=$('#runtime-version');
if(runtimeVersion)runtimeVersion.textContent='v'+APP_VERSION;
const updateLink=$('#check-update');
if(updateLink)updateLink.addEventListener('click',async event=>{
 event.preventDefault();
 updateLink.textContent='Checking…';
 try{
  if('serviceWorker' in navigator){
   const registration=await navigator.serviceWorker.getRegistration('./');
   if(registration)await Promise.race([registration.update(),new Promise(resolve=>setTimeout(resolve,2500))]);
  }
 }catch(err){console.info('Update check unavailable',err);}
 const url=new URL('./',location.href);url.searchParams.set('refresh',String(Date.now()));
 location.assign(url.href);
});
if('serviceWorker'in navigator&&location.protocol.startsWith('http')){
 window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>reg.update()).catch(e=>console.info('Offline install unavailable',e)));
}
render();
