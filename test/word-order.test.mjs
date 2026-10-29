import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeWordOrder} from '../src/word-order.mjs';
import {starterLanguage} from '../src/starter-language.mjs';
import {parse,proposeRevision,acceptRevision} from '../src/language-core.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
const bag=text=>text.trim().split(/\s+/).sort();
const expected={actor:'i',verb:'request',object:'lantern',quantity:1};
const entry=(id,role,meaning,form)=>({id,role,meaning,form,gloss:String(meaning),author:'Independent review',rationale:'Word-order reference',canonical:false});
function verified(version,text,result){
  assert.equal(result.status,'suggested');assert.ok(result.suggestion);
  assert.deepEqual(bag(result.suggestion.text),bag(text),'Reordering must preserve every submitted token');
  assert.equal(result.meaningCount,1);assert.deepEqual(result.suggestion.interpretation,parse(version,result.suggestion.text));
  assert.equal(result.suggestion.interpretation.status,'ok');
  assert.deepEqual(result.suggestion.meaning,result.suggestion.interpretation.meaning);
}

test('known SOV ordering error offers the verified same-word lantern request',()=>{
  const v=clone(starterLanguage),r=analyzeWordOrder(v,'mi na un lum');
  assert.equal(r.versionId,'luma-v1');assert.equal(r.original.status,'invalid_syntax');
  assert.deepEqual(r.expectedRoles,['actor','quantity','object','verb']);
  verified(v,'mi na un lum',r);assert.equal(r.suggestion.text,'mi un lum na');
  assert.deepEqual(r.suggestion.meaning,expected);assert.equal(r.permutationCount,24);
});

test('the active grammar controls validity and the direction of repair',()=>{
  const v=clone(starterLanguage),p=proposeRevision(v,{id:'svo-reference',author:'Independent review',rationale:'Active grammar control',order:'SVO'});
  const svo=acceptRevision([v],p,{accept:true,author:'Independent review'}).at(-1);
  const valid=analyzeWordOrder(svo,'mi na un lum');assert.equal(valid.status,'already_valid');assert.equal(valid.suggestion,null);
  assert.deepEqual(valid.original.meaning,expected);
  const repair=analyzeWordOrder(svo,'mi un lum na');verified(svo,'mi un lum na',repair);
  assert.equal(repair.versionId,'luma-v2');assert.deepEqual(repair.expectedRoles,['actor','verb','quantity','object']);
  assert.equal(repair.suggestion.text,'mi na un lum');
});

test('a submitted alias is retained rather than replaced by canonical vocabulary',()=>{
  const v=clone(starterLanguage);v.lexicon.push(entry('lantern-alias','object','lantern','lumo'));
  const r=analyzeWordOrder(v,'mi na un lumo');verified(v,'mi na un lumo',r);
  assert.equal(r.suggestion.text,'mi un lumo na');assert.deepEqual(r.suggestion.meaning,expected);
});

test('duplicate surface tokens preserve multiplicity and count distinct permutations',()=>{
  const v=clone(starterLanguage);v.lexicon.push(entry('request-alias','verb','request','mi'));
  const text='mi mi un lum',r=analyzeWordOrder(v,text);verified(v,text,r);
  assert.equal(r.suggestion.text,'mi un lum mi');assert.deepEqual(r.suggestion.meaning,expected);
  assert.equal(r.permutationCount,12);assert.equal(bag(r.suggestion.text).filter(t=>t==='mi').length,2);
});

test('multiple derivations of one meaning do not create false semantic ambiguity',()=>{
  const v=clone(starterLanguage);v.lexicon.push(entry('lum-alias-same','object','lantern','lum'));
  const r=analyzeWordOrder(v,'mi na un lum');verified(v,'mi na un lum',r);
  assert.equal(r.meaningCount,1);assert.deepEqual(r.suggestion.meaning,expected);
});

test('unknown and already ambiguous input do not acquire a single invented intent',()=>{
  const v=clone(starterLanguage);
  const unknown=analyzeWordOrder(v,'mi na un wug');assert.equal(unknown.status,'not_applicable');assert.equal(unknown.suggestion,null);assert.equal(unknown.original.meaning,null);
  v.lexicon.push(entry('zol-pear','object','pear','zol'),entry('zol-lantern','object','lantern','zol'));
  const ambiguous=analyzeWordOrder(v,'mi un zol na');assert.equal(ambiguous.original.status,'ambiguous');assert.equal(ambiguous.suggestion,null);
  const wrong=analyzeWordOrder(v,'mi na un zol');assert.equal(wrong.status,'ambiguous_rearrangement');
  assert.equal(wrong.meaningCount,2);assert.equal(wrong.suggestion,null);
});

test('known words with missing semantic roles have no valid rearrangement',()=>{
  const r=analyzeWordOrder(starterLanguage,'mi tu un lum');
  assert.equal(r.original.status,'invalid_syntax');assert.equal(r.status,'no_rearrangement');assert.equal(r.meaningCount,0);assert.equal(r.suggestion,null);
});

test('valid off-goal statements retain their own meaning without a mission-answer substitute',()=>{
  const r=analyzeWordOrder(starterLanguage,'mi tri pon si');
  assert.equal(r.status,'already_valid');assert.equal(r.suggestion,null);
  assert.deepEqual(r.original.meaning,{actor:'i',verb:'have',object:'pear',quantity:3});
});

test('analysis does not mutate the language, submitted text or earlier result',()=>{
  const v=clone(starterLanguage),before=JSON.stringify(v),text='mi na un lum';
  const first=analyzeWordOrder(v,text),snapshot=JSON.stringify(first);
  analyzeWordOrder(v,'mi na un wug');assert.equal(JSON.stringify(v),before);assert.equal(text,'mi na un lum');
  assert.equal(JSON.stringify(first),snapshot);
});
