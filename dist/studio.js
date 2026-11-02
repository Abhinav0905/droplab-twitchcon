import {freshState,transition,counts,summarize,publicState,NEXT_TESTS} from './round.js';
import {TwitchReader} from './twitch.js';
const $=id=>document.getElementById(id), video=$('replayVideo');
const query=new URLSearchParams(location.search),isOverlay=query.get('view')==='overlay';
let catalog=[],state=freshState(),roomId=null,hostKey=null,backend=false,ready=false,queue=Promise.resolve(),lastPhase=null,lastRound=null,lastReplay=null,chatConnected=false,activity=0,toastTimer;
let channelBus=null,events=null;
const store={get(key){try{return JSON.parse(localStorage.getItem(key));}catch{return null;}},set(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}};
const session={get(key){try{return sessionStorage.getItem(key);}catch{return null;}},set(key,value){try{sessionStorage.setItem(key,value);}catch{}}};
const viewerId=session.get('droplab.viewer')||crypto.randomUUID();session.set('droplab.viewer',viewerId);
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,6500);}
function trialFor(){return catalog.find(t=>t.id===(state.round?.trialId||$('trialSelect').value))||catalog[0];}
function range(values){return values.map(v=>v.toFixed(2)).join('–')+' s';}
function saveAndBroadcast(){if(!roomId)return;store.set('droplab.overlay.'+roomId,publicState(state));channelBus?.postMessage(publicState(state));if(!backend)store.set('droplab.demo',{roomId,state});}
async function request(path,options={}){const res=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(hostKey?{Authorization:'Bearer '+hostKey}:{}),...options.headers}});const data=await res.json();if(!res.ok)throw new Error(data.error||'The studio could not save this action.');return data;}
function dispatch(action,{quiet=false}={}){
  const operation=queue.then(async()=>{if(isOverlay)throw new Error('The overlay is read-only.');state=backend?await request('/api/rooms/'+roomId+'/action',{method:'POST',body:JSON.stringify(action)}):await transition(state,action,catalog);saveAndBroadcast();render();return state;});
  queue=operation.catch(error=>{if(!quiet)toast(error.message);});return operation;
}
const reader=new TwitchReader({
  onStatus(status,message){
    const wasConnected=chatConnected;chatConnected=status==='connected';$('connectionBadge').textContent=status.toUpperCase();$('connectionBadge').className='connection-badge '+status;$('chatStatus').textContent=message;$('connectChat').textContent=chatConnected?'Disconnect':status==='connecting'?'Wait…':'Connect';$('connectChat').disabled=status==='connecting';
    if(wasConnected&&['disconnected','error'].includes(status)&&state.phase==='predicting'){void dispatch({type:'lock'}).then(()=>toast('Chat disconnected. Predictions were locked to preserve the round.')).catch(()=>{});}
  },
  onAction(action){void dispatch(action,{quiet:true}).then(()=>{$('chatStatus').textContent=action.type==='predict'?'Prediction received from Twitch. Viewers can change their call until the lock.':'Next experiment vote received from Twitch.';}).catch(error=>{$('chatStatus').textContent='Chat command was not counted: '+error.message;});},
  onActivity(){activity++;$('chatActivity').hidden=false;$('chatActivity').textContent=activity+' Twitch message'+(activity===1?'':'s')+' received this connection';}
});
function setVideo(trial){
  if(!trial)return;
  if(video.dataset.trial!==trial.id){video.pause();video.src=trial.file;video.poster=trial.poster;video.dataset.trial=trial.id;video.playbackRate=1;video.load();}
  const hidden=['ready','predicting','locked'].includes(state.phase);$('videoCover').hidden=!hidden;
  if(state.phase==='replaying'&&lastReplay!==state.round?.replayStartedAt){
    lastReplay=state.round.replayStartedAt;
    const play=()=>{video.playbackRate=1;video.currentTime=isOverlay?Math.max(0,Math.min(trial.duration-.05,(Date.now()-state.round.replayStartedAt)/1000)):0;void video.play().catch(()=>{if(!isOverlay)toast('Your browser paused playback. Click the video to resume.');});};
    if(video.readyState>=1)play();else video.addEventListener('loadedmetadata',play,{once:true});
  }
  if(hidden&& !video.paused)video.pause();
}
function render(){
  if(!catalog.length)return;
  const r=state.round,trial=trialFor(),phase=state.phase,busy=!['ready','revealed'].includes(phase),revealed=phase==='revealed';
  const tally=r?.counts||counts(r),newPhase=phase!==lastPhase||r?.id!==lastRound;
  $('trialNumber').textContent=String(catalog.indexOf(trial)+1).padStart(2,'0');$('trialName').textContent=trial.name;$('trialNote').textContent=trial.subtitle;
  $('questionThreshold').textContent=(r?.threshold??(Number($('threshold').value)||1)).toFixed(2);
  const phaseNames={ready:'READY TO EXPERIMENT',predicting:'PREDICTIONS OPEN',locked:'PREDICTIONS LOCKED',replaying:'WATCH THE DROP',reviewing:'REVIEW THE EVIDENCE',revealed:'RESULT REVEALED'};
  $('phasePill').textContent=phaseNames[phase];$('phasePill').classList.toggle('active',['predicting','replaying'].includes(phase));
  $('trialSelect').disabled=busy;$('threshold').disabled=busy;
  if(busy){$('trialSelect').value=r.trialId;$('threshold').value=r.threshold.toFixed(2);}
  if(revealed&&newPhase){const next=catalog[(catalog.indexOf(trial)+1)%catalog.length];$('trialSelect').value=next.id;$('threshold').value=next.defaultThreshold.toFixed(2);}
  const labels={ready:'Open predictions',predicting:'Lock predictions',locked:'Play the drop',replaying:'Drop in progress…',reviewing:'Reveal reviewed result',revealed:'Open next round'};
  $('mainAction').querySelector('span').textContent=labels[phase];$('mainAction').disabled=!ready||phase==='replaying';
  const hints={ready:'Choose the prediction line, then invite everyone to make a call.',predicting:'Chat can use !drop yes or !drop no. Lock before the replay.',locked:'Every prediction is sealed. The recording is ready to play.',replaying:'This is a recorded physical trial. Predictions stay locked.',reviewing:'The full drop is visible. Reveal the manually reviewed timing range.',revealed:'Choose a recording and prediction line for the next round.'};
  $('hostHint').textContent=hints[phase];$('cancelRound').hidden=!busy;$('replayAgain').hidden=phase!=='reviewing';
  $('predictionPane').hidden=revealed;$('outcome').hidden=!revealed;
  const vote=r?.predictions?.['practice:'+viewerId];
  $('voteYes').disabled=phase!=='predicting'||isOverlay;$('voteNo').disabled=phase!=='predicting'||isOverlay;
  $('voteYes').classList.toggle('selected',vote?.choice==='yes');$('voteNo').classList.toggle('selected',vote?.choice==='no');
  $('predictionHint').textContent=phase==='predicting'?'Make your call. You can change it until the lock.':phase==='ready'?'Open the round, then choose a side.':'Predictions are sealed. Watch what happens.';
  $('yourVote').textContent=vote?'Your practice prediction: '+vote.choice.toUpperCase()+'. '+(phase==='predicting'?'You can still change it.':'Saved before the lock.'):'Try a prediction here, or use the command in Twitch chat.';
  $('totalVotes').textContent=tally.total+' prediction'+(tally.total===1?'':'s');$('yesCount').textContent=tally.yes;$('noCount').textContent=tally.no;
  $('yesBar').style.width=(tally.total?tally.yes/tally.total*100:0)+'%';$('noBar').style.width=(tally.total?tally.no/tally.total*100:0)+'%';
  $('voteSources').textContent=tally.total?`${tally.twitch} Twitch · ${tally.practice} practice · ${tally.sample} sample`:'No predictions yet';
  $('seal').hidden=!r?.commit;$('sealHash').textContent=r?.commit?'SHA-256 '+r.commit.slice(0,20)+'…':'';
  $('sampleAudience').disabled=phase!=='predicting';$('sampleStatus').textContent=tally.sample?'Sample voters are labelled separately from Twitch viewers.':'';
  document.querySelectorAll('[data-phase]').forEach(el=>{const active=phase==='ready'||phase==='predicting'?'predicting':phase==='locked'||phase==='replaying'?'replaying':'revealed';el.classList.toggle('current',el.dataset.phase===active);});
  $('roundFootnote').textContent=r?.commit?'Locked before playback · export the proof':'One prediction per viewer. Change it until the lock.';
  if(revealed){
    const v=r.result.verdict;$('outcome').classList.toggle('uncertain',v==='uncertain');$('outcomeEyebrow').textContent=v==='uncertain'?'THE EVIDENCE HAS LIMITS':'THE RESULT';$('outcomeTitle').textContent=v==='yes'?'Yes. It made it.':v==='no'?'No. Gravity wins.':'Too close to call.';$('outcomeRange').textContent=range([r.result.low,r.result.high]);
    $('outcomeExplanation').textContent=v==='uncertain'?`The ${r.threshold.toFixed(2)} s line falls inside the reviewed range. No side wins this round.`:v==='yes'?'The entire reviewed range is at or above the prediction line.':'The entire reviewed range is below the prediction line.';
  }
  $('discovery').hidden=!revealed;const next=state.nextTestCounts||Object.fromEntries(Object.keys(NEXT_TESTS).map(k=>[k,Object.values(state.nextTests||{}).filter(v=>v===k).length]));
  for(const key of Object.keys(NEXT_TESTS))$('next-'+key).textContent=next[key]+' vote'+(next[key]===1?'':'s');
  $('evidenceWaiting').hidden=revealed;$('evidenceDetails').hidden=!revealed;
  if(revealed){$('releaseWindow').textContent=range(trial.measurement.release);$('landingWindow').textContent=range(trial.measurement.landing);$('flightWindow').textContent=range(trial.measurement.flight);$('scrub').max=trial.duration;$('integrityNote').textContent=trial.provenance+' Release and landing windows use replay timestamps. Clip SHA-256: '+trial.sha256;}
  const history=[...state.history,...(revealed?[isOverlay?r:summarize(r)]:[])];$('historySection').hidden=!history.length;$('historyBody').replaceChildren();
  for(const row of history){const tr=document.createElement('tr');const title=catalog.find(t=>t.id===row.trialId)?.name||row.trialId;const count=row.counts||counts(row);for(const value of [title,row.threshold.toFixed(2)+' s',range([row.result.low,row.result.high]),row.result.verdict==='uncertain'?'Too close to call':row.result.verdict==='yes'?'Yes':'No',count.total]){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('historyBody').append(tr);}
  $('export').disabled=!history.length;
  setVideo(trial);lastPhase=phase;lastRound=r?.id;
}
function updateClock(){const trial=trialFor();if(!trial)return;$('replayClock').textContent=video.currentTime.toFixed(2)+' s';$('inspectTime').textContent=video.currentTime.toFixed(2)+' s';$('scrub').value=video.currentTime;const t=video.currentTime,m=trial.measurement;
  $('videoMarker').textContent=['ready','predicting','locked'].includes(state.phase)?'Awaiting the drop':t<m.release[0]?'Before release':t<=m.release[1]?'Reviewed release window':t<m.landing[0]?'In the air':t<=m.landing[1]?'Reviewed landing window':'After landing';
}
video.addEventListener('timeupdate',updateClock);video.addEventListener('seeked',updateClock);video.addEventListener('ended',()=>{if(!isOverlay&&state.phase==='replaying')void dispatch({type:'finishReplay'}).catch(()=>{});});
video.addEventListener('error',()=>{toast('The recording could not load. Reload the page or try another trial.');if(!isOverlay&&state.phase==='replaying')void dispatch({type:'cancel'}).catch(()=>{});});
video.addEventListener('click',()=>{if(state.phase==='replaying')void video.play().catch(()=>{});});
$('mainAction').onclick=()=>{const type={ready:'open',predicting:'lock',locked:'replay',reviewing:'reveal',revealed:'open'}[state.phase];if(type)void dispatch({type,trialId:$('trialSelect').value,threshold:Number($('threshold').value)}).catch(()=>{});};
$('cancelRound').onclick=()=>void dispatch({type:'cancel'}).catch(()=>{});
$('replayAgain').onclick=()=>void dispatch({type:'replay'}).catch(()=>{});
for(const [id,choice] of [['voteYes','yes'],['voteNo','no']])$(id).onclick=()=>void dispatch({type:'predict',id:'practice:'+viewerId,name:'You',source:'practice',choice}).catch(()=>{});
$('sampleAudience').onclick=async()=>{for(const [i,name,choice] of [[1,'Sample viewer A','yes'],[2,'Sample viewer B','no'],[3,'Sample viewer C','yes']])await dispatch({type:'predict',id:'sample:'+i,name,source:'sample',choice}).catch(()=>{});};
$('trialSelect').onchange=()=>{$('threshold').value=catalog.find(t=>t.id===$('trialSelect').value).defaultThreshold.toFixed(2);if(state.phase==='ready')render();};
$('threshold').oninput=()=>{if(state.phase==='ready')$('questionThreshold').textContent=Number($('threshold').value||0).toFixed(2);};
$('connectForm').onsubmit=async event=>{event.preventDefault();if(chatConnected){reader.disconnect();chatConnected=false;$('connectionBadge').textContent='NOT CONNECTED';$('connectionBadge').className='connection-badge';$('connectChat').textContent='Connect';$('chatStatus').textContent='Chat disconnected. Existing predictions stay in the notebook.';return;}
  const channel=$('channel').value.trim().toLowerCase().replace(/^https?:\/\/(www\.)?twitch\.tv\//,'').replace(/\/$/,'');
  try{if(channel!==state.channel)await dispatch({type:'channel',channel});activity=0;$('chatActivity').hidden=true;reader.connect(channel);$('channel').value=channel;}catch(error){toast(error.message);}
};
for(const button of document.querySelectorAll('[data-test]'))button.onclick=()=>void dispatch({type:'nextTest',id:'practice:'+viewerId,choice:button.dataset.test}).then(()=>toast('Your next-experiment vote is saved.')).catch(()=>{});
$('inspectLink').onclick=()=>$('evidence').scrollIntoView({behavior:'smooth'});
function seek(time){video.pause();video.currentTime=Math.max(0,Math.min(trialFor().duration-.01,time));$('videoStage').scrollIntoView({behavior:'smooth',block:'center'});}
$('jumpRelease').onclick=()=>seek(trialFor().measurement.release[0]);$('jumpLanding').onclick=()=>seek(trialFor().measurement.landing[0]);
$('frameBack').onclick=()=>seek(video.currentTime-1/30);$('frameForward').onclick=()=>seek(video.currentTime+1/30);$('scrub').oninput=()=>{video.pause();video.currentTime=Number($('scrub').value);};
$('slowReplay').onclick=()=>{video.currentTime=0;video.playbackRate=.25;void video.play().catch(()=>toast('Click the video to allow playback.'));$('videoStage').scrollIntoView({behavior:'smooth',block:'center'});};
$('present').onclick=()=>{document.body.classList.toggle('presenting');$('present').textContent=document.body.classList.contains('presenting')?'Exit presentation':'Present ↗';if(document.body.classList.contains('presenting'))toast('Presentation view. Press Escape to return to the studio.');};
$('exitPresentation').onclick=()=>{document.body.classList.remove('presenting');$('present').textContent='Present ↗';};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!isOverlay)document.body.classList.remove('presenting');});
function overlayURL(){const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('view','overlay');u.searchParams.set('room',roomId);return u.href;}
$('overlayButton').onclick=()=>{$('overlayURL').value=overlayURL();$('openOverlay').href=overlayURL();$('overlayInstructions').textContent=backend?'Paste this URL into an OBS Browser source. Predictions and the reveal update from this studio automatically.':'This hosted demo can synchronize another tab in this browser. For an OBS Browser source, run the local host from the downloadable source and use its overlay URL.';$('overlayDialog').showModal();};
$('copyOverlay').onclick=async()=>{try{await navigator.clipboard.writeText($('overlayURL').value);toast('Overlay URL copied.');}catch{$('overlayURL').select();toast('Select and copy the overlay URL.');}};
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
$('export').onclick=()=>{const rounds=[...state.history,...(state.phase==='revealed'?[summarize(state.round)]:[])];const packet={app:'DropLab',version:1,exportedAt:new Date().toISOString(),channel:state.channel,mode:'recorded-physical-trials',measurementMethod:'manual-frame-review',notice:'No live-camera accuracy or design-performance claim. Sample and practice predictions are labelled separately from Twitch.',trials:catalog,rounds,nextExperimentVotes:state.nextTests};download(JSON.stringify(packet,null,2),'droplab-experiment.json','application/json');toast('Experiment exported with prediction seals and evidence references.');};
async function init(){
  const response=await fetch('trials.json');if(!response.ok)throw new Error('Trial recordings are unavailable.');catalog=await response.json();
  if(isOverlay){document.body.classList.add('presenting','overlay-view');roomId=query.get('room');if(!roomId)throw new Error('Open the overlay from the studio to attach a session.');
    try{const response=await fetch('/api/rooms/'+roomId,{signal:AbortSignal.timeout(2000)});if(response.ok&&response.headers.get('content-type')?.includes('application/json')){state=await response.json();backend=true;}}catch{}
    if(backend){events=new EventSource('/api/rooms/'+roomId+'/events');events.onmessage=e=>{state=JSON.parse(e.data);render();};events.onerror=()=>{$('phasePill').textContent='HOST CONNECTION INTERRUPTED';};}
    else{const saved=store.get('droplab.overlay.'+roomId);if(!saved)throw new Error('Open this overlay in the same browser as the hosted studio, or use the local OBS host.');state=saved;channelBus=new BroadcastChannel('droplab.'+roomId);channelBus.onmessage=e=>{state=e.data;render();};}
    ready=true;render();return;
  }
  try{const response=await fetch('/api/health',{signal:AbortSignal.timeout(2000)});backend=response.ok&&response.headers.get('content-type')?.includes('application/json')&&(await response.json()).app==='DropLab';}catch{backend=false;}
  if(backend){
    const credentials=session.get('droplab.host');if(credentials){try{const saved=JSON.parse(credentials);roomId=saved.roomId;hostKey=saved.hostKey;const restored=await request('/api/rooms/'+roomId);if(Object.hasOwn(restored,'nextTestCounts'))throw new Error('Host session expired.');state=restored;}catch{roomId=null;hostKey=null;}}
    if(!roomId){const created=await request('/api/rooms',{method:'POST',body:'{}'});({roomId,hostKey,state}=created);session.set('droplab.host',JSON.stringify({roomId,hostKey}));}
  }else{const saved=store.get('droplab.demo');if(saved?.state?.version===1&&['ready','predicting','locked','reviewing','revealed'].includes(saved.state.phase)){roomId=saved.roomId;state=saved.state;}else{roomId=crypto.randomUUID();state=freshState();}}
  if(state.phase==='replaying')state=backend?await request('/api/rooms/'+roomId+'/action',{method:'POST',body:JSON.stringify({type:'finishReplay'})}):{...state,phase:'reviewing'};
  channelBus=new BroadcastChannel('droplab.'+roomId);ready=true;$('sessionStatus').textContent=backend?'STUDIO + OBS READY':'BROWSER DEMO';
  if(!state.channel&&state.phase==='ready')await dispatch({type:'channel',channel:'kumarabhinav0905'});
  if(state.channel)$('channel').value=state.channel;saveAndBroadcast();render();
}
window.addEventListener('pagehide',()=>{reader.disconnect();events?.close();channelBus?.close();});
init().catch(error=>{$('hostHint').textContent=error.message;$('sessionStatus').textContent='SETUP NEEDS ATTENTION';toast(error.message);});
