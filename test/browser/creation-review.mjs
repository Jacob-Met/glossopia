import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
// APP_ROOT_OR_URL OUT_DIR FROZEN_NEMI_PROJECT; no app imports or state injection.
const [target,outArg,fixturePath]=process.argv.slice(2),out=path.resolve(outArg);
await mkdir(out,{recursive:true});
const fixture=JSON.parse(await readFile(fixturePath,'utf8')),language=fixture.history[0];
assert.equal(language.name,'Nemi');
const {chromium}=await import(pathToFileURL(process.env.GLOSSOPIA_PLAYWRIGHT||process.env.PLAYWRIGHT_MODULE));
const receipt={status:'running',measurements:[],errors:[],blocked:[],prompt:'2026-10-29.32'};
let child,browser;
try{
 let url=target;
 if(!/^(https?:|file:)/.test(target)){
  child=spawn(process.execPath,['server.mjs'],{cwd:path.resolve(target),env:{...process.env,PORT:'0'},detached:true,stdio:['ignore','pipe','pipe']});
  url=await new Promise((resolve,reject)=>{let text='';const t=setTimeout(()=>reject(Error('CLI readiness timeout')),15000);child.stderr.on('data',()=>{});child.stdout.on('data',b=>{text+=b;const m=text.match(/GLOSSOPIA (http:\/\/127\.0\.0\.1:\d+)/);if(m){clearTimeout(t);resolve(m[1]);}});child.once('exit',code=>{clearTimeout(t);reject(Error(`Server exit ${code}`));});});
 }
 browser=await chromium.launch({executablePath:process.env.GLOSSOPIA_CHROME||process.env.CHROME_EXECUTABLE,chromiumSandbox:true,headless:true});
 for(const viewport of [{width:1440,height:900},{width:390,height:844}])for(const mode of ['mouse','keyboard']){
  const context=await browser.newContext({viewport,serviceWorkers:'block'});
  await context.route('**/*',async route=>{const r=route.request(),u=new URL(r.url()),base=new URL(url);if(['data:','blob:'].includes(u.protocol)||u.origin===base.origin&&r.method()==='GET')await route.continue();else{receipt.blocked.push({method:r.method(),path:u.origin===base.origin?u.pathname:'external'});await route.abort();}});
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>receipt.errors.push(e.message));
  await page.goto(url);await page.locator('#wordBank button').first().waitFor();
  await page.locator('#sentenceInput').fill('preserve typed sentence');
  await page.locator('#tab-studio').click();await page.locator('#proposalRationale').fill('preserve proposal draft');
  const snapshot=()=>page.evaluate(()=>({storage:Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])),sentence:document.getElementById('sentenceInput').value,rationale:document.getElementById('proposalRationale').value}));
  const before=await snapshot();await page.locator('#newLanguage').click();
  await page.locator('#creationName').fill(language.name);await page.locator('#creationAuthor').fill(language.author);await page.locator('#creationOrder').selectOption(language.grammar.order);
  for(const entry of language.lexicon)await page.locator('#creationForm-'+entry.id).fill(entry.form);
  const measure=()=>page.evaluate(()=>{
   const d=document.getElementById('languageCreationDialog'),h=document.getElementById('creationTitle'),p=document.getElementById('creationPreview');
   const dr=d.getBoundingClientRect(),hr=h.getBoundingClientRect();
   const clip={top:Math.max(0,dr.top+d.clientTop),bottom:Math.min(innerHeight,dr.top+d.clientTop+d.clientHeight),left:Math.max(0,dr.left),right:Math.min(innerWidth,dr.right)};
   return {focus:document.activeElement.id,scrollTop:d.scrollTop,hidden:p.hidden,title:{top:hr.top,bottom:hr.bottom,left:hr.left,right:hr.right},clip,titleFullyVisible:!p.hidden&&hr.top>=clip.top&&hr.bottom<=clip.bottom&&hr.left>=clip.left&&hr.right<=clip.right,focusInReview:p.contains(document.activeElement)};
  });
  const submit=async()=>{if(mode==='mouse')await page.locator('#reviewCreation').click();else{await page.locator('#reviewCreation').focus();await page.keyboard.press('Enter');}};
  await submit();await page.locator('#creationPreview').waitFor({state:'visible'});
  const first=await measure();await page.screenshot({path:path.join(out,`${viewport.width}-${mode}.png`),fullPage:true});
  assert.deepEqual(await snapshot(),before,'Review preserves project/archive/current drafts');
  await page.keyboard.press('Tab');const nextFocus=await page.evaluate(()=>({id:document.activeElement.id,inDialog:document.getElementById('languageCreationDialog').contains(document.activeElement)}));assert.equal(nextFocus.inDialog,true);
  await page.locator('#creationName').fill('Nemi revised');
  assert.equal(await page.locator('#creationPreview').isVisible(),false);assert.equal(await page.locator('#createLanguage').isDisabled(),true);assert.equal(await page.locator('#exportCreatedLanguage').isDisabled(),true);
  await submit();await page.locator('#creationPreview').waitFor({state:'visible'});const revised=await measure();
  await page.locator('#creationName').fill('');await submit();assert.equal(await page.locator('#creationPreview').isVisible(),false);assert.equal(await page.locator('#createLanguage').isDisabled(),true);
  await page.locator('#cancelCreation').click();assert.equal(await page.locator('#languageCreationDialog').isVisible(),false);assert.deepEqual(await snapshot(),before,'Cancel preserves original drafts/state');
  receipt.measurements.push({viewport,mode,first,revised,nextFocus,regressionsPassed:true,discoverable:first.titleFullyVisible&&first.focusInReview&&revised.titleFullyVisible&&revised.focusInReview});
  await context.close();
 }
 assert.deepEqual(receipt.errors,[]);assert.deepEqual(receipt.blocked,[]);
 receipt.status=receipt.measurements.every(x=>x.discoverable)?'acceptance-passed':'baseline-defect-observed';
}catch(e){receipt.status='receiver-failed';receipt.error=String(e.stack||e);process.exitCode=1;}
finally{if(browser)await browser.close();if(child)try{process.kill(-child.pid,'SIGTERM');}catch{}await writeFile(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));}
