import {validateVersion,validateHistory,parse,meaningsEqual} from './language-core.mjs';
import {startMission,validateSession,replayMission} from './mission-core.mjs';
const MAX_BYTES=1000000;
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function plain(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
export function validateProject(input){
  if(!plain(input)||input.format!=='glossopia-project'||input.schemaVersion!==1)throw new Error('Choose a GLOSSOPIA project in format version 1.');
  if(typeof input.title!=='string'||input.title.trim().length<1||input.title.length>100)throw new Error('The project needs a title of 1–100 characters.');
  const history=validateHistory(input.history),byId=new Map(history.map(v=>[v.versionId,v]));
  for(const version of history){
    for(const example of version.examples){
      const interpretation=parse(version,example.text);
      if(interpretation.status!=='ok'||!meaningsEqual(interpretation.meaning,example.meaning))
        throw new Error('Example '+example.id+' does not have its declared meaning in '+version.versionId+'.');
    }
    if(version.number>1&&!version.acceptance)throw new Error('Accepted revisions must retain their proposal and author metadata.');
  }
  const current=history.at(-1);
  if(input.currentVersionId!==current.versionId)throw new Error('The current language must be the latest accepted version.');
  if(!byId.has(input.viewVersionId))throw new Error('The displayed version does not exist in this project.');
  if(!Array.isArray(input.sessions)||input.sessions.length<1||input.sessions.length>30)throw new Error('A project supports 1–30 practice conversations.');
  const ids=new Set();
  const sessions=Array.from(input.sessions,item=>{
    if(!plain(item)||!byId.has(item.versionId))throw new Error('A practice conversation refers to an unknown language version.');
    const version=byId.get(item.versionId),session=validateSession(item,version);
    if(ids.has(session.id))throw new Error('Practice conversation identities must be distinct.');ids.add(session.id);
    replayMission(version,session);return session;
  });
  if(!ids.has(input.activeSessionId))throw new Error('The active conversation does not exist.');
  return {format:'glossopia-project',schemaVersion:1,title:input.title.trim(),history:freeze(history),
    currentVersionId:current.versionId,viewVersionId:input.viewVersionId,sessions,activeSessionId:input.activeSessionId};
}
export function createProject(versionInput,{title}={}){
  const version=validateVersion(versionInput),session=startMission(version);
  return validateProject({format:'glossopia-project',schemaVersion:1,title:title??version.name+' — Lantern Market',
    history:[version],currentVersionId:version.versionId,viewVersionId:version.versionId,sessions:[session],activeSessionId:session.id});
}
export function serializeProject(input){
  const text=JSON.stringify(validateProject(input),null,2)+'\n';
  if(new TextEncoder().encode(text).length>MAX_BYTES)throw new Error('This project exceeds the 1 MB export limit.');
  return text;
}
export function parseProject(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw new Error('Choose a project smaller than 1 MB.');
  let value;try{value=JSON.parse(text);}catch{throw new Error('The project is not valid JSON.');}
  return validateProject(value);
}
export function addPractice(input,versionId){
  const project=validateProject(input),version=project.history.find(v=>v.versionId===versionId);
  if(!version)throw new Error('That language version does not exist.');
  if(project.sessions.length>=30)throw new Error('This project already contains 30 conversations. Save it and start a new project for more practice.');
  const used=new Set(project.sessions.map(s=>s.id));
  let n=project.sessions.length+1;while(used.has('practice-'+n))n++;
  const id='practice-'+n;
  const session=startMission(version,id);
  return validateProject({...project,sessions:[...project.sessions,session],activeSessionId:id});
}
