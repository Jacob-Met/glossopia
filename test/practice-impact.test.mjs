import test from 'node:test';
import assert from 'node:assert/strict';
import {starterLanguage} from '../src/starter-language.mjs';
import {proposeRevision,acceptRevision,parse} from '../src/language-core.mjs';
import {createProject,validateProject,addPractice,serializeProject} from '../src/project.mjs';
import {submitSentence,replayMission} from '../src/mission-core.mjs';
import {analyzePracticeImpact} from '../src/practice-impact.mjs';

const author='Independent consumer test';
const entry=(id,meaning,form,canonical=true)=>({id,role:'object',meaning,form,gloss:meaning,author,rationale:'Independent reference',canonical});
const clone=x=>JSON.parse(JSON.stringify(x));
function say(project,text){
  const session=project.sessions.find(s=>s.id===project.activeSessionId),version=project.history.find(v=>v.versionId===session.versionId);
  const next=submitSentence(version,session,text).session;
  return validateProject({...project,sessions:project.sessions.map(s=>s.id===session.id?next:s)});
}
function fixture(){
  let project=createProject(starterLanguage);
  project=say(project,'mi un selu na');project=say(project,'mi un lum na');
  const add=proposeRevision(project.history[0],{id:'add-reference-words',author,rationale:'Make actual learner usage possible',addEntries:[entry('object-basket','basket','selu'),entry('alias-pear','pear','zol',false),entry('alias-lantern','lantern','zol',false)]});
  const history=acceptRevision(project.history,add,{accept:true,author});
  project=validateProject({...project,history,currentVersionId:history.at(-1).versionId,viewVersionId:history.at(-1).versionId});
  project=addPractice(project,project.currentVersionId);
  for(const text of ['mi un selu na','mi un selu na','mi un wug na','mi un zol na','mi un lum na'])project=say(project,text);
  const base=project.history.at(-1),proposal=proposeRevision(base,{id:'rename-reference-basket',author,rationale:'Check actual use rather than only authored examples',wordChanges:[{entryId:'object-basket',form:'kora'}]});
  return {project,base,proposal};
}
const rows=result=>result.groups.flatMap(g=>g.sessions.flatMap(s=>s.rows));
const at=(result,sessionId,inputIndex)=>rows(result).find(r=>r.sessionId===sessionId&&r.inputIndex===inputIndex);

test('actual saved usage exposes two unresolved meanings despite zero changed authored examples',()=>{
  const {project,proposal}=fixture();
  assert.equal(proposal.impact.summary.changed,0);
  const impact=analyzePracticeImpact(project,proposal.candidate);
  assert.deepEqual(impact.summary,{sessionCount:2,utteranceCount:7,preservedCount:2,changedMeaningCount:0,unresolvedMeaningCount:2,unverifiedOriginalCount:3,affectedCount:2,verifiedEquivalentCount:4});
  assert.equal(impact.candidateVersionId,'luma-v3');
  for(const index of [0,1]){
    const row=at(impact,'practice-2',index);
    assert.equal(row.sourceVersionId,'luma-v2');assert.equal(row.text,'mi un selu na');
    assert.equal(row.original.status,'ok');assert.equal(row.candidate.status,'unknown_words');
    assert.equal(row.classification,'meaning_unresolved');assert.equal(row.affected,true);
    assert.equal(row.equivalent.status,'verified');assert.equal(row.equivalent.text,'mi un kora na');
    assert.deepEqual(row.equivalent.meaning,{actor:'i',verb:'request',object:'basket',quantity:1});
    assert.deepEqual(parse(proposal.candidate,row.equivalent.text).meaning,row.original.meaning);
  }
});

test('older source versions and unverified inputs never acquire invented intent',()=>{
  const {project,proposal}=fixture(),impact=analyzePracticeImpact(project,proposal.candidate);
  const old=at(impact,'practice-1',0);
  assert.equal(old.sourceVersionId,'luma-v1');assert.equal(old.original.versionId,'luma-v1');
  assert.equal(old.original.status,'unknown_words');assert.equal(old.original.meaning,null);
  assert.equal(parse(project.history[1],old.text).status,'ok','The wrong source version would appear to understand this');
  for(const [session,index,status] of [['practice-1',0,'unknown_words'],['practice-2',2,'unknown_words'],['practice-2',3,'ambiguous']]){
    const row=at(impact,session,index);
    assert.equal(row.original.status,status);assert.equal(row.classification,'original_intent_unverified');
    assert.equal(row.original.meaning,null);assert.equal(row.affected,false);
    assert.equal(row.equivalent.status,'not_attempted');assert.equal(row.equivalent.reason,'original_intent_unverified');
  }
  const ambiguous=at(impact,'practice-2',3);
  assert.deepEqual(ambiguous.original.readings.map(r=>r.meaning.object).sort(),['lantern','pear']);
});

