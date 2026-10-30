// Independent preferred-entry contract, frozen before implementation inspection.
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(process.env.GLOSSOPIA_APP_ROOT??fileURLToPath(new URL('../',import.meta.url)));
const load=name=>import(pathToFileURL(resolve(root,'src',name)));
const {starterLanguage}=await load('starter-language.mjs');
const {validateVersion,compose,parse,proposeRevision,acceptRevision}=await load('language-core.mjs');
const {createProject,serializeProject,parseProject,validateProject}=await load('project.mjs');
const clone=x=>structuredClone(x), author='Preference receiver';
const entry=(id,meaning,form,canonical=false)=>({id,role:'object',meaning,form,canonical,gloss:meaning,author:'Original lexicographer',rationale:'Original lexical authorship'});
const meaning={actor:'you',verb:'give',quantity:2,object:'basket'};
function base(){const v=clone(starterLanguage);v.lexicon.push(entry('basket-selu','basket','selu'),entry('basket-sela','basket','sela'));return v;}
const patch=(preferredEntries,extra={})=>({id:'preference-change',author,rationale:'Choose wording without duplicating vocabulary',preferredEntries,...extra});
const accept=(history,p)=>acceptRevision(history,p,{accept:true,author});
const byId=(v,id)=>v.lexicon.find(e=>e.id===id);

test('choose existing synonym, preserve source and lexical attribution, record exact deltas, serialize accepted history',()=>{
 const v=base(),snapshot=JSON.stringify(v),project=createProject(v),saved=serializeProject(project);
 assert.equal(compose(v,meaning).status,'choice_required');
 const p=proposeRevision(v,patch(['basket-sela']));
 assert.equal(JSON.stringify(v),snapshot); assert.equal(serializeProject(project),saved);
 assert.deepEqual(p.patch.preferredEntries,['basket-sela']);
 assert.deepEqual(p.changes,[{type:'word_preference',entryId:'basket-sela',role:'object',meaning:'basket',form:'sela',from:false,to:true}]);
 const expected=clone(validateVersion(v).lexicon);expected.find(e=>e.id==='basket-sela').canonical=true;
 assert.deepEqual(p.candidate.lexicon,expected);
 assert.equal(p.candidate.author,author); assert.equal(p.candidate.rationale,p.patch.rationale);
 const result=compose(p.candidate,meaning);assert.equal(result.status,'ok');assert.equal(result.text,'tu du sela di');
 assert.deepEqual(parse(p.candidate,result.text).meaning,meaning);
 for(const text of ['tu du selu di','tu du sela di'])assert.deepEqual(parse(p.candidate,text).meaning,meaning);
 const history=accept(project.history,p),next=validateProject({...project,history,currentVersionId:history[1].versionId,viewVersionId:history[1].versionId});
 const restored=parseProject(serializeProject(next));assert.deepEqual(restored,next);
 assert.deepEqual(restored.sessions,project.sessions);assert.equal(restored.activeSessionId,project.activeSessionId);
 assert.deepEqual(history[0],validateVersion(v));assert.equal(compose(history[0],meaning).status,'choice_required');
 assert.equal(serializeProject(project),saved);assert.equal(JSON.stringify(v),snapshot);
});

test('switch preference atomically demotes previous choice without changing forms, identities or authorship',()=>{
 const v=base();byId(v,'basket-sela').canonical=true;
 const p=proposeRevision(v,patch(['basket-selu']));
 const expected=clone(validateVersion(v).lexicon);expected.find(e=>e.id==='basket-sela').canonical=false;expected.find(e=>e.id==='basket-selu').canonical=true;
 assert.deepEqual(p.candidate.lexicon,expected);
 assert.deepEqual(p.changes.filter(c=>c.type==='word_preference').sort((a,b)=>a.entryId.localeCompare(b.entryId)),[
  {type:'word_preference',entryId:'basket-sela',role:'object',meaning:'basket',form:'sela',from:true,to:false},
  {type:'word_preference',entryId:'basket-selu',role:'object',meaning:'basket',form:'selu',from:false,to:true}
 ]);
 assert.equal(compose(p.candidate,meaning).text,'tu du selu di');assert.equal(byId(v,'basket-sela').canonical,true);
 assert.throws(()=>proposeRevision(p.candidate,patch(['basket-selu'])),e=>e.code==='EMPTY_REVISION');
});

