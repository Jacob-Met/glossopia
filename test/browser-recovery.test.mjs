import test from 'node:test';
import assert from 'node:assert/strict';
import {createProjectRecovery,serializeRecoveryCopy} from '../src/browser-recovery.mjs';
import {parseProject} from '../src/project.mjs';
function fixture(initialRaw,parse=JSON.parse){
 let raw=initialRaw,reads=0,writes=0,serializations=0,readError=null,writeError=null,serializeError=null;
 const recovery=createProjectRecovery({read(){reads++;if(readError)throw readError;return raw;},write(text){writes++;if(writeError)throw writeError;raw=text;},parseProject:parse,serializeProject(project){serializations++;if(serializeError)throw serializeError;return JSON.stringify(project);}});
 return {recovery,raw:()=>raw,counts:()=>({reads,writes,serializations}),external:text=>raw=text,failRead:error=>readError=error,failWrite:error=>writeError=error,failSerialize:error=>serializeError=error};
}
test('all startup parse failures retain exact text and block automatic access',()=>{
 for(const original of ['{ malformed','{"schemaVersion":999}','x'.repeat(1000001),'']){
  const f=fixture(original,()=>{throw Error('Rejected project');});assert.equal(f.recovery.load().kind,'blocked');const before=f.counts();
  for(let i=0;i<3;i++)assert.equal(f.recovery.persist({edit:i}).reason,'recovery-required');
  assert.deepEqual(f.counts(),before);assert.equal(f.raw(),original);assert.deepEqual(f.recovery.copies(),[original]);
 }
});
test('valid startup continues saving the current project',()=>{
 const f=fixture('{"value":1}');assert.equal(f.recovery.load().kind,'loaded');const reads=f.counts().reads;
 assert.deepEqual(f.recovery.persist({value:2}),{ok:true});assert.equal(f.counts().reads,reads);assert.equal(f.raw(),'{"value":2}');
});
test('missing storage starts the ordinary writable path',()=>{
 const f=fixture(null);assert.deepEqual(f.recovery.load(),{kind:'empty'});assert.deepEqual(f.recovery.persist({value:1}),{ok:true});
});
test('read failure has no invented copy and needs an explicit fresh review',()=>{
 const f=fixture('unread');f.failRead(Error('Storage getter denied'));assert.equal(f.recovery.load().reason,'read-failed');assert.deepEqual(f.recovery.copies(),[]);
 const before=f.counts();assert.equal(f.recovery.persist({value:1}).reason,'recovery-required');assert.deepEqual(f.counts(),before);
 f.failRead(null);const r=f.recovery.prepareReplacement({value:1});assert.equal(r.ok,true);assert.equal(f.recovery.isBlocked(),true);assert.deepEqual(f.recovery.copies(),['unread']);
 assert.deepEqual(f.recovery.replace(r.reviewId,{value:1}),{ok:true});
});
test('a stale review never replaces changed storage and keeps both copies',()=>{
 const f=fixture('first invalid');f.recovery.load();const r=f.recovery.prepareReplacement({value:1});f.external('second invalid');
 assert.equal(f.recovery.replace(r.reviewId,{value:1}).reason,'storage-changed');assert.equal(f.raw(),'second invalid');assert.equal(f.counts().writes,0);assert.equal(f.recovery.isBlocked(),true);assert.deepEqual(f.recovery.copies(),['first invalid','second invalid']);
});
test('replacement is bound to the complete reviewed project',()=>{
 const f=fixture('invalid');f.recovery.load();const r=f.recovery.prepareReplacement({value:1});const reads=f.counts().reads;
 assert.equal(f.recovery.replace(r.reviewId,{value:2}).reason,'project-changed');assert.equal(f.counts().reads,reads);assert.equal(f.counts().writes,0);assert.equal(f.recovery.isBlocked(),true);
});
test('a new review and cancellation invalidate previous replacement decisions',()=>{
 const f=fixture('first');f.recovery.load();const one=f.recovery.prepareReplacement({value:1});f.external('second');const two=f.recovery.prepareReplacement({value:1});
 assert.equal(f.recovery.replace(one.reviewId,{value:1}).reason,'review-required');assert.deepEqual(f.recovery.copies(),['first','second']);
 f.recovery.cancelReplacement();assert.equal(f.recovery.replace(two.reviewId,{value:1}).reason,'review-required');assert.equal(f.counts().writes,0);
});
test('failed review serialization invalidates an earlier decision',()=>{
 const f=fixture('invalid');f.recovery.load();const r=f.recovery.prepareReplacement({value:1});f.failSerialize(Error('Too large'));
 assert.equal(f.recovery.prepareReplacement({value:1}).reason,'serialize-failed');f.failSerialize(null);assert.equal(f.recovery.replace(r.reviewId,{value:1}).reason,'review-required');assert.equal(f.counts().writes,0);
});
test('serialization, read and write failures do not unlock recovery',()=>{
 for(const stage of ['serialize','read','write']){
  const f=fixture('invalid');f.recovery.load();const r=f.recovery.prepareReplacement({value:1});
  if(stage==='serialize')f.failSerialize(Error('Serialize failed'));if(stage==='read')f.failRead(Error('Read failed'));if(stage==='write')f.failWrite(Error('Write failed'));
  assert.equal(f.recovery.replace(r.reviewId,{value:1}).reason,stage+'-failed');assert.equal(f.recovery.isBlocked(),true);assert.equal(f.raw(),'invalid');
  const before=f.counts();assert.equal(f.recovery.persist({value:2}).reason,'recovery-required');assert.deepEqual(f.counts(),before);
 }
});
test('successful explicit replacement enables later ordinary saves',()=>{
 const f=fixture('invalid');f.recovery.load();const r=f.recovery.prepareReplacement({value:1});assert.deepEqual(f.recovery.replace(r.reviewId,{value:1}),{ok:true});assert.equal(f.raw(),'{"value":1}');
 const reads=f.counts().reads;assert.deepEqual(f.recovery.persist({value:2}),{ok:true});assert.equal(f.counts().reads,reads);
});
test('recovery envelopes preserve UTF-16 code units through UTF-8 download and stay outside project format',async()=>{
 const cases=['',' \\r\\n','\uD800','\uDC00','\uD800\uDC00','a\uD800x\uDC00"\u0000'];
 for(const original of cases){
  const text=await new Blob([serializeRecoveryCopy(original)],{type:'application/json;charset=utf-8'}).text(),v=JSON.parse(text);
  assert.equal(v.format,'glossopia-browser-recovery');assert.equal(v.schemaVersion,1);assert.equal(v.storageKey,'glossopia-project-v1');assert.equal(v.storedText,original);
  assert.deepEqual(Array.from({length:original.length},(_,i)=>v.storedText.charCodeAt(i)),Array.from({length:original.length},(_,i)=>original.charCodeAt(i)));
  assert.throws(()=>parseProject(text),/format version 1/);
 }
});
