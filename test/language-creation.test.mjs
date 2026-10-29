import test from 'node:test';
import assert from 'node:assert/strict';
import {createLanguage} from '../src/language-creation.mjs';
import {parse,proposeRevision,acceptRevision} from '../src/language-core.mjs';
import {createProject,serializeProject,parseProject} from '../src/project.mjs';
import {startMission,submitSentence,analyzeMissionCompatibility} from '../src/mission-core.mjs';
const forms={'actor-i':'zi','actor-you':'va','verb-request':'ke','verb-give':'do','verb-have':'se','object-lantern':'len','object-pear':'pir','quantity-one':'an','quantity-two':'bi','quantity-three':'ci'};
const input=(order='SOV')=>({languageId:'kiri-reference',name:'Kiri',author:'Independent author',order,forms:{...forms}});
const clone=x=>JSON.parse(JSON.stringify(x));

test('a named authored language has its own initial identity and actual generated examples',()=>{
  const v=createLanguage(input());assert.equal(v.languageId,'kiri-reference');assert.equal(v.versionId,'kiri-reference-v1');assert.equal(v.number,1);assert.equal(v.parentVersionId,null);assert.equal(v.name,'Kiri');assert.equal(v.acceptance,undefined);
  assert.equal(v.author,'Independent author');assert.equal(v.grammar.author,v.author);assert.equal(v.lexicon.length,10);assert.equal(v.examples.length,6);
  for(const e of v.lexicon){assert.equal(e.form,forms[e.id]);assert.equal(e.author,v.author);assert.equal(e.canonical,true);}
  const texts={'inventory-start':'zi ci pir se','request-lantern':'zi an len ke','merchant-price':'zi bi pir ke','give-pears':'zi bi pir do','merchant-receipt':'va an len se','confirm-lantern':'zi an len se'};
  for(const e of v.examples){assert.equal(e.text,texts[e.id]);const p=parse(v,e.text);assert.equal(p.status,'ok');assert.deepEqual(p.meaning,e.meaning);}
  assert.equal(analyzeMissionCompatibility(v).available,true);
});

for(const order of ['SOV','SVO'])test(`authored ${order} forms complete the actual fixed-price mission and portable project roundtrip`,()=>{
  const v=createLanguage(input(order));let session=startMission(v);
  const statements=order==='SOV'?['zi an len ke','zi bi pir do','zi an len se']:['zi ke an len','zi do bi pir','zi se an len'];
  for(let i=0;i<statements.length;i++){const r=submitSentence(v,session,statements[i]);session=r.session;assert.equal(r.state.stage,i+1);assert.deepEqual(r.state.inventory,i===0?{pear:3,lantern:0}:{pear:1,lantern:1});assert.equal(r.state.complete,i===2);}
  const project=createProject(v);project.sessions[0]=session;
  assert.deepEqual(parseProject(serializeProject(project)),project);
  const proposal=proposeRevision(v,{id:'new-language-revision',author:'Second author',rationale:'Preserve first language conversation',order:order==='SOV'?'SVO':'SOV'});
  const history=acceptRevision(project.history,proposal,{accept:true,author:'Second author'});
  assert.deepEqual(history[0],v);assert.equal(session.versionId,v.versionId);assert.equal(history[1].languageId,v.languageId);
});

test('missing, extra and malformed form inputs never fall back to starter words',()=>{
  for(const id of Object.keys(forms)){const x=input();delete x.forms[id];assert.throws(()=>createLanguage(x));}
  for(const value of ['', 'two words','word1','a'.repeat(21),null]){const x=input();x.forms['actor-i']=value;assert.throws(()=>createLanguage(x));}
  for(const key of ['name','author','order','languageId','forms']){const x=input();delete x[key];assert.throws(()=>createLanguage(x));}
  assert.throws(()=>createLanguage({...input(),unexpected:true}));assert.throws(()=>createLanguage({...input(),forms:{...forms,unknown:'word'}}));
});

test('normalization is explicit and cross-role reuse is allowed when actual parsing is unique',()=>{
  const x=input();x.forms['actor-i']=' ZI ';x.forms['verb-request']='zi';x.name=' Kiri ';x.author=' Author ';
  const v=createLanguage(x);assert.equal(v.name,'Kiri');assert.equal(v.author,'Author');
  assert.equal(v.lexicon.find(e=>e.id==='actor-i').form,'zi');
  const parsed=parse(v,'zi an len zi');assert.equal(parsed.status,'ok');assert.deepEqual(parsed.meaning,{actor:'i',verb:'request',object:'lantern',quantity:1});
  assert.equal(analyzeMissionCompatibility(v).available,true);
});

test('same-role semantic collisions cannot create a misleading playable language',()=>{
  for(const [a,b] of [['actor-i','actor-you'],['verb-request','verb-give'],['object-lantern','object-pear'],['quantity-one','quantity-two']]){
    const x=input();x.forms[b]=x.forms[a];assert.throws(()=>createLanguage(x));
  }
});

test('long valid identity stays bounded and creation leaves the caller draft untouched',()=>{
  const x=input();x.languageId='k'.repeat(64);const before=clone(x),v=createLanguage(x);
  assert.equal(v.languageId,x.languageId);assert.equal(v.versionId.length,64);assert.ok(v.versionId.endsWith('-v1'));assert.deepEqual(x,before);
  assert.ok(Object.isFrozen(v));assert.ok(Object.isFrozen(v.lexicon[0]));
  const bad=input();bad.forms['quantity-one']='';const badBefore=clone(bad);assert.throws(()=>createLanguage(bad));assert.deepEqual(bad,badBefore);
});
