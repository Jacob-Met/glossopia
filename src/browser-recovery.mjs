// Recovery from a failed startup read. Ordinary valid-project saving is unchanged.
export function createProjectRecovery({read,write,parseProject,serializeProject}) {
  let started=false,blocked=true,nextReviewId=0,review=null;
  const retainedCopies=[];
  function retain(raw){if(raw!==null&&!retainedCopies.includes(raw))retainedCopies.push(raw);}
  function encode(project){const text=serializeProject(project);if(typeof text!=='string')throw new TypeError('Project serialization must return text.');return text;}
  function readStored(){const raw=read();if(raw!==null&&typeof raw!=='string')throw new TypeError('Browser storage must return text or null.');return raw;}
  const failure=(reason,error)=>error===undefined?{ok:false,reason}:{ok:false,reason,error};
  return {
    load(){
      if(started)throw new Error('Recovery already started.');started=true;
      let raw;try{raw=readStored();}catch(error){return {kind:'blocked',reason:'read-failed',error};}
      if(raw===null){blocked=false;return {kind:'empty'};}
      try{const project=parseProject(raw);blocked=false;return {kind:'loaded',project};}
      catch(error){retain(raw);return {kind:'blocked',reason:'parse-failed',error};}
    },
    isBlocked(){return blocked;},
    copies(){return retainedCopies.slice();},
    persist(project){
      if(blocked)return failure('recovery-required');
      let text;try{text=encode(project);}catch(error){return failure('serialize-failed',error);}
      try{write(text);return {ok:true};}catch(error){return failure('write-failed',error);}
    },
    prepareReplacement(project){
      if(!started||!blocked)return failure('recovery-not-active');
      review=null;
      let projectText;try{projectText=encode(project);}catch(error){return failure('serialize-failed',error);}
      let raw;try{raw=readStored();}catch(error){return failure('read-failed',error);}
      retain(raw);review={id:++nextReviewId,raw,projectText};
      return {ok:true,reviewId:review.id,storedText:raw,replacementText:projectText};
    },
    cancelReplacement(){review=null;},
    replace(reviewId,currentProject){
      if(!started||!blocked)return failure('recovery-not-active');
      if(review===null||review.id!==reviewId)return failure('review-required');
      const approved=review;review=null;
      let currentText;try{currentText=encode(currentProject);}catch(error){return failure('serialize-failed',error);}
      if(currentText!==approved.projectText)return failure('project-changed');
      let currentRaw;try{currentRaw=readStored();}catch(error){return failure('read-failed',error);}
      retain(currentRaw);
      if(currentRaw!==approved.raw)return failure('storage-changed');
      // This immediate comparison detects observed changes. Web Storage offers
      // no atomic compare-and-swap, so this is not a cross-tab locking scheme.
      try{write(approved.projectText);}catch(error){return failure('write-failed',error);}
      blocked=false;return {ok:true};
    }
  };
}
export function serializeRecoveryCopy(raw,storageKey='glossopia-project-v1'){
  if(typeof raw!=='string'||typeof storageKey!=='string')throw new TypeError('Recovery content and storage key must be text.');
  // JSON escapes retain lone UTF-16 surrogates through a UTF-8 Blob download.
  // This recovery envelope is deliberately separate from project format v1.
  return JSON.stringify({format:'glossopia-browser-recovery',schemaVersion:1,storageKey,storedText:raw},null,2)+'\n';
}