test('mixed rename and order compose with selected preference while typed groups stay isolated',()=>{
 const v=base();v.lexicon.push(entry('object-i-a','i','self'),entry('object-i-b','i','person'));
 const p=proposeRevision(v,patch(['basket-sela','object-i-b'],{order:'SVO',wordChanges:[{entryId:'basket-sela',form:'salu'}]}));
 assert.equal(compose(p.candidate,meaning).text,'tu di du salu');assert.equal(compose(p.candidate,meaning).status,'ok');
 assert.deepEqual(byId(p.candidate,'actor-i'),byId(validateVersion(v),'actor-i'));
 assert.equal(byId(p.candidate,'object-i-b').canonical,true);assert.equal(byId(p.candidate,'object-i-a').canonical,false);
 assert.equal(byId(p.candidate,'basket-sela').author,author); // Rename retains its existing attribution contract.
 assert.equal(byId(p.candidate,'object-i-b').author,'Original lexicographer');
 assert.equal(accept([v],p)[1].grammar.order,'SVO');
});

test('reject duplicate identities/groups, unknown/new identities, malformed requests and conflicting canonical additions',()=>{
 const v=base(),snapshot=JSON.stringify(v);
 const invalid=[patch(['basket-selu','basket-selu']),patch(['basket-selu','basket-sela']),patch(['not-accepted']),
  patch('basket-selu'),patch([null]),patch(['new-basket'],{addEntries:[entry('new-basket','basket','salu')]}),
  patch(['basket-sela'],{addEntries:[entry('new-basket','basket','salu',true)]})];
 for(const request of invalid)assert.throws(()=>proposeRevision(v,request),e=>e.code==='INVALID_REVISION');
 assert.equal(JSON.stringify(v),snapshot);
 // A noncanonical addition does not conflict with choosing an existing preferred entry.
 const p=proposeRevision(v,patch(['basket-sela'],{addEntries:[entry('basket-third','basket','salu',false)]}));
 assert.equal(compose(p.candidate,meaning).text,'tu du sela di');assert.equal(byId(p.candidate,'basket-third').canonical,false);
});

test('sixteen groups accepted; seventeen rejected; empty selection without another change is a no-op',()=>{
 const v=base(),ids=[];
 for(let i=0;i<17;i++){const id='optional-'+i;ids.push(id);v.lexicon.push(entry(id,'thing_'+i,'za'+String.fromCharCode(97+i)));}
 assert.equal(proposeRevision(v,patch(ids.slice(0,16))).changes.filter(c=>c.type==='word_preference').length,16);
 assert.throws(()=>proposeRevision(v,patch(ids)),e=>e.code==='INVALID_REVISION');
 assert.throws(()=>proposeRevision(v,patch([])),e=>e.code==='EMPTY_REVISION');
 assert.equal(proposeRevision(v,patch([],{order:'SVO'})).candidate.grammar.order,'SVO');
});

test('preferred ambiguous surface remains ambiguous and cannot bypass authored-example acceptance',()=>{
 const v=base();v.lexicon.push(entry('box-sela','box','sela',true));
 const p=proposeRevision(v,patch(['basket-sela'])),r=compose(p.candidate,meaning);
 assert.equal(r.status,'ambiguous');assert.equal(r.text,'tu du sela di');
 assert.deepEqual(new Set(r.readings.map(x=>x.meaning.object)),new Set(['basket','box']));
 // Unused optional vocabulary does not invent a new acceptance requirement.
 assert.equal(accept([v],p).length,2);
 const guarded=clone(v);guarded.examples.push({id:'basket-example',text:'tu du selu di',meaning:clone(meaning),note:'Previously unambiguous basket wording'});
 const blocked=proposeRevision(guarded,patch(['basket-sela'],{order:'SVO'}));
 assert.ok(blocked.impact.summary.unresolved>0);
 assert.throws(()=>accept([guarded],blocked),e=>e.code==='UNRESOLVED_EXAMPLES');
});

test('preferred changes retain explicit acceptance, stale-base and candidate-tampering safeguards',()=>{
 const v=base(),p=proposeRevision(v,patch(['basket-sela'])),snapshot=JSON.stringify(p);
 assert.throws(()=>acceptRevision([v],p,{accept:false,author}),e=>e.code==='ACCEPTANCE_REQUIRED');
 const history=accept([v],p);assert.throws(()=>accept(history,p),e=>e.code==='STALE_BASE');
 const altered=clone(p);byId(altered.candidate,'basket-sela').canonical=false;byId(altered.candidate,'basket-selu').canonical=true;
 assert.throws(()=>accept([v],altered),e=>e.code==='PROPOSAL_MISMATCH');
 assert.equal(JSON.stringify(p),snapshot);
});
