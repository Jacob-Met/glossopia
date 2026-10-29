import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIVE_PROJECT_KEY,PROJECT_ARCHIVE_KEY,ARCHIVE_MAX_ENTRIES,readArchivedProjects,preserveAndReplaceProject} from '../src/project-archive.mjs';
import {starterLanguage} from '../src/starter-language.mjs';
import {createProject,serializeProject,parseProject} from '../src/project.mjs';
const savedAt='2026-10-29T18:00:00Z';
const project=title=>createProject(starterLanguage,{title});
function storage(initial={}){const values=new Map(Object.entries(initial)),writes=[];return {values,writes,getItem:k=>values.get(k)??null,setItem(k,v){writes.push([k,v]);values.set(k,v);}};}
function setup(){const current=project('Original project'),next=project('Next project'),raw=serializeProject(current),store=storage({[ACTIVE_PROJECT_KEY]:raw});return {current,next,raw,store};}
const args=f=>({currentProject:f.current,nextProject:f.next,expectedActiveValue:f.raw,snapshotId:'snapshot-original',savedAt});
const hasCode=code=>error=>error.code===code;

test('replacement retains exact old project before making the next one active',()=>{
  const f=setup(),before=JSON.stringify([f.current,f.next]),r=preserveAndReplaceProject(f.store,args(f));
  assert.deepEqual(f.store.writes.map(([k])=>k),[PROJECT_ARCHIVE_KEY,ACTIVE_PROJECT_KEY]);
  assert.equal(f.store.getItem(ACTIVE_PROJECT_KEY),serializeProject(f.next));assert.deepEqual(r.project,f.next);assert.equal(r.activeValue,serializeProject(f.next));assert.equal(r.deduplicated,false);
  assert.deepEqual(readArchivedProjects(f.store),[{snapshotId:'snapshot-original',savedAt,project:f.current}]);assert.equal(JSON.stringify([f.current,f.next]),before);
  assert.ok(Object.isFrozen(r));assert.ok(Object.isFrozen(readArchivedProjects(f.store)[0].project));
});

test('exact duplicates retain their original metadata but changed project state is retained separately',()=>{
  const f=setup();preserveAndReplaceProject(f.store,args(f));const archive=f.store.getItem(PROJECT_ARCHIVE_KEY);
  f.store.values.set(ACTIVE_PROJECT_KEY,f.raw);f.store.writes.length=0;
  const dedup=preserveAndReplaceProject(f.store,{...args(f),snapshotId:'another-request',savedAt:'2026-10-30T00:00:00Z'});
  assert.equal(dedup.deduplicated,true);assert.equal(dedup.archivedEntry.snapshotId,'snapshot-original');assert.equal(dedup.archivedEntry.savedAt,savedAt);assert.equal(f.store.getItem(PROJECT_ARCHIVE_KEY),archive);
  assert.deepEqual(f.store.writes.map(([k])=>k),[ACTIVE_PROJECT_KEY]);
  const changed=parseProject(f.raw);changed.sessions[0].inputs.push('mi tri pon si');
  f.store.values.set(ACTIVE_PROJECT_KEY,serializeProject(changed));
  const r=preserveAndReplaceProject(f.store,{currentProject:changed,nextProject:f.next,expectedActiveValue:serializeProject(changed),snapshotId:'changed-snapshot',savedAt});
  assert.equal(r.deduplicated,false);const entries=readArchivedProjects(f.store);assert.equal(entries.length,2);assert.deepEqual(entries[0].project,f.current);assert.deepEqual(entries[1].project,changed);
});

test('malformed archive, invalid replacement and snapshot identity conflicts cannot overwrite existing work',()=>{
  const malformed=setup();malformed.store.values.set(PROJECT_ARCHIVE_KEY,'{broken');
  assert.throws(()=>preserveAndReplaceProject(malformed.store,args(malformed)),hasCode('INVALID_ARCHIVE'));assert.equal(malformed.store.writes.length,0);assert.equal(malformed.store.getItem(PROJECT_ARCHIVE_KEY),'{broken');assert.equal(malformed.store.getItem(ACTIVE_PROJECT_KEY),malformed.raw);
  const invalid=setup();assert.throws(()=>preserveAndReplaceProject(invalid.store,{...args(invalid),nextProject:{}}));assert.equal(invalid.store.writes.length,0);
  const conflict=setup();preserveAndReplaceProject(conflict.store,args(conflict));conflict.store.writes.length=0;
  assert.throws(()=>preserveAndReplaceProject(conflict.store,{...args(conflict),currentProject:conflict.next,expectedActiveValue:serializeProject(conflict.next)}),hasCode('SNAPSHOT_ID_CONFLICT'));assert.equal(conflict.store.writes.length,0);
});

