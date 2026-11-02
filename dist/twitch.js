export function parseIRC(line) {
  let rest=line,tags={},prefix='';
  if(rest.startsWith('@')){const i=rest.indexOf(' ');if(i<0)return null;for(const part of rest.slice(1,i).split(';')){const split=part.indexOf('=');const key=split<0?part:part.slice(0,split);const value=split<0?'':part.slice(split+1);tags[key]=value.replace(/\\([s:nr\\])/g,(_,x)=>({s:' ',':':';',n:'\n',r:'\r','\\':'\\'})[x]);}rest=rest.slice(i+1);}
  if(rest.startsWith(':')){const i=rest.indexOf(' ');if(i<0)return null;prefix=rest.slice(1,i);rest=rest.slice(i+1);}
  const split=rest.indexOf(' :');const text=split<0?'':rest.slice(split+2);const words=(split<0?rest:rest.slice(0,split)).split(' ');
  return {tags,prefix,command:words.shift(),params:words,text};
}
export function chatAction(message,channel) {
  if(message?.command!=='PRIVMSG'||message.params[0]!==`#${channel}`)return null;
  const match=/^!drop\s+(yes|no)\s*$/i.exec(message.text);
  const next=/^!test\s+(blades|weight|repeat)\s*$/i.exec(message.text);
  if(!match&&!next)return null;
  const uid=message.tags['user-id'];if(!/^\d+$/.test(uid||''))return null;
  const name=message.tags['display-name']||message.prefix.split('!')[0];
  if(next)return {type:'nextTest',id:'twitch:'+uid,choice:next[1].toLowerCase()};
  return {type:'predict',id:'twitch:'+uid,name,choice:match[1].toLowerCase(),source:'twitch',messageId:message.tags.id,sentAt:Number(message.tags['tmi-sent-ts'])};
}
export class TwitchReader {
  constructor({onStatus,onAction,onActivity,WebSocketClass=globalThis.WebSocket}) {Object.assign(this,{onStatus,onAction,onActivity,WebSocketClass});this.socket=null;this.buffer='';this.generation=0;}
  connect(channel,{username,token}={}) {
    if(!/^[a-z0-9_]{1,25}$/.test(channel))throw new Error('Enter a Twitch channel name.');
    this.disconnect();const generation=++this.generation;this.buffer='';this.channel=channel;
    const nick=username||'justinfan'+Math.floor(100000+Math.random()*900000);
    if(username&&!/^[a-z0-9_]{1,25}$/.test(username))throw new Error('Invalid Twitch login name.');
    if(token&&/[\r\n\s]/.test(token))throw new Error('Invalid access token.');
    const socket=this.socket=new this.WebSocketClass('wss://irc-ws.chat.twitch.tv:443');this.onStatus('connecting','Connecting to Twitch…');
    this.timeout=setTimeout(()=>{if(generation===this.generation){this.onStatus('error','Twitch did not confirm the channel. Check the name and reconnect, or try the recorded demo.');socket.close();}},15000);
    socket.onopen=()=>{
      if(generation!==this.generation)return;
      socket.send('CAP REQ :twitch.tv/tags twitch.tv/commands\r\n');
      socket.send(`PASS ${token?'oauth:'+token.replace(/^oauth:/,''):'SCHMOOPIIE'}\r\n`);
      socket.send(`NICK ${nick}\r\n`);socket.send(`JOIN #${channel}\r\n`);
    };
    socket.onmessage=event=>{
      if(generation!==this.generation)return;
      this.buffer+=String(event.data);if(this.buffer.length>100000){this.onStatus('error','Unexpected chat response. Reconnect to continue.');socket.close();return;}
      const lines=this.buffer.split('\r\n');this.buffer=lines.pop();
      for(const line of lines){
        const message=parseIRC(line);if(!message)continue;
        if(message.command==='PING'){socket.send('PONG :'+(message.text||message.params[0])+'\r\n');continue;}
        if((message.command==='366'&&message.params.includes('#'+channel))||(message.command==='ROOMSTATE'&&message.params[0]==='#'+channel)){clearTimeout(this.timeout);this.onStatus('connected',`Reading #${channel} · no messages are sent`);}
        if(message.command==='NOTICE'){this.onStatus('error',message.text||'Twitch rejected the connection.');}
        if(message.command==='RECONNECT'){clearTimeout(this.timeout);socket.close();this.onStatus('error','Twitch requested a reconnect. Lock the round, then reconnect.');}
        if(message.command==='PRIVMSG'&&message.params[0]==='#'+channel){this.onActivity?.();const action=chatAction(message,channel);if(action)this.onAction(action);}
      }
    };
    socket.onerror=()=>{if(generation===this.generation)this.onStatus('error','Twitch connection failed. Check your network or use the recorded demo.');};
    socket.onclose=()=>{clearTimeout(this.timeout);if(generation===this.generation)this.onStatus('disconnected','Twitch chat disconnected. Reconnect before another live round.');};
  }
  disconnect(){this.generation++;clearTimeout(this.timeout);if(this.socket){this.socket.close();this.socket=null;}}
}
