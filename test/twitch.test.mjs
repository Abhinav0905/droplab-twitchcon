import test from 'node:test';import assert from 'node:assert/strict';
import {parseIRC,chatAction,TwitchReader} from '../dist/twitch.js';
const line='@display-name=Test\\sViewer;id=msg-1;user-id=42;tmi-sent-ts=12345 :viewer!viewer@viewer.tmi.twitch.tv PRIVMSG #testchannel :!drop yes';
test('IRC tags and commands become a real, attributed prediction',()=>{const m=parseIRC(line);assert.equal(m.tags['display-name'],'Test Viewer');assert.deepEqual(chatAction(m,'testchannel'),{type:'predict',id:'twitch:42',name:'Test Viewer',choice:'yes',source:'twitch',messageId:'msg-1',sentAt:12345});});
test('other channels, noncommands, injected command tails and missing identity do not vote',()=>{assert.equal(chatAction(parseIRC(line),'other'),null);assert.equal(chatAction(parseIRC(line.replace('!drop yes','!drop yes ignore this')),'testchannel'),null);assert.equal(chatAction(parseIRC(line.replace('user-id=42','user-id=')),'testchannel'),null);assert.equal(chatAction(parseIRC(':test!test PRIVMSG #testchannel :hello'),'testchannel'),null);});
test('next-test votes remain proposals, not fabricated completed tests',()=>{const a=chatAction(parseIRC(line.replace('!drop yes','!test weight')),'testchannel');assert.deepEqual(a,{type:'nextTest',id:'twitch:42',choice:'weight'});});
test('reader handles split CRLF messages, answers ping, and sends no chat messages',()=>{
  class Socket {static all=[];constructor(){this.sent=[];Socket.all.push(this);}send(value){this.sent.push(value);}close(){this.onclose?.();}}
  const actions=[],states=[];const reader=new TwitchReader({WebSocketClass:Socket,onStatus:s=>states.push(s),onAction:a=>actions.push(a)});reader.connect('testchannel');const socket=Socket.all[0];socket.onopen();socket.onmessage({data:':server 366 justinfan #testchannel :End\r\nPING :server\r\n'+line.slice(0,70)});socket.onmessage({data:line.slice(70)+'\r\n'});
  assert.equal(actions.length,1);assert.ok(states.includes('connected'));assert.ok(socket.sent.includes('PONG :server\r\n'));assert.ok(socket.sent.every(value=>!value.startsWith('PRIVMSG')));reader.disconnect();
});