test('archive write failure prevents active replacement; active write failure leaves old active and retained snapshot',()=>{
  for(const failureKey of [PROJECT_ARCHIVE_KEY,ACTIVE_PROJECT_KEY]){
    const f=setup(),set=f.store.setItem.bind(f.store);f.store.setItem=(k,v)=>{if(k===failureKey)throw Error('quota');set(k,v);};
    assert.throws(()=>preserveAndReplaceProject(f.store,args(f)),hasCode(failureKey===PROJECT_ARCHIVE_KEY?'ARCHIVE_WRITE_FAILED':'ACTIVE_WRITE_FAILED'));
    assert.equal(f.store.getItem(ACTIVE_PROJECT_KEY),f.raw);
    if(failureKey===PROJECT_ARCHIVE_KEY)assert.equal(f.store.getItem(PROJECT_ARCHIVE_KEY),null);
    else assert.deepEqual(readArchivedProjects(f.store)[0].project,f.current);
  }
});

test('stale active state is never overwritten, including a change observed after archiving',()=>{
  const f=setup(),external=serializeProject(project('External project'));f.store.values.set(ACTIVE_PROJECT_KEY,external);
  assert.throws(()=>preserveAndReplaceProject(f.store,args(f)),hasCode('STALE_ACTIVE'));assert.equal(f.store.writes.length,0);assert.equal(f.store.getItem(ACTIVE_PROJECT_KEY),external);
  const race=setup(),set=race.store.setItem.bind(race.store);race.store.setItem=(k,v)=>{set(k,v);if(k===PROJECT_ARCHIVE_KEY)race.store.values.set(ACTIVE_PROJECT_KEY,external);};
  assert.throws(()=>preserveAndReplaceProject(race.store,args(race)),hasCode('STALE_ACTIVE'));assert.equal(race.store.getItem(ACTIVE_PROJECT_KEY),external);assert.deepEqual(readArchivedProjects(race.store)[0].project,race.current);
});

test('observed archive change is preserved rather than overwritten',()=>{
  const f=setup(),external=JSON.stringify({format:'glossopia-project-archive',schemaVersion:1,entries:[{snapshotId:'external',savedAt,project:project('External snapshot')}]}),get=f.store.getItem.bind(f.store);let reads=0;
  f.store.getItem=k=>{if(k===PROJECT_ARCHIVE_KEY&&++reads===2)f.store.values.set(k,external);return get(k);};
  assert.throws(()=>preserveAndReplaceProject(f.store,args(f)),hasCode('STALE_ARCHIVE'));assert.equal(f.store.writes.length,0);assert.equal(get(PROJECT_ARCHIVE_KEY),external);assert.equal(get(ACTIVE_PROJECT_KEY),f.raw);
});

test('full archive refuses to evict snapshots to make room for replacement',()=>{
  const f=setup(),entries=Array.from({length:ARCHIVE_MAX_ENTRIES},(_,i)=>({snapshotId:'retained-'+i,savedAt,project:project('Prior '+i)}));
  const raw=JSON.stringify({format:'glossopia-project-archive',schemaVersion:1,entries});f.store.values.set(PROJECT_ARCHIVE_KEY,raw);
  assert.throws(()=>preserveAndReplaceProject(f.store,args(f)),hasCode('ARCHIVE_CAPACITY'));assert.equal(f.store.writes.length,0);assert.equal(f.store.getItem(PROJECT_ARCHIVE_KEY),raw);assert.equal(f.store.getItem(ACTIVE_PROJECT_KEY),f.raw);
});

test('an in-memory current project is retained when no active storage copy exists',()=>{
  const f=setup();f.store.values.delete(ACTIVE_PROJECT_KEY);
  preserveAndReplaceProject(f.store,{...args(f),expectedActiveValue:null});assert.deepEqual(readArchivedProjects(f.store)[0].project,f.current);assert.equal(f.store.getItem(ACTIVE_PROJECT_KEY),serializeProject(f.next));
});
