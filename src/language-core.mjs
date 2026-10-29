const ROLES=['actor','verb','object','quantity'];
const ACTORS=['i','you'],VERBS=['request','give','have'];
const ID=/^[A-Za-z][A-Za-z0-9._-]{0,63}$/,FORM=/^[a-z]{1,20}$/;
export class LanguageError extends Error{constructor(code,message){super(message);this.name='LanguageError';this.code=code;}}
function fail(code,message){throw new LanguageError(code,message);}
function assert(condition,message,code='INVALID_VERSION'){if(!condition)fail(code,message);}
function obj(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function field(value,name,max=600){
  assert(typeof value==='string'&&value.trim().length>0&&value.length<=max,name+' must be nonempty text of at most '+max+' characters');
  return value.trim().normalize('NFC');
}
function identifier(value,name){assert(typeof value==='string'&&ID.test(value),name+' is not a supported identifier');return value;}
function form(value){
  assert(typeof value==='string','A word form must be text');
  const normalized=value.trim().toLowerCase();
  assert(FORM.test(normalized),'Word forms use 1–20 ASCII letters, with no spaces or punctuation');return normalized;
}
function freeze(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;
}
function semanticValue(role,value){
  if(role==='actor')return ACTORS.includes(value);
  if(role==='verb')return VERBS.includes(value);
  if(role==='object')return typeof value==='string'&&/^[a-z][a-z0-9_]{0,39}$/.test(value);
  return Number.isSafeInteger(value)&&value>=1&&value<=99;
}
function normalizeMeaning(value){
  if(!obj(value)||Object.keys(value).some(key=>!ROLES.includes(key))||ROLES.some(role=>!semanticValue(role,value[role])))return null;
  return {actor:value.actor,verb:value.verb,object:value.object,quantity:value.quantity};
}
function meaningKey(value){return JSON.stringify([value.actor,value.verb,value.object,value.quantity]);}
export function meaningsEqual(a,b){
  const aa=normalizeMeaning(a),bb=normalizeMeaning(b);return Boolean(aa&&bb&&meaningKey(aa)===meaningKey(bb));
}
function roleGloss(role,value){
  if(role==='actor')return value==='i'?'I (the speaker)':'you (the addressee)';
  if(role==='quantity')return String(value);return String(value).replaceAll('_',' ');
}
export function semanticGloss(value){
  const m=normalizeMeaning(value);if(!m)return null;
  return 'actor: '+roleGloss('actor',m.actor)+' · action: '+m.verb+' · quantity: '+m.quantity+' · object: '+roleGloss('object',m.object);
}
export function validateVersion(input){
  assert(obj(input),'A language version must be an object');
  assert(input.schemaVersion===1,'Only language schema version 1 is supported');
  const languageId=identifier(input.languageId,'languageId'),versionId=identifier(input.versionId,'versionId');
  assert(Number.isSafeInteger(input.number)&&input.number>=1&&input.number<=10000,'Version number must be 1–10000');
  if(input.number===1)assert(input.parentVersionId===null,'Version 1 must have no parent');else identifier(input.parentVersionId,'parentVersionId');
  assert(obj(input.grammar)&&['SOV','SVO'].includes(input.grammar.order),'Grammar order must be SOV or SVO');
  assert(input.grammar.quantityPosition==='before-object','Only quantity-before-object noun phrases are supported');
  assert(Array.isArray(input.lexicon)&&input.lexicon.length>=1&&input.lexicon.length<=64,'The lexicon must contain 1–64 entries');
  const ids=new Set(),canonical=new Set(),surfaceCounts=new Map();
  const lexicon=Array.from(input.lexicon,entry=>{
    assert(obj(entry),'Each lexicon entry must be an object');
    const id=identifier(entry.id,'Lexicon entry id');assert(!ids.has(id),'Duplicate lexicon entry id: '+id);ids.add(id);
    assert(ROLES.includes(entry.role)&&semanticValue(entry.role,entry.meaning),'Unsupported meaning for entry '+id);
    const surface=form(entry.form);
    assert(entry.canonical===undefined||typeof entry.canonical==='boolean','Invalid canonical flag for '+id);
    const preferred=entry.canonical===true,semanticKey=entry.role+':'+JSON.stringify(entry.meaning);
    if(preferred){assert(!canonical.has(semanticKey),'More than one canonical form for '+semanticKey);canonical.add(semanticKey);}
    const surfaceKey=entry.role+':'+surface;surfaceCounts.set(surfaceKey,(surfaceCounts.get(surfaceKey)??0)+1);
    assert(surfaceCounts.get(surfaceKey)<=4,'More than four entries share role and form '+surfaceKey);
    return {id,role:entry.role,meaning:entry.meaning,form:surface,gloss:field(entry.gloss,id+' gloss',100),
      author:field(entry.author,id+' author',80),rationale:field(entry.rationale,id+' rationale'),canonical:preferred};
  });
  const sourceExamples=input.examples??[];
  assert(Array.isArray(sourceExamples)&&sourceExamples.length<=24,'At most 24 examples are supported');
  const exampleIds=new Set();
  const examples=Array.from(sourceExamples,example=>{
    assert(obj(example),'Each example must be an object');
    const id=identifier(example.id,'Example id');assert(!exampleIds.has(id),'Duplicate example id: '+id);exampleIds.add(id);
    const meaning=normalizeMeaning(example.meaning);assert(meaning,'Example '+id+' has an unsupported semantic shape');
    assert(example.note===undefined||typeof example.note==='string'&&example.note.length<=1000,'Example '+id+' note is too long');
    return {id,text:field(example.text,id+' text',240),meaning,note:example.note??''};
  });
  const version={schemaVersion:1,languageId,versionId,number:input.number,parentVersionId:input.parentVersionId,name:field(input.name,'Language name',80),
    grammar:{order:input.grammar.order,quantityPosition:'before-object',author:field(input.grammar.author,'Grammar author',80),rationale:field(input.grammar.rationale,'Grammar rationale')},
    lexicon,examples,author:field(input.author,'Version author',80),rationale:field(input.rationale,'Version rationale')};
  if(input.acceptance!==undefined){
    assert(obj(input.acceptance),'Acceptance metadata must be an object');
    version.acceptance={proposalId:identifier(input.acceptance.proposalId,'Accepted proposal id'),author:field(input.acceptance.author,'Acceptance author',80)};
  }return version;
}
function slots(v){return v.grammar.order==='SOV'?['actor','quantity','object','verb']:['actor','verb','quantity','object'];}
function derivationToken(entry,index){return {index,token:entry.form,role:entry.role,entryId:entry.id,meaning:entry.meaning,gloss:roleGloss(entry.role,entry.meaning),approvedLabel:entry.gloss};}
function tokenize(text){
  if(typeof text!=='string'||text.length>240)return {tokens:[],valid:false,issue:'TEXT_LIMIT'};
  let value=text.trim().normalize('NFC').toLowerCase();if(value.endsWith('.'))value=value.slice(0,-1).trim();
  const tokens=value?value.split(/\s+/u):[];
  return {tokens,valid:tokens.length>0&&tokens.length<=8&&tokens.every(token=>/^[\p{L}]+$/u.test(token)),issue:'TOKEN_FORMAT'};
}
function parseValidated(v,text){
  const tokenized=tokenize(text),tokens=tokenized.tokens;
  const base={versionId:v.versionId,tokens,meaning:null,readings:[],unknownWords:[],issues:[]};
  if(!tokenized.valid)return {...base,status:'invalid_syntax',issues:[{code:tokenized.issue}]};
  const known=new Set(v.lexicon.map(entry=>entry.form)),unknownWords=[...new Set(tokens.filter(token=>!known.has(token)))];
  if(unknownWords.length)return {...base,status:'unknown_words',unknownWords,issues:[{code:'UNKNOWN_WORDS'}]};
  if(tokens.length!==4)return {...base,status:'invalid_syntax',issues:[{code:'EXPECTED_FOUR_TOKENS'}]};
  const roles=slots(v),candidates=roles.map((role,index)=>v.lexicon.filter(entry=>entry.role===role&&entry.form===tokens[index]));
  if(candidates.some(entries=>entries.length===0))return {...base,status:'invalid_syntax',issues:[{code:'ROLE_ORDER_MISMATCH',expectedRoles:roles}]};
  const readingsByMeaning=new Map();
  function visit(index,entries){
    if(index<4){for(const entry of candidates[index])visit(index+1,[...entries,entry]);return;}
    const fields=Object.fromEntries(entries.map(entry=>[entry.role,entry.meaning])),meaning=normalizeMeaning(fields),key=meaningKey(meaning);
    if(!readingsByMeaning.has(key))readingsByMeaning.set(key,{meaning,derivations:[]});
    readingsByMeaning.get(key).derivations.push(entries.map(derivationToken));
  }
  visit(0,[]);const readings=[...readingsByMeaning.values()];
  return {...base,status:readings.length===1?'ok':'ambiguous',readings,meaning:readings.length===1?readings[0].meaning:null,
    issues:readings.length===1?[]:[{code:'MULTIPLE_MEANINGS',count:readings.length}]};
}
export function parse(v,text){return parseValidated(validateVersion(v),text);}
function composeValidated(v,requestedMeaning){
  const meaning=normalizeMeaning(requestedMeaning),base={versionId:v.versionId,text:null,meaning,derivation:[],issues:[]};
  if(!meaning)return {...base,status:'unexpressible',issues:[{code:'UNSUPPORTED_MEANING_SHAPE'}]};
  const selected={},issues=[];
  for(const role of ROLES){
    const matches=v.lexicon.filter(entry=>entry.role===role&&entry.meaning===meaning[role]);
    if(!matches.length){issues.push({code:'NO_ACCEPTED_WORD',role,meaning:meaning[role]});continue;}
    const preferred=matches.find(entry=>entry.canonical);
    if(preferred||matches.length===1)selected[role]=preferred??matches[0];
    else issues.push({code:'FORM_CHOICE_REQUIRED',role,entryIds:matches.map(entry=>entry.id)});
  }
  if(issues.length)return {...base,status:issues.some(issue=>issue.code==='NO_ACCEPTED_WORD')?'unexpressible':'choice_required',issues};
  const entries=slots(v).map(role=>selected[role]),text=entries.map(entry=>entry.form).join(' '),parsed=parseValidated(v,text),derivation=entries.map(derivationToken);
  if(parsed.status!=='ok'||!meaningsEqual(parsed.meaning,meaning))return {...base,text,derivation,status:'ambiguous',issues:[{code:'GENERATED_FORM_HAS_MULTIPLE_MEANINGS'}],readings:parsed.readings};
  return {...base,status:'ok',text,derivation};
}
export function compose(v,meaning){return composeValidated(validateVersion(v),meaning);}
function impactValidated(base,candidate){
  const examples=base.examples.map(example=>{
    const before=parseValidated(base,example.text),after=parseValidated(candidate,example.text);
    const sourceVerified=before.status==='ok'&&meaningsEqual(before.meaning,example.meaning);
    const meaningPreserved=sourceVerified&&after.status==='ok'&&meaningsEqual(after.meaning,example.meaning);
    const migration=composeValidated(candidate,example.meaning);
    const outcome=!sourceVerified?'source_unverified':meaningPreserved?'preserved':after.status==='ok'?'meaning_changed':after.status;
    return {id:example.id,oldText:example.text,intendedMeaning:example.meaning,before,after,sourceVerified,meaningPreserved,outcome,migration};
  });
  return {baseVersionId:base.versionId,candidateVersionId:candidate.versionId,examples,summary:{
    total:examples.length,unchanged:examples.filter(e=>e.meaningPreserved).length,changed:examples.filter(e=>!e.meaningPreserved).length,
    ambiguous:examples.filter(e=>e.after.status==='ambiguous').length,invalid:examples.filter(e=>e.after.status==='invalid_syntax').length,
    unknown:examples.filter(e=>e.after.status==='unknown_words').length,sourceUnverified:examples.filter(e=>!e.sourceVerified).length,
    migrationsAvailable:examples.filter(e=>e.sourceVerified&&e.migration.status==='ok').length,
    unresolved:examples.filter(e=>!e.sourceVerified||e.migration.status!=='ok').length}};
}
export function analyzeImpact(baseInput,candidateInput){
  const base=validateVersion(baseInput),candidate=validateVersion(candidateInput);
  assert(base.languageId===candidate.languageId,'Impact comparison requires the same language','INVALID_REVISION');return impactValidated(base,candidate);
}
function normalizePatch(base,input){
  assert(obj(input),'A revision must be an object','INVALID_REVISION');
  assert(Object.keys(input).every(key=>['id','author','rationale','order','wordChanges','addEntries'].includes(key)),'The revision contains unsupported fields','INVALID_REVISION');
  const id=identifier(input.id,'Proposal id'),author=field(input.author,'Proposal author',80),rationale=field(input.rationale,'Proposal rationale');
  const order=input.order??base.grammar.order;assert(['SOV','SVO'].includes(order),'A proposed order must be SOV or SVO','INVALID_REVISION');
  const requestedChanges=input.wordChanges??[];
  assert(Array.isArray(requestedChanges)&&requestedChanges.length<=16,'At most 16 word changes are supported','INVALID_REVISION');
  const seen=new Set();
  const wordChanges=Array.from(requestedChanges,change=>{
    assert(obj(change)&&Object.keys(change).every(key=>['entryId','form'].includes(key)),'A word change contains unsupported fields','INVALID_REVISION');
    const entryId=identifier(change.entryId,'Changed entry id');
    assert(!seen.has(entryId),'Entry '+entryId+' is changed twice','INVALID_REVISION');seen.add(entryId);
    assert(base.lexicon.some(entry=>entry.id===entryId),'No accepted entry exists with id '+entryId,'INVALID_REVISION');
    return {entryId,form:form(change.form)};
  });
  const requestedAdditions=input.addEntries??[];
  assert(Array.isArray(requestedAdditions)&&requestedAdditions.length<=16,'At most 16 new entries are supported','INVALID_REVISION');
  const addEntries=requestedAdditions.length?validateVersion({...base,lexicon:requestedAdditions}).lexicon:[];
  return {id,author,rationale,order,wordChanges,addEntries};
}
export function proposeRevision(baseInput,requestedPatch){
  const base=validateVersion(baseInput),patch=normalizePatch(base,requestedPatch),changes=[];
  if(patch.order!==base.grammar.order)changes.push({type:'grammar_order',from:base.grammar.order,to:patch.order});
  const byId=new Map(patch.wordChanges.map(change=>[change.entryId,change.form]));
  const lexicon=base.lexicon.map(entry=>{
    const nextForm=byId.get(entry.id);
    if(nextForm===undefined||nextForm===entry.form)return {...entry};
    changes.push({type:'word_form',entryId:entry.id,role:entry.role,meaning:entry.meaning,from:entry.form,to:nextForm});
    return {...entry,form:nextForm,author:patch.author,rationale:patch.rationale};
  });
  for(const entry of patch.addEntries){
    changes.push({type:'word_added',entryId:entry.id,role:entry.role,meaning:entry.meaning,form:entry.form});lexicon.push({...entry});
  }
  assert(changes.length>0,'The proposal does not change an accepted word or grammar rule','EMPTY_REVISION');
  assert(base.number<10000,'The supported version bound has been reached','VERSION_LIMIT');
  const nextNumber=base.number+1,versionSuffix='-v'+nextNumber;
  const nextVersionId=base.languageId.slice(0,64-versionSuffix.length)+versionSuffix;
  const rawCandidate={...base,versionId:nextVersionId,number:nextNumber,parentVersionId:base.versionId,
    author:patch.author,rationale:patch.rationale,
    grammar:{...base.grammar,order:patch.order,author:patch.order===base.grammar.order?base.grammar.author:patch.author,
      rationale:patch.order===base.grammar.order?base.grammar.rationale:patch.rationale},
    lexicon,examples:base.examples.map(example=>({...example,meaning:{...example.meaning}}))};
  delete rawCandidate.acceptance;
  const candidate=validateVersion(rawCandidate),impact=impactValidated(base,candidate);
  candidate.examples=candidate.examples.map((example,index)=>{
    const check=impact.examples[index];return {...example,text:check.sourceVerified&&check.migration.status==='ok'?check.migration.text:example.text};
  });
  return freeze({id:patch.id,baseVersionId:base.versionId,baseSignature:JSON.stringify(base),patch,changes,candidate:validateVersion(candidate),impact});
}
function validatedHistory(input){
  assert(Array.isArray(input)&&input.length>=1&&input.length<=100,'History must contain 1–100 versions','INVALID_HISTORY');
  const history=Array.from(input,validateVersion),seen=new Set();
  for(let index=0;index<history.length;index++){
    const v=history[index];assert(!seen.has(v.versionId),'History contains a duplicate version id','INVALID_HISTORY');seen.add(v.versionId);
    if(index===0)assert(v.number===1&&v.parentVersionId===null,'History must begin with version 1','INVALID_HISTORY');
    else{const previous=history[index-1];assert(v.languageId===previous.languageId&&v.number===previous.number+1&&v.parentVersionId===previous.versionId,
      'History contains a broken version chain','INVALID_HISTORY');}
  }return history;
}
export {validatedHistory as validateHistory};
export function acceptRevision(historyInput,proposal,approval){
  assert(obj(approval)&&approval.accept===true,'Explicit acceptance is required','ACCEPTANCE_REQUIRED');
  const acceptingAuthor=field(approval.author,'Acceptance author',80),history=validatedHistory(historyInput),current=history[history.length-1];
  assert(history.length<100,'The supported history bound has been reached','VERSION_LIMIT');
  assert(obj(proposal)&&obj(proposal.patch),'A complete proposal is required','INVALID_REVISION');
  assert(proposal.baseVersionId===current.versionId&&proposal.baseSignature===JSON.stringify(current),
    'This proposal was made against a different accepted base; review a fresh proposal','STALE_BASE');
  assert(proposal.id===proposal.patch.id,'Proposal identity does not match its patch','INVALID_REVISION');
  assert(!history.some(v=>v.acceptance?.proposalId===proposal.id),'This proposal was already accepted','DUPLICATE_PROPOSAL');
  const reviewed=proposeRevision(current,proposal.patch);
  assert(JSON.stringify(validateVersion(proposal.candidate))===JSON.stringify(reviewed.candidate),
    'The supplied preview no longer matches the proposal; review a fresh preview','PROPOSAL_MISMATCH');
  assert(reviewed.impact.summary.unresolved===0,
    'Some examples have unverified source meanings or cannot migrate unambiguously; resolve them before acceptance','UNRESOLVED_EXAMPLES');
  const next=validateVersion({...reviewed.candidate,acceptance:{proposalId:reviewed.id,author:acceptingAuthor}});
  for(const example of next.examples){
    const parsed=parseValidated(next,example.text);assert(parsed.status==='ok'&&meaningsEqual(parsed.meaning,example.meaning),'An accepted example failed its semantic check','UNRESOLVED_EXAMPLES');
  }
  assert(!history.some(v=>v.versionId===next.versionId),'The proposed version id already exists','DUPLICATE_VERSION');
  return freeze([...history,next]);
}