test('duplicate texts retain separate traceable occurrence references',()=>{
  const {project,proposal}=fixture(),impact=analyzePracticeImpact(project,proposal.candidate);
  assert.equal(rows(impact).length,7);
  assert.deepEqual(rows(impact).filter(r=>r.text==='mi un selu na').map(r=>[r.sourceVersionId,r.sessionId,r.inputIndex]),[
    ['luma-v1','practice-1',0],['luma-v2','practice-2',0],['luma-v2','practice-2',1]
  ]);
  assert.equal(new Set(rows(impact).map(r=>`${r.sessionId}:${r.inputIndex}`)).size,7);
});

test('an unused new word preserves all previously verified utterances',()=>{
  const {project,base}=fixture();
  const candidate=proposeRevision(base,{id:'add-unused-reference',author,rationale:'Unused vocabulary',addEntries:[entry('object-cloud','cloud','nubi')]}).candidate;
  const impact=analyzePracticeImpact(project,candidate);
  assert.equal(impact.summary.affectedCount,0);assert.equal(impact.summary.preservedCount,4);
  assert.equal(impact.summary.unverifiedOriginalCount,3);
  for(const row of rows(impact).filter(r=>r.original.status==='ok')){
    assert.equal(row.classification,'meaning_preserved');assert.deepEqual(row.candidate.meaning,row.original.meaning);
  }
  const old=at(impact,'practice-1',0);
  assert.equal(old.original.status,'unknown_words');assert.equal(old.candidate.status,'ok');
  assert.equal(old.classification,'original_intent_unverified');assert.equal(old.equivalent.status,'not_attempted');
});

test('candidate ambiguity cannot claim a verified equivalent',()=>{
  const {project,base}=fixture();
  const candidate=proposeRevision(base,{id:'ambiguous-reference',author,rationale:'Disconfirm unique expression',addEntries:[entry('object-chest','chest','selu')]}).candidate;
  const impact=analyzePracticeImpact(project,candidate);
  for(const index of [0,1]){
    const row=at(impact,'practice-2',index);
    assert.equal(row.original.status,'ok');assert.equal(row.candidate.status,'ambiguous');
    assert.equal(row.classification,'meaning_unresolved');assert.equal(row.affected,true);
    assert.equal(row.equivalent.status,'unavailable');assert.equal(row.equivalent.text,undefined);
    assert.deepEqual(row.candidate.readings.map(r=>r.meaning.object).sort(),['basket','chest']);
  }
});

test('analysis leaves accepted history, inputs and replayed inventory intact',()=>{
  const {project,proposal}=fixture(),before=serializeProject(project),candidateBefore=JSON.stringify(proposal.candidate);
  const replay=()=>project.sessions.map(s=>replayMission(project.history.find(v=>v.versionId===s.versionId),s));
  const previous=replay();const result=analyzePracticeImpact(project,proposal.candidate);
  assert.equal(serializeProject(project),before);assert.equal(JSON.stringify(proposal.candidate),candidateBefore);
  assert.deepEqual(replay(),previous);
  for(const record of previous)assert.deepEqual(record.inventory,{pear:3,lantern:0});
  assert.ok(Object.isFrozen(result));assert.ok(Object.isFrozen(at(result,'practice-2',0)));
});

test('stale, foreign and reused candidate identities are rejected without mutation',()=>{
  const {project,base,proposal}=fixture(),before=serializeProject(project);
  const cases=[clone(base),{...clone(proposal.candidate),languageId:'foreign'},
    {...clone(proposal.candidate),parentVersionId:'luma-v1'},
    {...clone(proposal.candidate),versionId:'luma-v1'}];
  for(const candidate of cases)assert.throws(()=>analyzePracticeImpact(project,candidate));
  assert.equal(serializeProject(project),before);
});
