import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=fileURLToPath(new URL('.',import.meta.url));
const app=resolve(process.env.GLOSSOPIA_APP_ROOT??fileURLToPath(new URL('../../',import.meta.url)));
const {parseProject,serializeProject}=await import(pathToFileURL(resolve(app,'src/project.mjs')));
const {parse}=await import(pathToFileURL(resolve(app,'src/language-core.mjs')));
const {submitSentence,replayMission}=await import(pathToFileURL(resolve(app,'src/mission-core.mjs')));
const reference=JSON.parse(await readFile(resolve(here,'REFERENCE.json'),'utf8')),results=[];
const meanings=[{actor:'i',verb:'request',object:'lantern',quantity:1},{actor:'i',verb:'give',object:'pear',quantity:2},{actor:'i',verb:'have',object:'lantern',quantity:1}];
for(const item of reference.fixtures){
 const bytes=await readFile(resolve(here,item.path));assert.equal(bytes.length,item.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256,'Frozen reference identity');
 const project=parseProject(bytes.toString('utf8')),language=project.history[0],initial=project.sessions[0];assert.equal(language.name,item.name);assert.equal(language.grammar.order,item.order);assert.deepEqual(parseProject(serializeProject(project)),project);
 let session=initial;
 for(const [index,text]of item.player.entries()){
  const interpretation=parse(language,text);assert.equal(interpretation.status,'ok');assert.deepEqual(interpretation.meaning,meanings[index]);
  const result=submitSentence(language,session,text);session=result.session;assert.equal(result.state.stage,index+1);
  assert.deepEqual(result.state.inventory,index===0?{pear:3,lantern:0}:{pear:1,lantern:1});
 }
 const state=replayMission(language,session);assert.equal(state.complete,true);assert.equal(session.inputs.length,3);
 assert.deepEqual(state.events.filter(x=>x.speaker==='merchant'&&x.meaning).map(x=>x.text),item.trader);
 for(const text of item.wrong){const r=submitSentence(language,initial,text);assert.equal(r.session.inputs.length,1);assert.equal(r.state.stage,0);assert.deepEqual(r.state.inventory,{pear:3,lantern:0});}
 const requested=submitSentence(language,initial,item.player[0]).session,wrongPrice=submitSentence(language,requested,item.wrong_price);
 assert.equal(wrongPrice.session.inputs.length,2);assert.equal(wrongPrice.state.stage,1);assert.deepEqual(wrongPrice.state.inventory,{pear:3,lantern:0});
 const repeated=submitSentence(language,session,item.player[1]);assert.equal(repeated.session.inputs.length,4);assert.deepEqual(repeated.state.inventory,{pear:1,lantern:1});assert.equal(repeated.state.events.filter(x=>x.speaker==='merchant'&&x.meaning).length,2);
 results.push({name:item.name,order:item.order,fixture_sha256:item.sha256,core_cases_passed:true});
}
console.log(JSON.stringify({app_root:app,reference_source_commit:reference.source_commit,results}));
