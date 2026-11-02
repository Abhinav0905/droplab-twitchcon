export const PHASES = ['ready', 'predicting', 'locked', 'replaying', 'reviewing', 'revealed'];
export const NEXT_TESTS = {blades:'Longer blades', weight:'Add one paper clip', repeat:'Repeat the same design'};
export const freshState = () => ({version:1, phase:'ready', round:null, history:[], nextTests:{}, channel:'', revision:0});
const fail = message => {throw new Error(message);};
export function verdict(low, high, threshold) {
  if (![low,high,threshold].every(Number.isFinite) || low < 0 || high < low) return fail('Invalid measurement range.');
  return low >= threshold ? 'yes' : high < threshold ? 'no' : 'uncertain';
}
export function canonicalCommit(round) {
  return JSON.stringify({roundId:round.id,trialId:round.trialId,threshold:round.threshold,openedAt:round.openedAt,lockedAt:round.lockedAt,predictions:Object.values(round.predictions).map(({id,choice,source,receivedAt})=>({id,choice,source,receivedAt})).sort((a,b)=>a.id.localeCompare(b.id))});
}
export async function sha256(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function counts(round) {
  const values=Object.values(round?.predictions||{});
  return {yes:values.filter(p=>p.choice==='yes').length,no:values.filter(p=>p.choice==='no').length,total:values.length,twitch:values.filter(p=>p.source==='twitch').length,practice:values.filter(p=>p.source==='practice').length,sample:values.filter(p=>p.source==='sample').length};
}
export function summarize(round) {return {id:round.id,trialId:round.trialId,threshold:round.threshold,openedAt:round.openedAt,lockedAt:round.lockedAt,revealedAt:round.revealedAt,commit:round.commit,commitPayload:round.commitPayload,counts:counts(round),result:round.result,predictions:Object.values(round.predictions)};}
export async function transition(previous,action,catalog,now=Date.now()) {
  const state=structuredClone(previous), r=state.round;
  if (!action || typeof action.type!=='string') return fail('Choose an action.');
  switch(action.type) {
    case 'open': {
      if(!['ready','revealed'].includes(state.phase))return fail('Finish or cancel this round before opening another.');
      const trial=catalog.find(t=>t.id===action.trialId);if(!trial)return fail('Unknown trial.');
      const threshold=Number(action.threshold);if(!Number.isFinite(threshold)||threshold<.3||threshold>5)return fail('Choose a prediction line between 0.30 and 5.00 seconds.');
      if(r&&state.phase==='revealed')state.history.push(summarize(r));
      state.history=state.history.slice(-50);
      state.round={id:crypto.randomUUID(),trialId:trial.id,threshold:Math.round(threshold*100)/100,openedAt:now,lockedAt:null,predictions:{},seenMessages:[],commit:null,result:null};
      state.phase='predicting';break;
    }
    case 'predict': {
      if(state.phase!=='predicting')return fail('Predictions are locked for this round.');
      if(!['yes','no'].includes(action.choice))return fail('Choose yes or no.');
      if(!['twitch','practice','sample'].includes(action.source))return fail('Unknown prediction source.');
      const id=String(action.id||'');if(!/^[\w:-]{1,90}$/.test(id)||!id.startsWith(action.source+':'))return fail('Invalid participant.');
      if(Object.keys(r.predictions).length>=2000&&!r.predictions[id])return fail('This round has reached 2,000 predictions.');
      if(action.source==='twitch'){
        if(!action.messageId||!Number.isFinite(action.sentAt)||action.sentAt<r.openedAt||action.sentAt>now+5000)return fail('This chat message is outside the open prediction window.');
        if(r.seenMessages.includes(action.messageId))return fail('Duplicate chat message.');
        r.seenMessages.push(String(action.messageId).slice(0,100));r.seenMessages=r.seenMessages.slice(-5000);
      }
      r.predictions[id]={id,name:String(action.name||'Viewer').slice(0,32),choice:action.choice,source:action.source,receivedAt:now};break;
    }
    case 'lock':
      if(state.phase!=='predicting')return fail('Open predictions before locking.');
      r.lockedAt=now;r.commitPayload=canonicalCommit(r);r.commit=await sha256(r.commitPayload);state.phase='locked';break;
    case 'replay':
      if(!['locked','reviewing'].includes(state.phase))return fail('Lock predictions before playing the drop.');
      r.replayStartedAt=now;state.phase='replaying';break;
    case 'finishReplay':
      if(state.phase!=='replaying')return fail('Play the drop before reviewing it.');
      state.phase='reviewing';break;
    case 'reveal': {
      if(state.phase!=='reviewing')return fail('Watch and review the drop before revealing the result.');
      const trial=catalog.find(t=>t.id===r.trialId);if(!trial)return fail('Trial evidence is unavailable.');
      const low=trial.measurement.flight[0],high=trial.measurement.flight[1];
      r.result={low,high,verdict:verdict(low,high,r.threshold),method:'manual-frame-review',sourceHash:trial.sha256};r.revealedAt=now;state.phase='revealed';break;
    }
    case 'nextTest': {
      if(state.phase!=='revealed')return fail('Reveal the current result before choosing the next experiment.');
      if(!Object.hasOwn(NEXT_TESTS,action.choice))return fail('Unknown experiment option.');
      const id=String(action.id||'');if(!/^(twitch|practice):[\w-]{1,80}$/.test(id))return fail('Invalid participant.');
      if(Object.keys(state.nextTests).length>=2000&&!Object.hasOwn(state.nextTests,id))return fail('The experiment vote is full.');
      state.nextTests[id]=action.choice;break;
    }
    case 'channel':
      if(!/^[a-z0-9_]{0,25}$/.test(action.channel))return fail('Use a Twitch channel name, without the URL.');
      if(state.phase==='predicting')return fail('Lock or cancel the round before changing channels.');
      state.channel=action.channel;break;
    case 'cancel':state.phase='ready';state.round=null;break;
    default:return fail('Unknown action.');
  }
  state.revision++;return state;
}
export function publicState(state) {
  const copy=structuredClone(state);
  if(copy.round){delete copy.round.seenMessages;delete copy.round.commitPayload;copy.round.counts=counts(copy.round);delete copy.round.predictions;}
  copy.history=copy.history.map(({predictions,commitPayload,...row})=>row);
  const votes={blades:0,weight:0,repeat:0};for(const value of Object.values(copy.nextTests))votes[value]++;
  copy.nextTestCounts=votes;delete copy.nextTests;return copy;
}
