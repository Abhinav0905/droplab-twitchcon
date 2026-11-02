import test from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';import {makeServer} from '../server.mjs';
test('local host protects controls, strips overlay identities and supports MP4 seeking',async()=>{
  const server=makeServer();server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
  try{
    const create=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(create.status,201);const room=await create.json();
    const action={type:'open',trialId:'trial-01',threshold:1};const path=base+'/api/rooms/'+room.roomId+'/action';
    assert.equal((await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action)})).status,403);
    assert.equal((await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+room.hostKey,Origin:'https://unrelated.example'},body:JSON.stringify(action)})).status,403);
    const post=async a=>fetch(path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+room.hostKey},body:JSON.stringify(a)});
    assert.equal((await post(action)).status,200);await post({type:'predict',id:'practice:me',name:'Private Name',choice:'yes',source:'practice'});
    const publicView=await(await fetch(base+'/api/rooms/'+room.roomId)).json();assert.equal(publicView.round.predictions,undefined);assert.equal(publicView.round.counts.total,1);
    await post({type:'lock'});assert.equal((await post({type:'predict',id:'practice:late',name:'Late',choice:'no',source:'practice'})).status,409);
    const range=await fetch(base+'/media/trial-01.mp4',{headers:{Range:'bytes=0-99'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,100);assert.match(range.headers.get('content-range'),/^bytes 0-99\//);
    const badRange=await fetch(base+'/media/trial-01.mp4',{headers:{Range:'bytes=999999999-'}});assert.equal(badRange.status,416);
    assert.equal((await fetch(base+'/%2e%2e%2fpackage.json')).status,403);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
