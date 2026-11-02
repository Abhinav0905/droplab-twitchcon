import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {freshState,transition,verdict,counts,canonicalCommit,sha256,publicState} from '../dist/round.js';
const catalog=JSON.parse(await readFile(new URL('../dist/trials.json',import.meta.url)));
const open=(trialId='trial-01',threshold=1)=>transition(freshState(),{type:'open',trialId,threshold},catalog,10000);
const vote=(id='practice:one',choice='yes')=>({type:'predict',id,name:'Viewer',source:'practice',choice});
test('replay cannot precede prediction lock and reveal cannot precede replay review',async()=>{
  let s=await open();await assert.rejects(()=>transition(s,{type:'replay'},catalog),/Lock/);await assert.rejects(()=>transition(s,{type:'reveal'},catalog),/Watch/);
  s=await transition(s,{type:'lock'},catalog,12000);await assert.rejects(()=>transition(s,{type:'reveal'},catalog),/Watch/);
});
test('a viewer changes one prediction, then the lock freezes it and its digest',async()=>{
  let s=await open();s=await transition(s,vote(),catalog,11000);s=await transition(s,vote('practice:one','no'),catalog,11500);
  assert.equal(counts(s.round).total,1);assert.equal(counts(s.round).no,1);
  s=await transition(s,{type:'lock'},catalog,12000);const before=JSON.stringify(s);assert.equal(s.round.commit,await sha256(canonicalCommit(s.round)));
  await assert.rejects(()=>transition(s,vote(),catalog,13000),/locked/);assert.equal(JSON.stringify(s),before);
});
test('Twitch replayed, stale, future and duplicate messages are rejected',async()=>{
  let s=await open();const m={type:'predict',id:'twitch:123',name:'Real viewer',source:'twitch',choice:'yes',messageId:'m1',sentAt:10500};
  await assert.rejects(()=>transition(s,{...m,sentAt:9999},catalog,11000),/window/);
  await assert.rejects(()=>transition(s,{...m,sentAt:16001},catalog,11000),/window/);
  s=await transition(s,m,catalog,11000);await assert.rejects(()=>transition(s,m,catalog,11001),/Duplicate/);
  assert.deepEqual(counts(s.round),{yes:1,no:0,total:1,twitch:1,practice:0,sample:0});
});
test('the range, not its midpoint, determines whether a call can be settled',()=>{
  assert.equal(verdict(1.1,1.3,1.2),'uncertain');assert.equal(verdict(1.1,1.3,1.1),'yes');assert.equal(verdict(1.1,1.3,1.3),'uncertain');assert.equal(verdict(1.1,1.3,1.31),'no');
});
test('all three real replay outcomes retain the reviewed evidence and provenance',async()=>{
  const expected=['yes','uncertain','no'];
  for(const [i,trial] of catalog.entries()){
    let s=await open(trial.id,trial.defaultThreshold);
    for(const type of ['lock','replay','finishReplay','reveal'])s=await transition(s,{type},catalog,20000);
    assert.equal(s.round.result.verdict,expected[i]);assert.equal(s.round.result.method,'manual-frame-review');assert.equal(s.round.result.sourceHash,trial.sha256);
    assert.equal(s.round.result.low,trial.measurement.flight[0]);
  }
});
test('round reset does not move a prior sealed result or reuse its predictions',async()=>{
  let s=await open();s=await transition(s,vote(),catalog,11000);for(const type of ['lock','replay','finishReplay','reveal'])s=await transition(s,{type},catalog,20000);
  const seal=s.round.commit;s=await transition(s,{type:'open',trialId:'trial-02',threshold:1.2},catalog,30000);
  assert.equal(s.history.length,1);assert.equal(s.history[0].commit,seal);assert.equal(counts(s.round).total,0);assert.equal(s.round.result,null);
});
test('public overlay state omits viewer identities and private message ids',async()=>{
  let s=await open();s=await transition(s,vote(),catalog,11000);const view=publicState(s);
  assert.equal(view.round.predictions,undefined);assert.equal(view.round.seenMessages,undefined);assert.equal(view.round.counts.total,1);assert.equal(JSON.stringify(view).includes('Viewer'),false);
});
test('experiment votes are after the reveal and cannot be prototype properties',async()=>{
  let s=await open();await assert.rejects(()=>transition(s,{type:'nextTest',id:'practice:one',choice:'blades'},catalog),/Reveal/);
  await assert.rejects(()=>transition(s,{...vote(),id:'__proto__'},catalog),/participant/);
  for(const type of ['lock','replay','finishReplay','reveal'])s=await transition(s,{type},catalog,20000);
  await assert.rejects(()=>transition(s,{type:'nextTest',id:'__proto__',choice:'blades'},catalog),/participant/);
  await assert.rejects(()=>transition(s,{type:'nextTest',id:'practice:one',choice:'__proto__'},catalog),/option/);
  s=await transition(s,{type:'nextTest',id:'practice:one',choice:'blades'},catalog);s=await transition(s,{type:'nextTest',id:'practice:one',choice:'weight'},catalog);assert.deepEqual(publicState(s).nextTestCounts,{blades:0,weight:1,repeat:0});
});
test('a mid-round channel or threshold change is refused',async()=>{
  const s=await open();await assert.rejects(()=>transition(s,{type:'channel',channel:'otherchannel'},catalog),/Lock/);await assert.rejects(()=>transition(s,{type:'open',trialId:'trial-01',threshold:2},catalog),/Finish/);
});
