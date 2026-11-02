import {readdir,readFile,stat} from 'node:fs/promises';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
let checks=0;
for(const file of await readdir('dist'))if(file.endsWith('.js')){const r=spawnSync(process.execPath,['--check','dist/'+file],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);checks++;}
const html=await readFile('dist/index.html','utf8'),js=await readFile('dist/studio.js','utf8');const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'Duplicate HTML ids');
for(const [,id] of js.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(id),'Missing HTML id: '+id);
for(const [,path] of html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)){if(!/^(http|\.\/)/.test(path))await stat('dist/'+path);}
const trials=JSON.parse(await readFile('dist/trials.json'));for(const t of trials){assert.equal(createHash('sha256').update(await readFile('dist/'+t.file)).digest('hex'),t.sha256,'Media hash changed');assert.ok(t.measurement.release[1]<t.measurement.landing[0]);assert.ok(t.measurement.landing[1]<t.duration);assert.ok(Math.abs(t.measurement.flight[0]-(t.measurement.landing[0]-t.measurement.release[1]))<.00001);checks++;}
console.log(`Passed ${checks} module/media checks, HTML references and timing bounds.`);
