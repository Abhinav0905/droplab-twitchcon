// Conservative color tracking for a fixed camera and one contrasting paper object.
// This is a prototype. Frame timing bounds do not cover tracking or setup error.
export function findPaper({data, width, height}, color, tolerance = 70) {
  const mask = new Uint8Array(width * height);
  const xmin = Math.floor(width * .1), xmax = Math.ceil(width * .9);
  const ymin = Math.floor(height * .04), ymax = Math.ceil(height * .96);
  for (let y = ymin; y < ymax; y++) for (let x = xmin; x < xmax; x++) {
    const i = y * width + x, p = i * 4;
    const d = (data[p]-color[0])**2 + (data[p+1]-color[1])**2 + (data[p+2]-color[2])**2;
    if (d < tolerance ** 2) mask[i] = 1;
  }
  const queue = new Int32Array(width * height), blobs = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    let head=0, tail=1, count=0, sx=0, sy=0;
    queue[0]=i; mask[i]=0;
    while (head<tail) {
      const n=queue[head++], x=n%width, y=Math.floor(n/width);
      count++; sx+=x; sy+=y;
      for (const next of [x>0?n-1:-1, x<width-1?n+1:-1, y>0?n-width:-1, y<height-1?n+width:-1]) {
        if (next>=0 && mask[next]) {mask[next]=0;queue[tail++]=next;}
      }
    }
    if (count>=6) blobs.push({count,x:sx/count/width,y:sy/count/height});
  }
  blobs.sort((a,b)=>b.count-a.count);
  if (!blobs.length) return {point:null, reason:'Paper is not visible'};
  if (blobs[0].count>width*height*.08) return {point:null,reason:'Too much of the frame matches the paper'};
  if (blobs[1] && blobs[1].count>=blobs[0].count*.5) return {point:null,reason:'More than one matching object',ambiguous:true};
  return {point:blobs[0]};
}

function crossing(a,b,line) {
  return {time:a.t+(b.t-a.t)*(line-a.y)/(b.y-a.y),lo:a.t,hi:b.t};
}

export class DropTimer {
  constructor({top=.25,bottom=.78,maxGap=.12,maxJump=.18,maxDuration=12}={}) {
    if (!(top>0 && bottom>top && bottom<1)) throw new Error('Invalid measurement lines');
    Object.assign(this,{top,bottom,maxGap,maxJump,maxDuration,state:'waiting',previous:null,start:null,lastTimestamp:null});
  }
  reject(reason) {this.state='rejected';this.result={status:'rejected',reason};return this.result;}
  update(t, detection) {
    if (this.state==='complete' || this.state==='rejected') return this.result;
    if (!Number.isFinite(t) || (this.lastTimestamp!==null && t<=this.lastTimestamp)) return this.reject('Video time did not advance');
    this.lastTimestamp=t;
    if (this.start && t-this.start.time>this.maxDuration) return this.reject('Drop took too long or left the frame');
    if (detection.ambiguous && this.start) return this.reject(detection.reason);
    const p=detection.point;
    if (!p) {
      if (this.start && this.previous && t-this.previous.t>this.maxGap) return this.reject('Tracking was lost during the measured drop');
      if (!this.start) this.previous=null;
      return null;
    }
    const next={t,x:p.x,y:p.y}, prev=this.previous;
    if (prev && (t-prev.t>this.maxGap || Math.hypot(p.x-prev.x,p.y-prev.y)>this.maxJump)) {
      if (this.start || (prev.y<this.top && p.y>=this.top)) return this.reject('Frames or tracking changed too abruptly');
      this.previous=next; return null;
    }
    if (this.start && p.y<this.top-.025) return this.reject('Paper crossed back above the start line');
    if (!this.start && prev && prev.y<this.top && p.y>=this.top) {
      this.start=crossing(prev,next,this.top);this.state='measuring';
    }
    if (this.start && prev && prev.y<this.bottom && p.y>=this.bottom) {
      const end=crossing(prev,next,this.bottom);
      const seconds=end.time-this.start.time;
      if (seconds<.1) return this.reject('Transit is too short for this camera check');
      this.state='complete';
      this.result={status:'candidate',seconds,start:this.start.time,end:end.time,
        frameMin:Math.max(0,end.lo-this.start.hi),frameMax:end.hi-this.start.lo};
      return this.result;
    }
    this.previous=next;return null;
  }
}
