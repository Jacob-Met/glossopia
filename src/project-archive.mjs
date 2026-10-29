import {serializeProject,parseProject} from './project.mjs';

export const ACTIVE_PROJECT_KEY='glossopia-project-v1';
export const PROJECT_ARCHIVE_KEY='glossopia-project-archive-v1';
export const ARCHIVE_MAX_ENTRIES=100;
export const ARCHIVE_MAX_BYTES=10000000;
const bytes=text=>new TextEncoder().encode(text).length;
function fail(code,message){const error=new Error(message);error.code=code;throw error;}
function plain(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function keys(value,allowed){return Object.keys(value).every(key=>allowed.includes(key));}
function metadata(snapshotId,savedAt){
  if(typeof snapshotId!=='string'||!/^[A-Za-z][A-Za-z0-9._-]{0,79}$/.test(snapshotId))fail('INVALID_SNAPSHOT','Use a snapshot identity of 1–80 supported characters.');
  if(typeof savedAt!=='string'||savedAt.length>40||!/^\d{4}-\d{2}-\d{2}T/.test(savedAt)||!Number.isFinite(Date.parse(savedAt)))fail('INVALID_SNAPSHOT','Supply a valid snapshot timestamp.');
}
function readRaw(storage,key){try{return storage.getItem(key);}catch{fail('STORAGE_READ_FAILED','Browser storage could not be read. Current work has not been replaced.');}}
function archiveFromRaw(raw){
  if(raw===null)return [];
  try{
    if(typeof raw!=='string'||bytes(raw)>ARCHIVE_MAX_BYTES)throw Error('size');
    const value=JSON.parse(raw);
    if(!plain(value)||!keys(value,['format','schemaVersion','entries'])||value.format!=='glossopia-project-archive'||value.schemaVersion!==1||!Array.isArray(value.entries)||value.entries.length>ARCHIVE_MAX_ENTRIES)throw Error('shape');
    const ids=new Set();
    return value.entries.map(entry=>{
      if(!plain(entry)||!keys(entry,['snapshotId','savedAt','project']))throw Error('entry');
      metadata(entry.snapshotId,entry.savedAt);
      if(ids.has(entry.snapshotId))throw Error('duplicate identity');ids.add(entry.snapshotId);
      return {snapshotId:entry.snapshotId,savedAt:entry.savedAt,project:parseProject(serializeProject(entry.project))};
    });
  }catch{fail('INVALID_ARCHIVE','The local project archive is invalid or exceeds its supported limits. It has not been overwritten; export current work before resolving storage.');}
}
export function readArchivedProjects(storage){return freeze(archiveFromRaw(readRaw(storage,PROJECT_ARCHIVE_KEY)));}

/** Retain accepted project data before replacing the active storage value.
 * Uses native Storage.setItem failure semantics: a failed write leaves its key
 * unchanged. Checks detect observed changes, not concurrent-tab transactions.
 * An archive snapshot may remain when active replacement subsequently fails.
 */
export function preserveAndReplaceProject(storage,{currentProject,nextProject,expectedActiveValue,snapshotId,savedAt}){
  if(expectedActiveValue!==null&&typeof expectedActiveValue!=='string')fail('INVALID_EXPECTATION','Capture the current raw active-project storage value before switching.');
  metadata(snapshotId,savedAt);
  // Serialize first: validation and size errors must precede every write.
  const currentValue=serializeProject(currentProject),activeValue=serializeProject(nextProject);
  const project=parseProject(activeValue),current=parseProject(currentValue);
  const originalArchive=readRaw(storage,PROJECT_ARCHIVE_KEY),entries=archiveFromRaw(originalArchive);
  const idMatch=entries.find(entry=>entry.snapshotId===snapshotId);
  if(idMatch&&serializeProject(idMatch.project)!==currentValue)fail('SNAPSHOT_ID_CONFLICT','This snapshot identity already refers to different work. Use a fresh identity.');
  const existing=entries.find(entry=>serializeProject(entry.project)===currentValue);
  const archivedEntry=existing??{snapshotId,savedAt,project:current};
  const deduplicated=Boolean(existing);
  if(!existing&&entries.length>=ARCHIVE_MAX_ENTRIES)fail('ARCHIVE_CAPACITY','The local archive already contains 100 snapshots. Export the new draft instead; current work remains active.');
  const nextEntries=existing?entries:[...entries,archivedEntry];
  const archiveValue=JSON.stringify({format:'glossopia-project-archive',schemaVersion:1,entries:nextEntries});
  if(bytes(archiveValue)>ARCHIVE_MAX_BYTES)fail('ARCHIVE_CAPACITY','The local archive would exceed 10 MB. Export the new draft instead; current work remains active.');
  function checkActive(){if(readRaw(storage,ACTIVE_PROJECT_KEY)!==expectedActiveValue)fail('STALE_ACTIVE','The saved active project changed. Review the current work before switching.');}
  checkActive();
  if(readRaw(storage,PROJECT_ARCHIVE_KEY)!==originalArchive)fail('STALE_ARCHIVE','The local archive changed. Refresh its snapshots before switching.');
  if(!existing){
    try{storage.setItem(PROJECT_ARCHIVE_KEY,archiveValue);}catch{fail('ARCHIVE_WRITE_FAILED','Could not retain the current project locally. Current work remains active; export the new draft instead.');}
  }
  checkActive();
  try{storage.setItem(ACTIVE_PROJECT_KEY,activeValue);}catch{fail('ACTIVE_WRITE_FAILED','Could not save the new active project. Current work remains active and its retained snapshot is available.');}
  return freeze({project,archivedEntry,deduplicated,activeValue});
}
