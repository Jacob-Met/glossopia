// Independent receiver authored by retained receipt_recovery worker.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const appRoot=resolve(process.env.GLOSSOPIA_APP_ROOT??fileURLToPath(new URL('../../',import.meta.url)));
const evidence=resolve(process.env.GLOSSOPIA_EVIDENCE??'test-output/practice-drafts');
const {chromium}=await import(process.env.GLOSSOPIA_PLAYWRIGHT??'playwright');
const {createServer}=await import(pathToFileURL(resolve(appRoot,'server.mjs')));
await mkdir(evidence,{recursive:true});
const server=process.env.GLOSSOPIA_URL?null:createServer();
if(server)await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=process.env.GLOSSOPIA_URL??('http://127.0.0.1:'+server.address().port);
const results=[];let browser;
const draft=p=>p.locator('#sentenceInput');
const state=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('glossopia-project-v1')));
async function resume(p,id){await p.locator('#tab-history').click();await p.locator('#practiceRecords button').filter({hasText:id+' ·'}).click();}
async function open(p,text,name='project.json'){await p.locator('#projectFile').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(text)});}
try{
 browser=await chromium.launch({headless:true,...(process.env.GLOSSOPIA_CHROME?{executablePath:process.env.GLOSSOPIA_CHROME}:{}),...(process.env.GLOSSOPIA_NO_SANDBOX==='1'?{args:['--no-sandbox']}:{})});
 async function scenario(name,run){const context=await browser.newContext(),p=await context.newPage(),errors=[];p.setDefaultTimeout(5000);p.on('pageerror',e=>errors.push(String(e)));try{await p.goto(url);await p.locator('#wordBank button').first().waitFor();await run(p);assert.deepEqual(errors,[]);results.push({name,status:process.env.EXPECT_BASELINE_FAILURE==='1'?'observed-defect':'passed'});console.log((process.env.EXPECT_BASELINE_FAILURE==='1'?'BASELINE DEFECT ':'PASS ')+name);}finally{await context.close();}}
 await scenario('Distinct practices isolate and restore unfinished text',async p=>{
  const a=(await state(p)).activeSessionId;await draft(p).fill('draft for A');await p.locator('#restartMission').click();
  if(process.env.EXPECT_BASELINE_FAILURE==='1'){assert.equal(await draft(p).inputValue(),'draft for A');return;}
  assert.equal(await draft(p).inputValue(),'');const b=(await state(p)).activeSessionId;assert.notEqual(a,b);await draft(p).fill('draft for B');await resume(p,a);assert.equal(await draft(p).inputValue(),'draft for A');await resume(p,b);assert.equal(await draft(p).inputValue(),'draft for B');await p.screenshot({path:resolve(evidence,'session-B-restored.png'),fullPage:true});
 });
 if(process.env.EXPECT_BASELINE_FAILURE!=='1'){
 await scenario('Accepted SVO revision keeps original SOV draft with its conversation',async p=>{
  const a=(await state(p)).activeSessionId;await draft(p).fill('mi un lum na');await p.locator('#tab-studio').click();await p.locator('#proposedOrder').selectOption('SVO');await p.locator('#proposalRationale').fill('Test distinct language contexts');await p.locator('#proposalForm button[type=submit]').click();await p.locator('#acceptProposal').click();assert.equal((await state(p)).history.length,2);await p.locator('#tab-history').click();await p.getByRole('button',{name:'Practice version 2',exact:true}).click();assert.equal(await draft(p).inputValue(),'');const b=(await state(p)).activeSessionId;await draft(p).fill('mi na un lum');await resume(p,a);assert.equal(await draft(p).inputValue(),'mi un lum na');await resume(p,b);assert.equal(await draft(p).inputValue(),'mi na un lum');
 });
 await scenario('Hint commits preserve draft; submitted and cleared text never returns',async p=>{
  const a=(await state(p)).activeSessionId;await draft(p).fill('mi un lum na');await draft(p).evaluate(el=>el.setSelectionRange(3,6));await p.locator('#showHint').click();assert.deepEqual(await draft(p).evaluate(el=>[el.selectionStart,el.selectionEnd]),[3,6]);assert.equal(await draft(p).inputValue(),'mi un lum na');await p.locator('#saySentence').click();assert.equal(await draft(p).inputValue(),'');await p.locator('#restartMission').click();await resume(p,a);assert.equal(await draft(p).inputValue(),'');await draft(p).fill('clear me');await p.locator('#clearSentence').click();await p.locator('#restartMission').click();await resume(p,a);assert.equal(await draft(p).inputValue(),'');
 });
 await scenario('Word-bank and word-order suggestion drafts survive switching',async p=>{
  const a=(await state(p)).activeSessionId;await p.locator('#wordBank button').first().click();const word=await draft(p).inputValue();assert.ok(word);await p.locator('#restartMission').click();await resume(p,a);assert.equal(await draft(p).inputValue(),word);await draft(p).fill('na lum un mi');await p.locator('#saySentence').click();await p.locator('#applyWordOrder').click();assert.equal(await draft(p).inputValue(),'mi un lum na');await p.locator('#restartMission').click();await resume(p,a);assert.equal(await draft(p).inputValue(),'mi un lum na');
 });
 await scenario('Rejected 101st utterance retains active and inactive drafts',async p=>{
  const initial=await state(p);initial.sessions[0].inputs=Array(100).fill('nonsense');await open(p,JSON.stringify(initial));await p.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Project opened'));const a=(await state(p)).activeSessionId;await p.locator('#restartMission').click();const b=(await state(p)).activeSessionId;await draft(p).fill('inactive B');await resume(p,a);await draft(p).fill('mi un lum na');await p.locator('#saySentence').click();assert.match(await p.locator('#sentenceFeedback').textContent(),/100 utterances/);assert.equal(await draft(p).inputValue(),'mi un lum na');await resume(p,b);assert.equal(await draft(p).inputValue(),'inactive B');await resume(p,a);assert.equal(await draft(p).inputValue(),'mi un lum na');
 });
 await scenario('Create and archive replacement clear hidden drafts and show warning',async p=>{
  const a=(await state(p)).activeSessionId;await draft(p).fill('hidden old draft');await p.locator('#restartMission').click();await p.locator('#newLanguage').click();await p.locator('#creationName').fill('Receiver language');await p.locator('#creationAuthor').fill('Receiver');const {starterLanguage}=await import(pathToFileURL(resolve(appRoot,'src/starter-language.mjs')));for(const entry of starterLanguage.lexicon)await p.locator('#creationForm-'+entry.id).fill(entry.form);await p.locator('#reviewCreation').click();assert.equal(await p.locator('#creationDraftNotice').isVisible(),true);await p.locator('#createLanguage').click();assert.equal(await draft(p).inputValue(),'');const c=(await state(p)).activeSessionId;await draft(p).fill('hidden new draft');await p.locator('#restartMission').click();await p.locator('#savedProjects').click();assert.equal(await p.locator('#archiveDraftNotice').isVisible(),true);await p.locator('#archivedProjects button[data-action=open]').first().click();await resume(p,a);assert.equal(await draft(p).inputValue(),'');await p.locator('#savedProjects').click();await p.locator('#archivedProjects button[data-action=open]').first().click();await resume(p,c);assert.equal(await draft(p).inputValue(),'');
 });
 await scenario('Draft note fits narrow market layout',async p=>{
  await p.setViewportSize({width:390,height:844});const dimensions=await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));assert.ok(dimensions.scroll<=dimensions.width+1);await p.screenshot({path:resolve(evidence,'narrow-draft-note.png'),fullPage:true});
 });
 await scenario('Invalid Open preserves both drafts; accepted same-ID Open clears both',async p=>{
  const a=(await state(p)).activeSessionId;await draft(p).fill('draft A');await p.locator('#restartMission').click();const b=(await state(p)).activeSessionId;await draft(p).fill('draft B');const saved=await p.evaluate(()=>localStorage.getItem('glossopia-project-v1'));await open(p,'{');await p.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Could not open'));assert.equal(await draft(p).inputValue(),'draft B');await resume(p,a);assert.equal(await draft(p).inputValue(),'draft A');await open(p,saved);await p.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Project opened'));assert.equal(await draft(p).inputValue(),'');await resume(p,a);assert.equal(await draft(p).inputValue(),'');await resume(p,b);assert.equal(await draft(p).inputValue(),'');
 });
 await scenario('Switching during delayed Open preserves both drafts and supersedes Open',async p=>{
  const a=(await state(p)).activeSessionId;await draft(p).fill('draft A');await p.locator('#restartMission').click();const b=(await state(p)).activeSessionId;await draft(p).fill('draft B');const saved=await p.evaluate(()=>localStorage.getItem('glossopia-project-v1'));await p.evaluate(()=>{File.prototype.text=function(){return new Promise(resolve=>window.finishDraftOpen=resolve);};});await open(p,saved);await p.waitForFunction(()=>!!window.finishDraftOpen);await resume(p,a);await p.evaluate(text=>window.finishDraftOpen(text),saved);await p.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Open skipped'));assert.equal(await draft(p).inputValue(),'draft A');await resume(p,b);assert.equal(await draft(p).inputValue(),'draft B');
 });
 }
 await writeFile(resolve(evidence,'practice-drafts-results.json'),JSON.stringify({author:'receipt_recovery',app_root:appRoot,browser:await browser.version(),baseline:process.env.EXPECT_BASELINE_FAILURE==='1',results},null,2)+'\n');
}catch(error){await writeFile(resolve(evidence,'practice-drafts-failure.json'),JSON.stringify({results,error:String(error),stack:error.stack},null,2)+'\n');throw error;}finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));}
