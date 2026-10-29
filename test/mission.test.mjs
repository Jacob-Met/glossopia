import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

// Independent consumer contract checks. Pass the isolated application's root.
const root=fileURLToPath(new URL('../',import.meta.url));
const {starterLanguage}=await import(pathToFileURL(resolve(root,'src/starter-language.mjs')));
const {startMission,submitSentence,replayMission,canPlayMission}=await import(pathToFileURL(resolve(root,'src/mission-core.mjs')));
const clone=x=>JSON.parse(JSON.stringify(x));
const v=clone(starterLanguage),initial={pear:3,lantern:0},received={pear:1,lantern:1};
let count=0;
function check(name,fn){fn();count++;console.log('PASS '+name);}
function next(session,text,version=v){return submitSentence(version,session,text);}
function rejectWithoutTrade(session,text,status,inventory,stage,version=v){
  const before=JSON.stringify(session),r=next(session,text,version);
  assert.equal(r.state.lastResult.status,status,text);
  assert.deepEqual(r.state.inventory,inventory,text);
  assert.equal(r.state.stage,stage,text);
  assert.equal(JSON.stringify(session),before,'Submitting must preserve the previous practice record');
  return r.session;
}

check('Authored request obtains an explicit two-pear offer without transferring inventory',()=>{
  const r=next(startMission(v),'mi un lum na');
  assert.equal(r.state.stage,1);assert.equal(r.state.complete,false);
  assert.deepEqual(r.state.inventory,initial);
  const offer=r.state.events.find(e=>e.status==='offer');
  assert.equal(offer.text,'mi du pon na');
  assert.deepEqual(offer.meaning,{actor:'i',verb:'request',object:'pear',quantity:2});
});
check('Authored exchange conserves the stated price and requires possession confirmation',()=>{
  const request=next(startMission(v),'mi un lum na');
  const payment=next(request.session,'mi du pon di');
  assert.deepEqual(payment.state.inventory,received);assert.equal(payment.state.complete,false);
  assert.equal(payment.state.stage,2);
  const receipt=payment.state.events.find(e=>e.status==='receipt');
  assert.equal(receipt.text,'tu un lum si');
  assert.deepEqual(receipt.meaning,{actor:'you',verb:'have',object:'lantern',quantity:1});
  const confirmation=next(payment.session,'mi un lum si');
  assert.equal(confirmation.state.complete,true);assert.deepEqual(confirmation.state.inventory,received);
});
check('Out-of-order payment and invented possession cannot create or remove inventory',()=>{
  let s=startMission(v);
  for(const text of ['mi du pon di','mi un lum si','tu un lum na','mi du lum na'])
    s=rejectWithoutTrade(s,text,'off_goal',initial,0);
});
check('Wrong price, wrong actor, wrong item and repeated requests cannot authorize payment',()=>{
  let s=next(startMission(v),'mi un lum na').session;
  for(const text of ['mi un pon di','mi tri pon di','tu du pon di','mi du lum di','mi un lum na','mi du pon na'])
    s=rejectWithoutTrade(s,text,'off_goal',initial,1);
  const paid=next(s,'mi du pon di');assert.deepEqual(paid.state.inventory,received);
});
check('Unknown, malformed and wrong-order utterances preserve the pending trade',()=>{
  let s=next(startMission(v),'mi un lum na').session;
  s=rejectWithoutTrade(s,'mi du banana di','unknown_words',initial,1);
  for(const text of ['','mi di du pon','mi du pon','mi du pon di di','mi du pon di!','mi 2 pon di'])
    s=rejectWithoutTrade(s,text,'invalid_syntax',initial,1);
  const before=JSON.stringify(s);
  for(const bad of [null,{},42,'a'.repeat(241)])assert.throws(()=>next(s,bad));
  assert.equal(JSON.stringify(s),before);
});
check('A known but unstocked object is understood without producing a trade',()=>{
  const extended=clone(v);
  extended.lexicon.push({id:'object-stone',role:'object',meaning:'stone',form:'rok',gloss:'stone',author:'independent-review',rationale:'Unstocked object probe',canonical:true});
  const s=next(startMission(extended),'mi un lum na',extended).session;
  rejectWithoutTrade(s,'mi du rok di','off_goal',initial,1,extended);
});
check('Ambiguous noncanonical object form is refused while unambiguous market forms remain playable',()=>{
  const extended=clone(v);
  for(const meaning of ['pear','lantern'])extended.lexicon.push({id:'alias-'+meaning,role:'object',meaning,form:'zel',gloss:meaning,author:'independent-review',rationale:'Ambiguity probe',canonical:false});
  assert.equal(canPlayMission(extended).available,true);
  const s=next(startMission(extended),'mi un lum na',extended).session;
  const after=rejectWithoutTrade(s,'mi du zel di','ambiguous',initial,1,extended);
  const paid=next(after,'mi du pon di',extended);assert.deepEqual(paid.state.inventory,received);
});
check('Repeated payment before and after completion cannot transfer a second lantern',()=>{
  let s=next(next(startMission(v),'mi un lum na').session,'mi du pon di').session;
  s=rejectWithoutTrade(s,'mi du pon di','off_goal',received,2);
  s=next(s,'mi un lum si').session;
  for(const text of ['mi du pon di','mi un lum na','mi un lum si'])
    s=rejectWithoutTrade(s,text,'complete',received,3);
  const a=replayMission(v,s),b=replayMission(v,s);
  assert.deepEqual(a,b);assert.deepEqual(a.inventory,received);
  assert.equal(a.events.filter(e=>e.status==='receipt').length,1);
});
check('Practice is revision-bound; a later SVO language cannot reinterpret the old session',()=>{
  const s=next(startMission(v),'mi un lum na').session;
  const old=replayMission(v,s),changed=clone(v);
  changed.versionId='luma-v2';changed.number=2;changed.parentVersionId='luma-v1';changed.grammar.order='SVO';
  assert.throws(()=>replayMission(changed,s),/different language version/);
  assert.throws(()=>next(s,'mi di du pon',changed),/different language version/);
  assert.deepEqual(replayMission(v,s),old);
  let fresh=startMission(changed,'svo-practice');
  for(const text of ['mi na un lum','mi di du pon','mi si un lum'])fresh=next(fresh,text,changed).session;
  assert.equal(replayMission(changed,fresh).complete,true);
  assert.deepEqual(replayMission(changed,fresh).inventory,received);
});
console.log(JSON.stringify({suite:'independent-mission-consumer-review',passed:count,scope:'Core semantic behavior only; no browser, package or newcomer comprehension claim'}));
