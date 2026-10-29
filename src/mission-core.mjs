import {validateVersion,parse,compose,meaningsEqual,semanticGloss} from './language-core.mjs';
import {starterMission} from './starter-language.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
const sessionId=/^[A-Za-z][A-Za-z0-9_-]{0,79}$/;
export function describeMeaning(m){
  const actor=m.actor==='i'?'I':'You',verb=m.verb==='request'?'want':m.verb;
  const quantity=({1:'one',2:'two',3:'three'})[m.quantity]??String(m.quantity);
  const noun=m.object.replaceAll('_',' ')+(m.quantity===1?'':'s');
  return actor+' '+verb+' '+quantity+' '+noun+'.';
}
function requirePlayable(v){
  const meanings=[...starterMission.stages.map(s=>s.expected),
    {actor:'i',verb:'request',object:'pear',quantity:2},{actor:'you',verb:'have',object:'lantern',quantity:1}];
  const unresolved=meanings.filter(m=>compose(v,m).status!=='ok');
  if(unresolved.length)throw new Error('This language version cannot express every required market statement unambiguously.');
}
export function canPlayMission(version){
  try{requirePlayable(validateVersion(version));return {available:true,reason:null};}
  catch(error){return {available:false,reason:error.message};}
}
export function validateSession(input,version){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('A practice session must be an object.');
  if(typeof input.id!=='string'||!sessionId.test(input.id))throw new Error('Invalid practice session identity.');
  if(input.versionId!==version.versionId)throw new Error('The conversation is bound to a different language version.');
  if(!Array.isArray(input.inputs)||input.inputs.length>100)throw new Error('A conversation supports at most 100 utterances.');
  const inputs=Array.from(input.inputs,text=>{
    if(typeof text!=='string'||text.length>240)throw new Error('Each utterance must be text of at most 240 characters.');
    return text;
  });
  if(!Number.isSafeInteger(input.hintsUsed)||input.hintsUsed<0||input.hintsUsed>1000)throw new Error('Invalid hint counter.');
  return {id:input.id,versionId:version.versionId,inputs,hintsUsed:input.hintsUsed};
}
export function startMission(versionInput,id='practice-1'){
  const v=validateVersion(versionInput);requirePlayable(v);
  return validateSession({id,versionId:v.versionId,inputs:[],hintsUsed:0},v);
}
function offGoal(meaning,stage,inventory){
  const understood='Understood: '+describeMeaning(meaning)+' ';
  if(!['pear','lantern'].includes(meaning.object))return understood+'This trader has no exchange for that item. Language can name things the market does not stock.';
  if(meaning.actor!=='i')return understood+'Speak for yourself with the word for I.';
  if(stage===0)return understood+'First ask for exactly one lantern. Nothing has moved from your bag.';
  if(stage===1)return understood+'The agreed price is exactly two pears. Your bag is unchanged.';
  if(stage===2)return understood+'The exchange is already complete: you have '+inventory.pear+' pear and '+inventory.lantern+' lantern. Confirm that you have one lantern.';
  return 'This conversation is complete. No further exchange was made.';
}
export function replayMission(versionInput,sessionInput){
  const v=validateVersion(versionInput),source=validateSession(sessionInput,v);requirePlayable(v);
  const inventory=clone(starterMission.initialInventory),events=[{speaker:'merchant',text:starterMission.opening,meaning:null,status:'opening'}],results=[];
  let stage=0;
  for(const text of source.inputs){
    const parsed=parse(v,text);let status,feedback;
    events.push({speaker:'player',text,meaning:parsed.status==='ok'?parsed.meaning:null,status:parsed.status,readings:parsed.readings});
    if(stage>=starterMission.stages.length){status='complete';feedback='This conversation is complete. No further exchange was made.';}
    else if(parsed.status==='unknown_words'){status='unknown_words';feedback='These words are not accepted in this version: '+parsed.unknownWords.join(', ')+'. Inspect the word bank or propose a word in the studio.';}
    else if(parsed.status==='ambiguous'){status='ambiguous';feedback='That sentence has '+parsed.readings.length+' possible meanings. No trade was made; choose an unambiguous expression.';}
    else if(parsed.status!=='ok'){status='invalid_syntax';feedback='Those words do not form a sentence under this version’s '+v.grammar.order+' rule. Use who, an action, a quantity and a thing in the displayed order.';}
    else if(!meaningsEqual(parsed.meaning,starterMission.stages[stage].expected)){
      status='off_goal';feedback=offGoal(parsed.meaning,stage,inventory);
    }else{
      status='accepted';
      if(stage===0){
        const reply=compose(v,{actor:'i',verb:'request',object:'pear',quantity:2});
        events.push({speaker:'merchant',text:reply.text,meaning:reply.meaning,status:'offer'});
        feedback='The trader asks for two pears. Your request has not moved any inventory.';
      }else if(stage===1){
        if(inventory.pear<2)throw new Error('The exchange has insufficient inventory.');
        inventory.pear-=2;inventory.lantern+=1;
        const reply=compose(v,{actor:'you',verb:'have',object:'lantern',quantity:1});
        events.push({speaker:'merchant',text:reply.text,meaning:reply.meaning,status:'receipt'});
        feedback='Two pears exchanged for one lantern. Now confirm what you received.';
      }else{
        feedback=starterMission.success;events.push({speaker:'system',text:feedback,meaning:null,status:'success'});
      }stage++;
    }
    results.push({index:results.length,status,feedback,meaning:parsed.meaning,interpretation:parsed.status,inventory:{...inventory},stage});
  }
  const complete=stage===starterMission.stages.length,goal=complete?starterMission.success:starterMission.stages[stage].goal;
  return {source,versionId:v.versionId,stage,complete,inventory,events,results,goal,lastResult:results.at(-1)??null,
    expected:complete?null:clone(starterMission.stages[stage].expected)};
}
export function submitSentence(version,session,text){
  const current=validateSession(session,validateVersion(version));
  if(current.inputs.length>=100)throw new Error('This conversation has reached 100 utterances. Start a new practice.');
  if(typeof text!=='string'||text.length>240)throw new Error('An utterance must be text of at most 240 characters.');
  const next={...current,inputs:[...current.inputs,text]};
  return {session:next,state:replayMission(version,next)};
}
