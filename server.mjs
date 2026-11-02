import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {freshState,transition,publicState} from './dist/round.js';
const root=resolve(import.meta.dirname,'dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.mp4':'video/mp4','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.txt':'text/plain'};
const rooms=new Map();
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
async function body(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>8192)throw new Error('Request is too large.');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString()||'{}');}
function authorized(req,room){const key=(req.headers.authorization||'').replace(/^Bearer /,'');const a=Buffer.from(key),b=Buffer.from(room.key);return a.length===b.length&&timingSafeEqual(a,b);}
export function makeServer(){
  return createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    try{
      if(url.pathname.startsWith('/api/')){
        if(req.method==='POST'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return json(res,403,{error:'Use the same origin as the studio.'});
        if(req.method==='POST'&&!String(req.headers['content-type']).includes('application/json'))return json(res,415,{error:'Use JSON.'});
        if(url.pathname==='/api/health')return json(res,200,{app:'DropLab',version:'1.0.0',overlay:true});
        if(url.pathname==='/api/rooms'&&req.method==='POST'){
          for(const [id,r] of rooms)if(Date.now()-r.updatedAt>12*3600000){for(const s of r.subscribers)s.end();rooms.delete(id);}
          if(rooms.size>=30)return json(res,429,{error:'Too many studio sessions. Restart the local host to clear them.'});
          const id=randomBytes(8).toString('hex'),key=randomBytes(24).toString('hex');
          const room={key,state:freshState(),subscribers:new Set(),updatedAt:Date.now(),queue:Promise.resolve()};rooms.set(id,room);return json(res,201,{roomId:id,hostKey:key,state:room.state});
        }
        const match=/^\/api\/rooms\/([a-f0-9]{16})(?:\/(action|events))?$/.exec(url.pathname);
        if(!match)return json(res,404,{error:'Unknown endpoint.'});
        const room=rooms.get(match[1]);if(!room)return json(res,404,{error:'This studio session has ended. Open a new session.'});
        if(req.method==='GET'&&match[2]==='events'){
          res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
          res.write('data: '+JSON.stringify(publicState(room.state))+'\n\n');room.subscribers.add(res);
          const ping=setInterval(()=>res.write(': keepalive\n\n'),15000);req.on('close',()=>{clearInterval(ping);room.subscribers.delete(res);});return;
        }
        if(req.method==='GET'&&!match[2])return json(res,200,authorized(req,room)?room.state:publicState(room.state));
        if(req.method==='POST'&&match[2]==='action'){
          if(!authorized(req,room))return json(res,403,{error:'Only the studio host can change this round.'});
          const action=await body(req);const catalog=JSON.parse(await readFile(resolve(root,'trials.json'),'utf8'));
          const operation=room.queue.then(async()=>{room.state=await transition(room.state,action,catalog);room.updatedAt=Date.now();const data='data: '+JSON.stringify(publicState(room.state))+'\n\n';for(const subscriber of room.subscribers)subscriber.write(data);return room.state;});
          room.queue=operation.catch(()=>{});try{return json(res,200,await operation);}catch(error){return json(res,409,{error:error.message});}
        }
        return json(res,405,{error:'Method not allowed.'});
      }
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
      let pathname=decodeURIComponent(url.pathname);if(pathname==='/')pathname='/index.html';
      const file=resolve(root,'.'+pathname);if(!file.startsWith(root+sep)){res.writeHead(403);return res.end();}
      const info=await stat(file);if(!info.isFile())throw new Error('Not found');
      const headers={'Content-Type':types[extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'};
      let start=0,end=info.size-1,status=200;
      if(req.headers.range){const r=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!r||(!r[1]&&!r[2])){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});return res.end();}if(!r[1])start=Math.max(0,info.size-Number(r[2]));else start=Number(r[1]);if(r[1]&&r[2])end=Math.min(end,Number(r[2]));if(start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});return res.end();}status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;}
      headers['Content-Length']=end-start+1;res.writeHead(status,headers);if(req.method==='HEAD')return res.end();createReadStream(file,{start,end}).pipe(res);
    }catch(error){if(url.pathname.startsWith('/api/'))return json(res,400,{error:error.message});res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const port=Number(process.env.PORT)||8768;makeServer().listen(port,'127.0.0.1',()=>console.log(`DropLab studio: http://127.0.0.1:${port}`));}
