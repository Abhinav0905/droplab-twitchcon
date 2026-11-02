import test from 'node:test';
import assert from 'node:assert/strict';
import {DropTimer,findPaper} from '../dist/tracker.js';
const point=y=>({point:{x:.5,y}});
test('measures crossings between frames and reports the bracket range',()=>{
  const timer=new DropTimer({top:.25,bottom:.75});
  let result;
  for(let i=0;i<=40;i++)result=timer.update(i/30,point(.1+i*.02));
  assert.equal(result.status,'candidate');
  assert.ok(Math.abs(result.seconds-5/6)<1e-9);
  assert.ok(result.frameMin<=result.seconds&&result.frameMax>=result.seconds);
});
test('never infers a start from an object first seen below the upper line',()=>{
  const timer=new DropTimer();
  for(let i=0;i<10;i++)assert.equal(timer.update(i/30,point(.4+i*.04)),null);
  assert.equal(timer.state,'waiting');
});
test('rejects tracking loss during transit',()=>{
  const timer=new DropTimer();timer.update(0,point(.24));timer.update(.03,point(.26));
  assert.equal(timer.update(.2,{point:null}).status,'rejected');
});
test('rejects a large frame gap through the upper crossing',()=>{
  const timer=new DropTimer();timer.update(0,point(.24));
  assert.equal(timer.update(.3,point(.28)).status,'rejected');
});
test('rejects competing detections after the upper crossing',()=>{
  const timer=new DropTimer();timer.update(0,point(.24));timer.update(.03,point(.26));
  assert.equal(timer.update(.06,{point:null,ambiguous:true,reason:'Two objects'}).reason,'Two objects');
});
test('rejects backward video time',()=>{
  const timer=new DropTimer();timer.update(2,point(.1));
  assert.equal(timer.update(1,point(.2)).status,'rejected');
});
test('rejects a teleporting detection',()=>{
  const timer=new DropTimer();timer.update(0,point(.24));timer.update(.03,point(.26));
  assert.equal(timer.update(.06,point(.8)).status,'rejected');
});
test('rejects return above upper line after timing starts',()=>{
  const timer=new DropTimer();timer.update(0,point(.24));timer.update(.03,point(.26));
  assert.equal(timer.update(.06,point(.2)).status,'rejected');
});
function frame(rects){
  const width=100,height=100,data=new Uint8ClampedArray(width*height*4);
  for(const [x,y,w,h]of rects)for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)data.set([245,245,245,255],(yy*width+xx)*4);
  return {data,width,height};
}
test('finds a single contrasting object inside the measurement area',()=>{
  const found=findPaper(frame([[40,20,10,10]]),[245,245,245]);
  assert.ok(Math.abs(found.point.x-.445)<.001);assert.ok(Math.abs(found.point.y-.245)<.001);
});
test('rejects similarly sized matching objects',()=>{
  assert.equal(findPaper(frame([[30,20,10,10],[60,40,10,10]]),[245,245,245]).ambiguous,true);
});
test('rejects a matching background instead of measuring it',()=>{
  assert.equal(findPaper(frame([[10,10,80,80]]),[245,245,245]).point,null);
});
test('color detection and timing together recover a generated constant-speed transit',()=>{
  const timer=new DropTimer({top:.25,bottom:.75});let result;
  for(let i=0;i<100;i++)result=timer.update(i/30,findPaper(frame([[45,10+Math.floor(i*.7),8,8]]),[245,245,245]));
  assert.equal(result.status,'candidate');
  assert.ok(Math.abs(result.seconds-(50/(.7*30)))<1/30);
});
test('generated object occlusion cannot become an accepted result',()=>{
  const timer=new DropTimer({top:.25,bottom:.75});let result;
  for(let i=0;i<100;i++)result=timer.update(i/30,findPaper(frame(i>=45&&i<=52?[]:[[45,10+Math.floor(i*.7),8,8]]),[245,245,245]));
  assert.equal(result.status,'rejected');
});
