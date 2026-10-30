// Independent consumer receiver /root/consumer_recovery; frozen before implementation review.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(process.env.GLOSSOPIA_APP_ROOT??fileURLToPath(new URL('../../',import.meta.url)));
const evidence=resolve(process.env.GLOSSOPIA_EVIDENCE??'test-output/preference');
const {chromium}=await import(process.env.GLOSSOPIA_PLAYWRIGHT??'playwright');
const {createServer}=await import(pathToFileURL(resolve(root,'server.mjs')));
const {starterLanguage}=await import(pathToFileURL(resolve(root,'src/starter-language.mjs')));
const {createProject}=await import(pathToFileURL(resolve(root,'src/project.mjs')));
const server=process.env.GLOSSOPIA_URL?null:createServer();
if(server)await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=process.env.GLOSSOPIA_URL??'http://127.0.0.1:'+server.address().port;
await mkdir(evidence,{recursive:true});
const results=[];let browser;
const state=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('glossopia-project-v1')));
const review=p=>p.locator('#proposalForm button[type=submit]').click();
const entry=(id,meaning,form,canonical=false)=>({id,role:'object',meaning,form,canonical,gloss:meaning,author:'Original author',rationale:'Original word reasoning'});
function fixture(ambiguous=false){const v=structuredClone(starterLanguage);v.lexicon.push(entry('basket-a','basket','selu'),entry('basket-b','basket','sela'));if(ambiguous)v.lexicon.push(entry('box','box','sela',true));return createProject(v);}
async function open(p,project){await p.locator('#projectFile').setInputFiles({name:'synonyms.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});await p.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Project opened'));}
async function meaning(p){for(const [role,value] of Object.entries({Actor:'you',Verb:'give',Quantity:2,Object:'basket'}))await p.locator('#workbench'+role).selectOption(JSON.stringify(value));}
async function select(p,id){await p.locator('#changeKind').selectOption('preference');await p.locator('#preferredMeaning').selectOption(JSON.stringify(['object','basket']));await p.locator('#preferredEntry').selectOption(id);await p.locator('#proposalAuthor').fill('Preference author');await p.locator('#proposalRationale').fill('Choose an existing basket synonym');}
function expectedLexicon(base,id){const entries=structuredClone(base);for(const e of entries)if(e.role==='object'&&e.meaning==='basket')e.canonical=e.id===id;return entries;}
async function composition(p,status,text){assert.equal(await p.locator('#workbenchStatus').getAttribute('data-status'),status);if(text!==null)assert.equal((await p.locator('#workbenchSentence code').textContent()).trim(),text);}
try{
 browser=await chromium.launch({headless:true,...(process.env.GLOSSOPIA_CHROME?{executablePath:process.env.GLOSSOPIA_CHROME}:{}),...(process.env.GLOSSOPIA_NO_SANDBOX==='1'?{args:['--no-sandbox']}:{})});
 async function scenario(name,run){const context=await browser.newContext(),p=await context.newPage(),errors=[];p.setDefaultTimeout(5000);p.on('pageerror',e=>errors.push(String(e)));try{await p.goto(url);await p.locator('#wordBank button').first().waitFor();await p.locator('#tab-studio').click();await run(p);assert.deepEqual(errors,[]);results.push({name,status:'passed'});console.log('PASS '+name);}finally{await context.close();}}
 await scenario('Choose and switch existing preferred vocabulary through review, history and acceptance',async p=>{
  const imported=fixture();await open(p,imported);await meaning(p);await composition(p,'choice_required',null);
  await select(p,'basket-b');await review(p);assert.deepEqual(await state(p),imported);
  assert.equal(await p.locator('#impactPanel').isVisible(),true);
  const preview=await p.locator('#impactRows').textContent();assert.match(preview,/prefer/i);assert.match(preview,/sela/);assert.match(preview,/basket/);
  await p.locator('#acceptProposal').click();const second=await state(p);
  assert.equal(second.history.length,2);assert.deepEqual(second.history[0],imported.history[0]);
  assert.deepEqual(second.history[1].lexicon,expectedLexicon(imported.history[0].lexicon,'basket-b'));
  assert.deepEqual(second.sessions,imported.sessions);assert.equal(second.activeSessionId,imported.activeSessionId);
  await composition(p,'ok','tu du sela di');
  // Whole no-op must not create another accepted version or an accept-ready preview.
  await select(p,'basket-b');await review(p);assert.deepEqual(await state(p),second);
  assert.equal(await p.locator('#impactPanel').isVisible(),false);assert.ok((await p.locator('#proposalFeedback').textContent()).trim());
  // Review a switch, inspect history, then re-review; selected identity must survive.
  await select(p,'basket-a');await review(p);const switchPreview=await p.locator('#impactRows').textContent();
  assert.match(switchPreview,/selu/);assert.match(switchPreview,/sela/);assert.match(switchPreview,/prefer/i);
  await p.locator('#tab-history').click();await p.getByRole('button',{name:'Inspect version 1',exact:true}).click();
  assert.equal(await p.locator('#preferredEntry').isDisabled(),true);await composition(p,'choice_required',null);
  assert.equal(await p.locator('#preferredEntry').inputValue(),'basket-a');
  await p.getByRole('button',{name:'Return to latest version',exact:true}).click();
  assert.equal(await p.locator('#preferredEntry').inputValue(),'basket-a');assert.equal(await p.locator('#preferredEntry').isDisabled(),false);
  assert.equal(await p.locator('#impactRows').textContent(),switchPreview);await review(p);await p.locator('#acceptProposal').click();
  const third=await state(p);assert.equal(third.history.length,3);assert.deepEqual(third.history.slice(0,2),second.history);
  assert.deepEqual(third.history[2].lexicon,expectedLexicon(second.history[1].lexicon,'basket-a'));
  assert.deepEqual(third.sessions,imported.sessions);assert.equal(third.activeSessionId,imported.activeSessionId);
  await composition(p,'ok','tu du selu di');await p.screenshot({path:resolve(evidence,'existing-preference-switched.png'),fullPage:true});
 });
 await scenario('Editing selected entry invalidates a pending preference before acceptance',async p=>{
  const imported=fixture();await open(p,imported);await select(p,'basket-b');await review(p);assert.equal(await p.locator('#impactPanel').isVisible(),true);
  await p.locator('#preferredEntry').selectOption('basket-a');assert.equal(await p.locator('#impactPanel').isVisible(),false);assert.deepEqual(await state(p),imported);
  await review(p);assert.match(await p.locator('#impactRows').textContent(),/selu/);await p.locator('#acceptProposal').click();
  const accepted=await state(p);assert.equal(accepted.history.length,2);assert.deepEqual(accepted.history[1].lexicon,expectedLexicon(imported.history[0].lexicon,'basket-a'));
 });
 await scenario('Preferred ambiguous surface retains explicit ambiguity and both readings',async p=>{
  const imported=fixture(true);await open(p,imported);await meaning(p);await select(p,'basket-b');await review(p);await p.locator('#acceptProposal').click();
  const accepted=await state(p);assert.equal(accepted.history.length,2);assert.deepEqual(accepted.history[1].lexicon,expectedLexicon(imported.history[0].lexicon,'basket-b'));
  assert.deepEqual(accepted.sessions,imported.sessions);await composition(p,'ambiguous','tu du sela di');
  const warning=p.locator('#workbenchSentence > small');assert.equal(await warning.isVisible(),true);assert.match(await warning.textContent(),/unverified|ambiguous|more than one meaning/i);
  const issues=await p.locator('#workbenchIssues').textContent();assert.match(issues,/basket/);assert.match(issues,/box/);
  await p.screenshot({path:resolve(evidence,'preferred-ambiguity.png'),fullPage:true});
 });
 await writeFile(resolve(evidence,'preference-results.json'),JSON.stringify({author:'/root/consumer_recovery',app_root:root,url,browser:await browser.version(),results},null,2)+'\n');
}catch(error){await writeFile(resolve(evidence,'preference-failure.json'),JSON.stringify({results,error:String(error),stack:error.stack},null,2)+'\n');throw error;}
finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));}
