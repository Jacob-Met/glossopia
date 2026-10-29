import test from 'node:test';
import assert from 'node:assert/strict';
import {starterLanguage} from '../src/starter-language.mjs';
import {compose,parse,proposeRevision,acceptRevision} from '../src/language-core.mjs';
import {analyzeMissionCompatibility,canPlayMission,startMission,replayMission} from '../src/mission-core.mjs';
import {createProject,validateProject,addPractice,serializeProject} from '../src/project.mjs';
const clone=x=>JSON.parse(JSON.stringify(x)),author='Independent compatibility reviewer';
const entry=(id,role,meaning,form,canonical=false)=>({id,role,meaning,form,canonical,gloss:String(meaning),author,rationale:'Independent requirement reference'});
const required=[
  ['player-request','player',{actor:'i',verb:'request',object:'lantern',quantity:1}],
  ['player-give','player',{actor:'i',verb:'give',object:'pear',quantity:2}],
  ['player-confirm','player',{actor:'i',verb:'have',object:'lantern',quantity:1}],
  ['merchant-price','merchant',{actor:'i',verb:'request',object:'pear',quantity:2}],
  ['merchant-receipt','merchant',{actor:'you',verb:'have',object:'lantern',quantity:1}]
];
function narrow(){const v=clone(starterLanguage);v.examples=v.examples.filter(e=>e.id==='inventory-start');return v;}
function collision(base){return proposeRevision(base,{id:'basket-collision',author,rationale:'Unpracticed required statement',addEntries:[entry('basket','object','basket','lum',true)]});}
function correspondence(v){const r=analyzeMissionCompatibility(v);assert.equal(canPlayMission(v).available,r.available);if(r.available)assert.equal(startMission(v).versionId,v.versionId);else assert.throws(()=>startMission(v));return r;}

test('all five player and merchant requirements are explicit and match actual composition',()=>{
  const v=clone(starterLanguage),r=correspondence(v);
  assert.equal(r.versionId,'luma-v1');assert.equal(r.missionId,'light-for-the-crossing');assert.equal(r.available,true);
  assert.deepEqual(r.summary,{requiredCount:5,readyCount:5,unavailableCount:0});assert.equal(r.statements.length,5);
  for(const [id,speaker,meaning] of required){const s=r.statements.find(s=>s.id===id);assert.ok(s);assert.equal(s.speaker,speaker);assert.ok(s.purpose.length);assert.deepEqual(s.meaning,meaning);assert.deepEqual(s.composition,compose(v,meaning));assert.equal(s.available,true);assert.deepEqual(parse(v,s.composition.text).meaning,meaning);}
});

test('merchant-only ambiguity is detected even when all player expressions still work',()=>{
  const v=narrow();v.lexicon.push(entry('alias-i-tu','actor','i','tu'));
  const r=correspondence(v);assert.equal(r.available,false);assert.deepEqual(r.summary,{requiredCount:5,readyCount:4,unavailableCount:1});
  for(const s of r.statements.filter(s=>s.speaker==='player'))assert.equal(s.available,true);
  assert.equal(r.statements.find(s=>s.id==='merchant-receipt').composition.status,'ambiguous');
  assert.equal(r.statements.find(s=>s.id==='merchant-price').available,true);
});

test('canonical ambiguity is engine incompatibility even when an accepted synonym works',()=>{
  const v=narrow();v.lexicon.push(entry('light-alias','object','lantern','light'));
  const p=collision(v),r=correspondence(p.candidate);
  assert.equal(p.impact.summary.changed,0);assert.equal(p.impact.summary.unresolved,0);
  assert.equal(r.available,false);assert.deepEqual(r.summary,{requiredCount:5,readyCount:2,unavailableCount:3});
  const request=r.statements.find(s=>s.id==='player-request');assert.equal(request.composition.status,'ambiguous');assert.equal(request.composition.text,'mi un lum na');
  assert.equal(parse(p.candidate,'mi un light na').status,'ok');assert.deepEqual(parse(p.candidate,'mi un light na').meaning,required[0][2]);
});

test('missing words and unresolved preferred form selection remain distinct failures',()=>{
  const missing=narrow();missing.lexicon=missing.lexicon.filter(e=>e.id!=='actor-you');
  const missingReport=correspondence(missing),receipt=missingReport.statements.find(s=>s.id==='merchant-receipt');
  assert.equal(receipt.composition.status,'unexpressible');assert.ok(receipt.composition.issues.some(i=>i.code==='NO_ACCEPTED_WORD'));
  const choice=narrow();choice.lexicon.find(e=>e.id==='object-pear').canonical=false;choice.lexicon.push(entry('pear-alias','object','pear','poma'));
  const choiceReport=correspondence(choice);
  for(const id of ['player-give','merchant-price']){const s=choiceReport.statements.find(s=>s.id===id);assert.equal(s.available,false);assert.equal(s.composition.status,'choice_required');assert.ok(s.composition.issues.some(i=>i.code==='FORM_CHOICE_REQUIRED'));}
  assert.equal(choiceReport.summary.unavailableCount,2);
});

test('preview separates older playable versions from a newly incompatible accepted version without changing acceptance',()=>{
  const v=narrow();let project=createProject(v);project=addPractice(project,v.versionId);
  const before=serializeProject(project),p=collision(v),proposalBefore=JSON.stringify(p);
  assert.equal(analyzeMissionCompatibility(v).available,true);assert.equal(analyzeMissionCompatibility(p.candidate).available,false);
  const history=acceptRevision(project.history,p,{accept:true,author});
  const accepted=validateProject({...project,history,currentVersionId:history.at(-1).versionId,viewVersionId:history.at(-1).versionId});
  assert.equal(correspondence(accepted.history[0]).available,true);assert.equal(correspondence(accepted.history[1]).available,false);
  assert.deepEqual(accepted.sessions,project.sessions);assert.equal(accepted.activeSessionId,project.activeSessionId);
  for(const s of accepted.sessions)assert.deepEqual(replayMission(accepted.history[0],s).inventory,{pear:3,lantern:0});
  assert.equal(serializeProject(project),before);assert.equal(JSON.stringify(p),proposalBefore);
});

test('a valid incomplete latest language is reported as already incompatible rather than attributed to every new proposal',()=>{
  const v=narrow(),project=createProject(v),p=collision(v),history=acceptRevision(project.history,p,{accept:true,author});
  const current=clone(history[1]);current.lexicon=current.lexicon.filter(e=>e.id!=='actor-you');
  const accepted=validateProject({...project,history:[history[0],current],currentVersionId:current.versionId,viewVersionId:current.versionId});
  const next=proposeRevision(current,{id:'unrelated-next',author,rationale:'Add unused cloud',addEntries:[entry('cloud','object','cloud','nubi',true)]});
  const before=JSON.stringify(accepted),a=correspondence(current),b=correspondence(next.candidate);
  assert.equal(a.available,false);assert.equal(b.available,false);assert.deepEqual(a.summary,b.summary);
  assert.equal(a.versionId,'luma-v2');assert.equal(b.versionId,'luma-v3');assert.equal(JSON.stringify(accepted),before);
});

test('analysis returns its own data without mutating caller language or previous reports',()=>{
  const v=clone(starterLanguage),before=JSON.stringify(v),first=analyzeMissionCompatibility(v),snapshot=JSON.stringify(first);
  analyzeMissionCompatibility(collision(narrow()).candidate);
  assert.equal(JSON.stringify(v),before);assert.equal(JSON.stringify(first),snapshot);
});
