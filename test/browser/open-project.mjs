import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

// Optional browser receiver. Core npm test and running the app need no dependencies.
const appRoot=resolve(process.env.GLOSSOPIA_APP_ROOT??fileURLToPath(new URL('../../',import.meta.url)));
const evidence=resolve(process.env.GLOSSOPIA_EVIDENCE??'test-output/open-project');
const {chromium}=await import(process.env.GLOSSOPIA_PLAYWRIGHT??'playwright');
const {createServer}=await import(pathToFileURL(resolve(appRoot,'server.mjs')));
const {createProject,serializeProject}=await import(pathToFileURL(resolve(appRoot,'src/project.mjs')));
const {starterLanguage}=await import(pathToFileURL(resolve(appRoot,'src/starter-language.mjs')));
await mkdir(evidence,{recursive:true});
const server=process.env.GLOSSOPIA_URL?null:createServer();
if(server)await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=process.env.GLOSSOPIA_URL??('http://127.0.0.1:'+server.address().port);
let browser;
const results=[];
const imported=title=>serializeProject(createProject(starterLanguage,{title}));
const savedA=imported('Saved project A'),savedB=imported('Saved project B');
const key='glossopia-project-v1';
try{
 browser=await chromium.launch({headless:true,...(process.env.GLOSSOPIA_CHROME?{executablePath:process.env.GLOSSOPIA_CHROME}:{}),...(process.env.GLOSSOPIA_NO_SANDBOX==='1'?{args:['--no-sandbox']}:{})});
 async function scenario(name,run,{width=1440,height=1100}={}){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(5000);
  page.on('pageerror',error=>errors.push(String(error)));
  try{
   await page.goto(url);await page.locator('#wordBank button').first().waitFor();
   await page.evaluate(()=>{
    const read=File.prototype.text;window.openReads={};
    File.prototype.text=function(){
     if(!this.name.startsWith('slow-'))return read.call(this);
     return new Promise((resolve,reject)=>{window.openReads[this.name]={resolve,reject};});
    };
   });
   await run(page);assert.deepEqual(errors,[],'No browser exception');
   results.push({name,status:'passed'});console.log('PASS '+name);
  }finally{await context.close();}
 }
 const snapshot=page=>page.evaluate(key=>({stored:localStorage.getItem(key),project:JSON.parse(localStorage.getItem(key)),draft:document.querySelector('#sentenceInput').value,notice:document.querySelector('#toast').textContent}),key);
 async function choose(page,name='slow-A.json',text=savedA){
  await page.locator('#projectFile').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(text)});
  if(name.startsWith('slow-'))await page.waitForFunction(name=>!!window.openReads[name],name);
 }
 async function finish(page,name='slow-A.json',text=savedA,error){
  await page.evaluate(async({name,text,error})=>{
   const request=window.openReads[name];delete window.openReads[name];
   if(error)request.reject(new Error(error));else request.resolve(text);
   // Flush the handler continuation without relying on wall-clock sleeps.
   await Promise.resolve();await Promise.resolve();
  },{name,text,error});
 }
 async function kept(page,before){
  const after=await snapshot(page);
  assert.equal(after.stored,before.stored,'Saved project preserved byte for byte');
  assert.match(after.notice,/Open skipped because you made changes/);
  assert.equal(await page.locator('#projectFile').inputValue(),'','Same file can be selected again');
  return after;
 }
 async function preview(page){
  await page.locator('#tab-studio').click();
  await page.locator('#proposalRationale').fill('Put the action beside its speaker');
  await page.locator('#proposalForm button[type=submit]').click();
  await page.locator('#acceptProposal').waitFor();
 }
 await scenario('Later practice submission survives a delayed Open',async page=>{
  await choose(page);await page.locator('#sentenceInput').fill('mi un lum na');await page.locator('#saySentence').click();
  const before=await snapshot(page);assert.deepEqual(before.project.sessions[0].inputs,['mi un lum na']);
  await finish(page);const after=await kept(page,before);assert.equal(after.draft,'');
  await page.screenshot({path:resolve(evidence,'practice-kept.png'),fullPage:true});
  await page.reload();assert.deepEqual((await snapshot(page)).project.sessions[0].inputs,['mi un lum na']);
 });
 await scenario('Later accepted revision survives without subsequent typing',async page=>{
  await preview(page);await choose(page);await page.locator('#acceptProposal').click();
  const before=await snapshot(page);assert.equal(before.project.history.length,2);
  await finish(page);await kept(page,before);assert.match(await page.locator('#proposalFeedback').textContent(),/Accepted locally/);
 });
 await scenario('A newly typed sentence draft survives',async page=>{
  await choose(page);await page.locator('#sentenceInput').fill('mi un lum na');const before=await snapshot(page);
  await finish(page);assert.equal((await kept(page,before)).draft,'mi un lum na');
  await page.screenshot({path:resolve(evidence,'draft-kept.png'),fullPage:true});
 });
 await scenario('Editing and reverting a draft still supersedes Open',async page=>{
  await page.locator('#sentenceInput').fill('mi');await choose(page);
  await page.locator('#sentenceInput').fill('mi un');await page.locator('#sentenceInput').fill('mi');
  const before=await snapshot(page);await finish(page);assert.equal((await kept(page,before)).draft,'mi');
 });
 await scenario('Word bank insertion protects its programmatically filled draft',async page=>{
  await choose(page);await page.locator('#wordBank button').first().click();
  const before=await snapshot(page);assert.equal(before.draft,'mi');await finish(page);assert.equal((await kept(page,before)).draft,'mi');
 });
 await scenario('Clearing an existing sentence counts as later work',async page=>{
  await page.locator('#sentenceInput').fill('mi un lum na');await choose(page);await page.locator('#clearSentence').click();
  const before=await snapshot(page);await finish(page);assert.equal((await kept(page,before)).draft,'');
 });
 await scenario('Use this order protects the filled draft without adding a turn',async page=>{
  await page.locator('#sentenceInput').fill('na lum un mi');await page.locator('#saySentence').click();
  await page.locator('#applyWordOrder').waitFor();await choose(page);await page.locator('#applyWordOrder').click();
  const before=await snapshot(page);assert.equal(before.draft,'mi un lum na');assert.equal(before.project.sessions[0].inputs.length,1);
  await finish(page);assert.equal((await kept(page,before)).draft,'mi un lum na');
 });
 await scenario('Proposal field edits survive delayed Open',async page=>{
  await page.locator('#tab-studio').click();await choose(page);await page.locator('#proposalRationale').fill('A later draft reason');
  const before=await snapshot(page);await finish(page);await kept(page,before);assert.equal(await page.locator('#proposalRationale').inputValue(),'A later draft reason');
 });
 await scenario('Creating a proposal preview protects the preview',async page=>{
  await page.locator('#tab-studio').click();await page.locator('#proposalRationale').fill('A reason prepared before Open');
  await choose(page);await page.locator('#proposalForm button[type=submit]').click();const before=await snapshot(page);
  await finish(page);await kept(page,before);assert.equal(await page.locator('#impactPanel').isVisible(),true);assert.equal(await page.locator('#acceptProposal').isEnabled(),true);
 });
 await scenario('Discarding a pending proposal keeps the chosen project',async page=>{
  await preview(page);await choose(page);await page.locator('#discardProposal').click();const before=await snapshot(page);
  await finish(page);await kept(page,before);assert.equal(await page.locator('#impactPanel').isVisible(),false);assert.match(await page.locator('#proposalFeedback').textContent(),/discarded/);
 });
 await scenario('A later inspection result survives',async page=>{
  await page.locator('#tab-studio').click();await page.locator('#inspectInput').fill('mi un lum na');await choose(page);await page.locator('#inspectForm button').click();
  const before=await snapshot(page),inspection=await page.locator('#inspectResult').textContent();assert.match(inspection,/Version 1/);
  await finish(page);await kept(page,before);assert.equal(await page.locator('#inspectResult').textContent(),inspection);
 });
 await scenario('Normal Open can replace earlier work after passive navigation',async page=>{
  await page.locator('#sentenceInput').fill('This draft predates Open');await choose(page);await page.locator('#tab-studio').click();await finish(page);
  const after=await snapshot(page);assert.equal(after.project.title,'Saved project A');assert.equal(after.draft,'');assert.match(after.notice,/Project opened/);
 });
 await scenario('An empty chooser selection does not cancel an earlier read',async page=>{
  await choose(page);await page.locator('#projectFile').setInputFiles([]);await finish(page);
  assert.equal((await snapshot(page)).project.title,'Saved project A');
 });
 await scenario('Newest selected file wins when older success arrives last',async page=>{
  await choose(page);await choose(page,'slow-B.json',savedB);await finish(page,'slow-B.json',savedB);
  const before=await snapshot(page);assert.equal(before.project.title,'Saved project B');await finish(page);assert.deepEqual(await snapshot(page),before);
 });
 await scenario('Newest invalid file does not resurrect an older valid file',async page=>{
  const initial=await snapshot(page);await choose(page);await choose(page,'slow-B.json','{');await finish(page,'slow-B.json','{');
  const before=await snapshot(page);assert.equal(before.stored,initial.stored);assert.match(before.notice,/Could not open/);
  await finish(page);assert.deepEqual(await snapshot(page),before);
 });
 await scenario('An older read failure cannot overwrite a newer Open result',async page=>{
  await choose(page);await choose(page,'slow-B.json',savedB);await finish(page,'slow-B.json',savedB);
  const before=await snapshot(page);await finish(page,'slow-A.json',null,'Unreadable older file');assert.deepEqual(await snapshot(page),before);
 });
 await scenario('A late read failure preserves newer work and avoids obsolete errors',async page=>{
  await choose(page);await page.locator('#sentenceInput').fill('mi du pon di');const before=await snapshot(page);
  await finish(page,'slow-A.json',null,'Unreadable file');const after=await kept(page,before);assert.equal(after.draft,'mi du pon di');assert.doesNotMatch(after.notice,/Unreadable/);
 });
 await scenario('Older completion cannot reset a newer pending file selection',async page=>{
  await choose(page);await choose(page,'slow-B.json',savedB);await finish(page);
  assert.equal(await page.locator('#projectFile').evaluate(el=>el.files[0]?.name),'slow-B.json');
  await finish(page,'slow-B.json',savedB);assert.equal((await snapshot(page)).project.title,'Saved project B');
 });
 await scenario('The same file can be reopened after a skipped attempt',async page=>{
  await choose(page);await page.locator('#sentenceInput').fill('New work');const before=await snapshot(page);await finish(page);await kept(page,before);
  await choose(page);await finish(page);assert.equal((await snapshot(page)).project.title,'Saved project A');assert.equal((await snapshot(page)).draft,'');
 });
 await scenario('Malformed file preserves current project and allows same-file retry',async page=>{
  const before=await snapshot(page);await choose(page,'slow-A.json','{');await finish(page,'slow-A.json','{');
  assert.equal((await snapshot(page)).stored,before.stored);assert.match((await snapshot(page)).notice,/Could not open/);assert.equal(await page.locator('#projectFile').inputValue(),'');
  await choose(page);await finish(page);assert.equal((await snapshot(page)).project.title,'Saved project A');
 });
 await scenario('A failed proposal with no later state change does not block Open',async page=>{
  await page.locator('#tab-studio').click();await choose(page);await page.locator('#proposalForm button[type=submit]').click();assert.match(await page.locator('#proposalFeedback').textContent(),/rationale/i);
  await finish(page);assert.equal((await snapshot(page)).project.title,'Saved project A');
 });
 await scenario('A newer oversized file retires the older read before reading its bytes',async page=>{
  const initial=await snapshot(page);await choose(page);await choose(page,'oversized.json','x'.repeat(1000001));
  const before=await snapshot(page);assert.equal(before.stored,initial.stored);assert.match(before.notice,/smaller than 1 MB/);assert.equal(await page.locator('#projectFile').inputValue(),'');
  await finish(page);assert.deepEqual(await snapshot(page),before);
 });
 await scenario('The same file can be retried after a read failure',async page=>{
  const before=await snapshot(page);await choose(page);await finish(page,'slow-A.json',null,'Read failed');
  assert.equal((await snapshot(page)).stored,before.stored);assert.match((await snapshot(page)).notice,/Read failed/);assert.equal(await page.locator('#projectFile').inputValue(),'');
  await choose(page);await finish(page);assert.equal((await snapshot(page)).project.title,'Saved project A');
 });
 await scenario('Preserved-work notification is visible on a narrow screen',async page=>{
  await choose(page);await page.locator('#sentenceInput').fill('mi un lum na');const before=await snapshot(page);await finish(page);await kept(page,before);
  const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));assert.ok(dimensions.scroll<=dimensions.width+1,'No horizontal page overflow');
  await page.screenshot({path:resolve(evidence,'narrow-draft-kept.png'),fullPage:true});
 },{width:390,height:844});
 const receipt={app_root:appRoot,browser:await browser.version(),url,passed:results.length,results};
 await writeFile(resolve(evidence,'open-project-results.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
}catch(error){
 await writeFile(resolve(evidence,'open-project-failure.json'),JSON.stringify({results,error:String(error),stack:error.stack},null,2)+'\n');throw error;
}finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));}
