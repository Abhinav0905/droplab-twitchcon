import {DropTimer, findPaper} from './tracker.js';
const $=id=>document.getElementById(id);
const source=$('source'), overlay=$('overlay'), ctx=overlay.getContext('2d');
const analysis=document.createElement('canvas'), ac=analysis.getContext('2d',{willReadFrequently:true});
let stream=null, sourceBlob=null, sourceKind=null, sourceURL=null, color=null, picking=false, timer=null;
let recorder=null, recordingPromise=null, settling=false, generation=0, lastFrame=null, detection={point:null};
let trialMeta=null, selected=null, manualStart=null, manualEnd=null, reviewURL=null, armTimeout=null;
const trials=[];
const lines=()=>({top:Number($('topLine').value)/100,bottom:Number($('bottomLine').value)/100});
const say=(title,hint)=>{$('runStatus').textContent=title;$('runHint').textContent=hint;};
function controls(){
  const busy=!!timer||settling;
  for (const id of ['camera','file','trialLabel','topLine','bottomLine','play','seek']) $(id).disabled=busy;
  $('arm').disabled=busy||!sourceKind||!color;
  $('pick').disabled=busy||!sourceKind;
  $('cancel').disabled=!timer;
  $('stop').disabled=!stream;
  $('csv').disabled=!trials.length;
}
function drawLines(context,width,height,values){
  context.strokeStyle='#dbff78';context.lineWidth=Math.max(2,width/500);context.setLineDash([width/80,width/120]);
  context.font=`600 ${Math.max(12,width/55)}px sans-serif`;
  for(const [y,label] of [[values.top,'UPPER'],[values.bottom,'LOWER']]) {
    context.beginPath();context.moveTo(width*.1,height*y);context.lineTo(width*.9,height*y);context.stroke();
    context.fillStyle='#14252dcc';context.fillRect(width*.1,height*y-26,width*.13,22);
    context.fillStyle='#dbff78';context.fillText(label,width*.11,height*y-9);
  }
  context.setLineDash([]);
}
function paint(){
  if(!source.videoWidth)return;
  if(overlay.width!==source.videoWidth||overlay.height!==source.videoHeight){overlay.width=source.videoWidth;overlay.height=source.videoHeight;}
  ctx.clearRect(0,0,overlay.width,overlay.height);
  drawLines(ctx,overlay.width,overlay.height,timer||lines());
  if(detection.point){
    const x=detection.point.x*overlay.width,y=detection.point.y*overlay.height;
    ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,Math.max(8,overlay.width*.013),0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x-12,y);ctx.lineTo(x+12,y);ctx.moveTo(x,y-12);ctx.lineTo(x,y+12);ctx.stroke();
  }
}
function processFrame(t){
  if(!source.videoWidth||source.readyState<2||lastFrame===t)return;
  lastFrame=t;
  if(analysis.width!==240||analysis.height!==Math.round(240*source.videoHeight/source.videoWidth)){
    analysis.width=240;analysis.height=Math.round(240*source.videoHeight/source.videoWidth);
  }
  ac.drawImage(source,0,0,analysis.width,analysis.height);
  detection=color?findPaper(ac.getImageData(0,0,analysis.width,analysis.height),color):{point:null};
  $('tracking').textContent=picking?'Click the paper in the picture.':!color?'Hold the paper still, then pick its color.':detection.point?'Paper found. Keep the camera and background still.':detection.reason||'Waiting for the paper.';
  if(timer){
    const result=timer.update(t,detection);
    if(result) void finish(result);
    else if(timer.state==='measuring')say('Measuring transit','Keep the whole drop inside the picture.');
  }
  paint();
}
function startFrameLoop(){
  const current=++generation;
  const tick=(now,metadata)=>{
    if(current!==generation)return;
    processFrame(metadata?.mediaTime??source.currentTime);
    if(source.requestVideoFrameCallback)source.requestVideoFrameCallback(tick);else requestAnimationFrame(tick);
  };
  if(source.requestVideoFrameCallback)source.requestVideoFrameCallback(tick);else requestAnimationFrame(tick);
}
function releaseSource(){
  generation++;source.pause();
  if(stream){stream.getTracks().forEach(track=>track.stop());stream=null;}
  source.onloadedmetadata=null;source.srcObject=null;source.removeAttribute('src');source.load();
  if(sourceURL){URL.revokeObjectURL(sourceURL);sourceURL=null;}
  sourceBlob=null;sourceKind=null;color=null;lastFrame=null;detection={point:null};
  $('placeholder').hidden=false;$('fileControls').hidden=true;
  $('sourceLabel').textContent='No source selected';ctx.clearRect(0,0,overlay.width,overlay.height);controls();
}
function prepare(kind){
  sourceKind=kind;lastFrame=null;
  $('placeholder').hidden=true;$('fileControls').hidden=kind==='webcam';
  $('sourceLabel').textContent={webcam:'WEBCAM · LIVE',video:'YOUR VIDEO · LOCAL'}[kind];
  $('swatch').style.background=color?`rgb(${color})`:'#dce2d8';
  say('Choose the paper color','Then arm a drop from above the upper line.');controls();
  startFrameLoop();paint();
}
$('camera').onclick=async()=>{
  releaseSource();say('Waiting for camera permission','Allow camera access in your browser. Audio is not requested.');
  const requestGeneration=generation;
  try {
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access is unavailable here. Open this local URL in Chrome or load a phone recording.');
    const acquired=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}},audio:false});
    if(requestGeneration!==generation){acquired.getTracks().forEach(track=>track.stop());return;}
    stream=acquired;
    source.srcObject=stream;await source.play();
    if(requestGeneration!==generation){acquired.getTracks().forEach(track=>track.stop());return;}
    prepare('webcam');
    stream.getVideoTracks()[0].onended=()=>{if(timer)void finish({status:'rejected',reason:'Camera stopped during the trial'});};
  }catch(error){say('Camera could not start',error.message);controls();}
};
async function loadVideo(blob,kind='video'){
  releaseSource();sourceBlob=blob;sourceURL=URL.createObjectURL(blob);source.src=sourceURL;
  source.onloadedmetadata=()=>{
    $('seek').max=Number.isFinite(source.duration)?source.duration:30;
    source.currentTime=.01;
    prepare(kind);
  };
  source.load();
}
$('file').onchange=()=>{const file=$('file').files[0];if(file)void loadVideo(file);$('file').value='';};
$('stop').onclick=()=>{if(timer)void finish({status:'rejected',reason:'Operator stopped the camera'});releaseSource();say('Camera stopped','Your saved results remain below.');};
$('play').onclick=()=>source.paused?void source.play():source.pause();
$('seek').oninput=()=>{source.pause();source.currentTime=Number($('seek').value);lastFrame=null;};
source.ontimeupdate=()=>{$('seek').value=source.currentTime;$('position').textContent=source.currentTime.toFixed(2)+' s';};
source.onended=()=>{if(timer)void finish({status:'rejected',reason:'Recording ended before both crossings were measured'});};
source.onerror=()=>{say('Video could not be read','Try an MP4 recording in Chrome.');if(timer)void finish({status:'rejected',reason:'Video decode error'});};
for(const [id,out] of [['topLine','topOut'],['bottomLine','bottomOut']])$(id).oninput=()=>{$(out).textContent=$(id).value+'%';paint();};
$('pick').onclick=()=>{picking=true;$('stage').classList.add('picking');$('tracking').textContent='Click the center of the paper in the picture.';};
overlay.onclick=event=>{
  if(!picking||source.readyState<2)return;
  const r=overlay.getBoundingClientRect(),scale=Math.min(r.width/source.videoWidth,r.height/source.videoHeight);
  const x=(event.clientX-r.left-(r.width-source.videoWidth*scale)/2)/scale;
  const y=(event.clientY-r.top-(r.height-source.videoHeight*scale)/2)/scale;
  if(x<0||y<0||x>=source.videoWidth||y>=source.videoHeight)return;
  const sample=document.createElement('canvas');sample.width=1;sample.height=1;
  const sc=sample.getContext('2d');sc.drawImage(source,Math.floor(x),Math.floor(y),1,1,0,0,1,1);
  color=[...sc.getImageData(0,0,1,1).data].slice(0,3);picking=false;$('stage').classList.remove('picking');
  $('swatch').style.background=`rgb(${color})`;lastFrame=null;processFrame(source.currentTime);controls();
  say('Paper color selected','Arm, then release the paper above the upper line.');
};
function startRecording(){
  if(sourceKind!=='webcam')return;
  if(!window.MediaRecorder)throw new Error('This browser cannot save a replay. Use Chrome or load a recorded video.');
  const mime=['video/webm;codecs=vp8','video/webm','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
  recorder=new MediaRecorder(stream,mime?{mimeType:mime}:{});
  const chunks=[];const active=recorder;
  recordingPromise=new Promise(resolve=>{
    active.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
    active.onstop=()=>resolve(new Blob(chunks,{type:active.mimeType}));
    active.onerror=()=>resolve(null);
  });
  recorder.start(100);
}
$('arm').onclick=async()=>{
  if(timer||settling||!color)return;
  try{
    startRecording();trialMeta={label:$('trialLabel').value.trim()||'Baseline',source:sourceKind,created:new Date().toISOString(),...lines(),color:[...color],originalBlob:sourceBlob};
    timer=new DropTimer(lines());say('Armed · release above the upper line','Wait until the paper is found, then drop it.');controls();
    armTimeout=setTimeout(()=>{if(timer)void finish({status:'rejected',reason:'No complete drop was captured within 20 seconds'});},20000);
    if(source.paused)await source.play();
  }catch(error){if(timer)await finish({status:'rejected',reason:error.message});else if(recorder?.state==='recording')recorder.stop();say('Could not arm the drop',error.message);controls();}
};
async function finish(result){
  if(!timer)return;
  clearTimeout(armTimeout);armTimeout=null;
  const meta=trialMeta;timer=null;settling=true;controls();
  say(result.status==='candidate'?`${result.seconds.toFixed(3)} s · needs review`:'Trial rejected',result.reason||'Inspect the replay and add a manual timing check.');
  if(sourceKind!=='webcam')source.pause();
  let blob=meta.originalBlob;
  const active=recorder,promise=recordingPromise;recorder=null;recordingPromise=null;
  if(active){await new Promise(resolve=>setTimeout(resolve,350));if(active.state!=='inactive')active.stop();blob=await promise;}
  trials.push({id:trials.length+1,...meta,...result,blob,manual:null});
  settling=false;renderTrials();controls();
}
$('cancel').onclick=()=>void finish({status:'rejected',reason:'Operator cancelled the trial'});
function renderTrials(){
  $('resultsEmpty').hidden=!!trials.length;$('count').textContent=`${trials.length} trial${trials.length===1?'':'s'}`;$('results').replaceChildren();
  for(const trial of [...trials].reverse()){
    const row=document.createElement('article');row.className='trial';
    const left=document.createElement('div'),title=document.createElement('h3'),status=document.createElement('span'),note=document.createElement('p');
    title.textContent=`${String(trial.id).padStart(2,'0')} / ${trial.label}`;
    status.className='pill'+(trial.status==='rejected'?' reject':'');
    status.textContent=trial.status==='rejected'?'Rejected':trial.manual?'Checked manually':'Unreviewed';
    note.textContent=trial.source==='webcam'?'Webcam recording':'Loaded recording';
    left.append(title,status,note);
    if(trial.reason){const why=document.createElement('p');why.textContent=trial.reason;left.append(why);}
    else {const bound=document.createElement('p');bound.textContent=`Frame timing range: ${trial.frameMin.toFixed(3)}–${trial.frameMax.toFixed(3)} s`;left.append(bound);}
    if(trial.manual){const m=document.createElement('p');m.textContent=`Manual: ${trial.manual.seconds.toFixed(3)} s`;left.append(m);}
    const right=document.createElement('div'),time=document.createElement('strong'),button=document.createElement('button');
    time.textContent=trial.seconds?trial.seconds.toFixed(3)+' s':'—';button.textContent=trial.blob?'Review clip':'Clip unavailable';button.className='secondary';button.disabled=!trial.blob;
    button.onclick=()=>openReview(trial);right.append(time,document.createElement('br'),button);row.append(left,right);$('results').append(row);
  }
}
function openReview(trial){
  selected=trial;manualStart=null;manualEnd=null;
  if(reviewURL)URL.revokeObjectURL(reviewURL);reviewURL=URL.createObjectURL(trial.blob);
  const video=$('reviewVideo');video.src=reviewURL;video.load();
  $('reviewPanel').hidden=false;$('reviewTitle').textContent=`Trial ${trial.id} · ${trial.label}`;
  $('lineSummary').textContent=`Upper line: ${(trial.top*100).toFixed(0)}% of frame height. Lower line: ${(trial.bottom*100).toFixed(0)}%.`;
  video.onloadedmetadata=()=>{
    const canvas=$('reviewOverlay');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
    drawLines(canvas.getContext('2d'),canvas.width,canvas.height,trial);
    if(!Number.isFinite(video.duration)){video.currentTime=1e6;video.onseeked=()=>{video.onseeked=null;video.currentTime=0;};}
  };
  updateMarks();$('reviewPanel').scrollIntoView({behavior:'smooth',block:'start'});
}
function updateMarks(){
  $('marks').textContent=`Upper: ${manualStart===null?'not marked':manualStart.toFixed(3)+' s'} · Lower: ${manualEnd===null?'not marked':manualEnd.toFixed(3)+' s'}`;
  const valid=manualStart!==null&&manualEnd!==null&&manualEnd>manualStart;
  $('saveReview').disabled=!valid;
  $('comparison').textContent=valid?`Manual transit: ${(manualEnd-manualStart).toFixed(3)} s${selected.seconds?`. Difference from tracker: ${((manualEnd-manualStart-selected.seconds)*1000).toFixed(0)} ms.`:'. Automatic trial remains rejected.'}`:'';
}
for(const [id,delta] of [['back',-.02],['forward',.02]])$(id).onclick=()=>{const v=$('reviewVideo');v.pause();v.currentTime=Math.max(0,Math.min(Number.isFinite(v.duration)?v.duration:Infinity,v.currentTime+delta));};
$('markStart').onclick=()=>{manualStart=$('reviewVideo').currentTime;updateMarks();};
$('markEnd').onclick=()=>{manualEnd=$('reviewVideo').currentTime;updateMarks();};
$('saveReview').onclick=()=>{
  selected.manual={start:manualStart,end:manualEnd,seconds:manualEnd-manualStart};renderTrials();
  $('comparison').textContent+=' Manual check saved.';$('saveReview').disabled=true;
};
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('downloadClip').onclick=()=>download(selected.blob,`droplab-trial-${selected.id}-${selected.source}.${selected.blob.type.includes('mp4')?'mp4':selected.blob.type.includes('quicktime')?'mov':'webm'}`);
$('csv').onclick=()=>{
  const columns=['trial','label','source','created_utc','automatic_status','reason','automatic_seconds','frame_min_seconds','frame_max_seconds','upper_line','lower_line','manual_seconds','difference_ms'];
  const rows=trials.map(t=>[t.id,t.label,t.source,t.created,t.status,t.reason||'',t.seconds??'',t.frameMin??'',t.frameMax??'',t.top,t.bottom,t.manual?.seconds??'',t.manual&&t.seconds?(t.manual.seconds-t.seconds)*1000:'']);
  const escape=value=>{let s=String(value);if(typeof value==='string'&&/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  download(new Blob([[columns,...rows].map(r=>r.map(escape).join(',')).join('\r\n')],{type:'text/csv'}),'droplab-camera-check.csv');
};
window.addEventListener('pagehide',()=>stream?.getTracks().forEach(track=>track.stop()));
controls();
