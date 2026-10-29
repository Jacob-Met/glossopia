// Independent literal contract tests: receipt_recovery.
import test from 'node:test';
import assert from 'node:assert/strict';
import {compareVersionHistory} from '../src/version-history.mjs';
import {starterLanguage} from '../src/starter-language.mjs';
import {proposeRevision,acceptRevision} from '../src/language-core.mjs';
const base=()=>structuredClone(starterLanguage);
const next=()=>({...base(),number:2,versionId:'luma-v2',parentVersionId:'luma-v1'});
const row=(kind,entryId,before,after)=>({kind,entryId,before,after});
test('Accepted rename, order and addition expose literal before/after facts',()=>{
 const a=base(),p=proposeRevision(a,{id:'test-change',author:'Reviewer',rationale:'Make accepted changes inspectable',order:'SVO',wordChanges:[{entryId:'object-lantern',form:'luma'}],addEntries:[{id:'object-basket',role:'object',meaning:'basket',form:'basa',gloss:'basket',author:'Reviewer',rationale:'A basket',canonical:true}]});
 const b=acceptRevision([a],p,{accept:true,author:'Reviewer'})[1];const r=compareVersionHistory(a,b);
 assert.equal(r.previousVersionId,'luma-v1');assert.equal(r.currentVersionId,'luma-v2');assert.deepEqual(r.changes.slice(0,2),[row('order',null,'SOV','SVO'),row('form','object-lantern','lum','luma')]);assert.equal(r.changes.length,3);assert.equal(r.changes[2].kind,'added');assert.equal(r.changes[2].entryId,'object-basket');assert.equal(r.changes[2].before,null);assert.match(r.changes[2].after,/basa/);assert.match(r.changes[2].after,/object: basket/);
});
test('Imported same-ID meaning and role changes are explicit even with unchanged gloss',()=>{
 const a=base(),b=next();b.lexicon.find(x=>x.id==='object-lantern').meaning='basket';assert.deepEqual(compareVersionHistory(a,b).changes,[row('meaning','object-lantern','object: lantern','object: basket')]);
 const c=next(),e=c.lexicon.find(x=>x.id==='object-lantern');e.role='quantity';e.meaning=4;assert.deepEqual(compareVersionHistory(a,c).changes,[row('meaning','object-lantern','object: lantern','quantity: 4')]);
});
test('Different IDs remain removal and addition even for identical words',()=>{
 const a=base(),b=next();b.lexicon.find(x=>x.id==='object-lantern').id='replacement-lantern';const r=compareVersionHistory(a,b).changes;assert.deepEqual(r.map(x=>[x.kind,x.entryId]),[['removed','object-lantern'],['added','replacement-lantern']]);assert.equal(r[0].after,null);assert.equal(r[1].before,null);assert.equal(r[0].before,r[1].after);
});
test('Gloss and preference edits are not semantic or form changes',()=>{
 const a=base(),b=next(),e=b.lexicon.find(x=>x.id==='object-lantern');e.gloss='<img src=x onerror=alert(1)>';e.canonical=false;assert.deepEqual(compareVersionHistory(a,b).changes,[row('gloss','object-lantern','lantern','<img src=x onerror=alert(1)>'),row('canonical','object-lantern','Preferred form','Not marked preferred')]);
});
test('Scoped comparison excludes metadata, leaves input untouched and rejects broken chains',()=>{
 const a=base(),b=next();b.rationale='Different explanation';b.examples[0].note='Changed note';const before=JSON.stringify([a,b]);assert.deepEqual(compareVersionHistory(a,b).changes,[]);assert.equal(JSON.stringify([a,b]),before);assert.throws(()=>compareVersionHistory(a,{...b,parentVersionId:'other'}));assert.throws(()=>compareVersionHistory(a,{...b,languageId:'other'}));
});
