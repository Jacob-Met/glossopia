import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const load=p=>import(pathToFileURL(root+'/src/'+p));
const {starterLanguage}=await load('starter-language.mjs');
const {validateVersion,proposeRevision,acceptRevision}=await load('language-core.mjs');
const {createProject,serializeProject,parseProject}=await load('project.mjs');
for(const length of [4,61,62,63,64]){
  const languageId=length===4?'luma':'a'.repeat(length);
  const initial=validateVersion({...starterLanguage,languageId,versionId:languageId});
  let history=[initial];
  const project=createProject(initial);
  for(let number=2;number<=10;number++){
    const previous=history.at(-1),snapshot=JSON.stringify(history);
    const proposal=proposeRevision(previous,{id:'length-'+length+'-revision-'+number,author:'reviewer',rationale:'Check bounded version identity and semantic migration',order:previous.grammar.order==='SOV'?'SVO':'SOV'});
    const accepted=acceptRevision(history,proposal,{accept:true,author:'reviewer'});
    assert.equal(JSON.stringify(history),snapshot);
    assert.equal(accepted.at(-1).languageId,languageId);
    assert(accepted.at(-1).versionId.length<=64);
    assert.equal(accepted.at(-1).parentVersionId,previous.versionId);
    assert.equal(new Set(accepted.map(v=>v.versionId)).size,accepted.length);
    if(length===4)assert.equal(accepted.at(-1).versionId,'luma-v'+number);
    history=accepted;
  }
  const restored=parseProject(serializeProject({...project,history,currentVersionId:history.at(-1).versionId}));
  assert.deepEqual(restored.history,history);
  assert.equal(restored.sessions[0].versionId,initial.versionId);
  assert.equal(restored.viewVersionId,initial.versionId);
  assert.equal(restored.currentVersionId,history[9].versionId);
  assert.equal(restored.history[8].number,9);
  assert.equal(restored.history[9].number,10);
  console.log('PASS languageId length '+length+' through v10, historical session and project roundtrip');
}
