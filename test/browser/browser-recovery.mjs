import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const appRoot=resolve(process.env.GLOSSOPIA_APP_ROOT??fileURLToPath(new URL('../../',import.meta.url)));
const evidence=resolve(process.env.GLOSSOPIA_EVIDENCE??'test-output/browser-recovery');
const {chromium}=await import(process.env.GLOSSOPIA_PLAYWRIGHT??'playwright');
const {createServer}=await import(pathToFileURL(resolve(appRoot,'server.mjs')));
const {parseProject}=await import(pathToFileURL(resolve(appRoot,'src/project.mjs')));
await mkdir(evidence,{recursive:true});
const server=process.env.GLOSSOPIA_URL?null:createServer();
if(server)await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=process.env.GLOSSOPIA_URL??('http://127.0.0.1:'+server.address().port),KEY='glossopia-project-v1';
const malformed='  {"format":"glossopia-project","title":"My café language","history":[\n';
const future=JSON.stringify({format:'glossopia-project',schemaVersion:2,title:'Future schema language',note:'Keep the original, do not silently reset it.'});
const oversized=JSON.stringify({format:'glossopia-project',schemaVersion:1,title:'Large authored data',notes:'x'.repeat(1000100)});
const unicode='{"broken":\uD800\uDC00\uD800x\uDC00"\u0000';
const results=[];let browser;const report={app_root:appRoot,url:base,results,reviewer_fixture_basis:'product_review brokered behavioral cases; root integrated and executed'};
const stored=page=>page.evaluate(key=>localStorage.getItem(key),KEY);
async function download(page,click){
 const pending=page.waitForEvent('download');await click();const d=await pending;assert.equal(await d.failure(),null);
 const stream=await d.createReadStream();assert.ok(stream);const chunks=[];for await(const part of stream)chunks.push(Buffer.from(part));return Buffer.concat(chunks);
}
async function seed(page,raw){
 await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:KEY,raw});await page.reload();await page.locator('#storageRecovery').waitFor({state:'visible'});
}
async function copy(page,index=0){
 const controls=page.locator('#recoveryCopies button');assert.ok(await controls.count()>index);
 const data=await download(page,()=>controls.nth(index).click()),value=JSON.parse(data.toString('utf8'));
 assert.equal(value.format,'glossopia-browser-recovery');assert.equal(value.schemaVersion,1);assert.equal(value.storageKey,KEY);
 return {data,value};
}
async function exported(page){const data=await download(page,()=>page.locator('#saveProject').click());return {data,project:parseProject(data.toString('utf8'))};}

const ARCHIVE_KEY='glossopia-project-archive-v1';
const creationForms={'actor-i':'zi','actor-you':'va','verb-request':'ke','verb-give':'do','verb-have':'se','object-lantern':'len','object-pear':'pir','quantity-one':'an','quantity-two':'bi','quantity-three':'ci'};
const archiveText=page=>page.evaluate(key=>localStorage.getItem(key),ARCHIVE_KEY);
async function reviewCreation(page,name='Kiri'){
 if(!await page.locator('#languageCreationDialog').isVisible())await page.locator('#newLanguage').click();
 await page.locator('#creationName').fill(name);await page.locator('#creationAuthor').fill('Independent author');await page.locator('#creationOrder').selectOption('SOV');
 for(const [id,value] of Object.entries(creationForms))await page.locator('#creationForm-'+id).fill(value);
 await page.locator('#reviewCreation').click();await page.locator('#creationPreview').waitFor({state:'visible'});
 assert.equal(await page.locator('#creationTitle').textContent(),name+' · version 1');assert.ok(await page.locator('#createLanguage').isEnabled());assert.ok(await page.locator('#exportCreatedLanguage').isEnabled());
}
async function closeCreation(page){if(await page.locator('#languageCreationDialog').isVisible())await page.locator('#cancelCreation').click();}
async function observeWrites(page){
 await page.evaluate(keys=>{window.recoveryObservedWrites=[];const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(this===localStorage&&keys.includes(key))window.recoveryObservedWrites.push(key);return original.call(this,key,value);};},[KEY,ARCHIVE_KEY]);
}

async function protectedState(page,original){
 assert.equal(await stored(page),original);assert.ok(await page.locator('#storageRecovery').isVisible());assert.doesNotMatch(await page.locator('#saveState').innerText(),/^Saved in this browser/);
}
async function scenario(name,run,{width=1280,height=900,beforeNavigate}={}){
 const context=await browser.newContext({acceptDownloads:true,viewport:{width,height}}),page=await context.newPage(),errors=[],external=[];
 page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(String(e)));
 await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==base){external.push(route.request().url());return route.abort();}return route.continue();});
 try{
  if(beforeNavigate)await beforeNavigate(page);
  await page.goto(base);await page.locator('#wordBank button').first().waitFor();
  const detail=await run(page);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  results.push({name,passed:true,...detail,page_errors:errors,external_requests:external});console.log('PASS '+name);
 }finally{await context.close();}
}
try{
 browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.GLOSSOPIA_CHROME?{executablePath:process.env.GLOSSOPIA_CHROME}:{})});
 const cdp=await browser.newBrowserCDPSession(),info=await cdp.send('SystemInfo.getProcessInfo'),main=info.processInfo.find(p=>p.type==='browser');
 const argv=(await readFile('/proc/'+main.id+'/cmdline')).toString().split('\0').filter(Boolean);assert.ok(!argv.includes('--no-sandbox')&&!argv.includes('--disable-setuid-sandbox'));
 const sandbox=await browser.newPage();await sandbox.goto('chrome://sandbox');report.sandbox=await sandbox.locator('body').innerText();assert.match(report.sandbox,/adequately sandboxed/);await sandbox.close();
 report.browser=await browser.version();
 await scenario('Malformed stored project survives a complete real market and both exports',async page=>{
  await seed(page,malformed);
  for(const sentence of ['mi un lum na','mi du pon di','mi un lum si']){
   await page.locator('#sentenceInput').fill(sentence);await page.locator('#saySentence').click();await protectedState(page,malformed);
  }
  assert.equal(await page.locator('#missionProgress').innerText(),'Complete');
  const current=await exported(page);assert.deepEqual(current.project.sessions[0].inputs,['mi un lum na','mi du pon di','mi un lum si']);
  assert.equal((await copy(page)).value.storedText,malformed);await protectedState(page,malformed);
  await writeFile(resolve(evidence,'current-project-after-protected-market.json'),current.data);await page.screenshot({path:resolve(evidence,'protected-market-desktop.png'),fullPage:true});
  return {accepted_inputs:3,original_preserved:true};
 });
 await scenario('Future schema survives the original inspection trigger',async page=>{
  await seed(page,future);await page.locator('#inspectLanguage').click();await protectedState(page,future);assert.equal((await copy(page)).value.storedText,future);
 });
 await scenario('Oversized stored data survives the original hint trigger and a full download',async page=>{
  await seed(page,oversized);await page.locator('#showHint').click();await protectedState(page,oversized);const received=await copy(page);assert.equal(received.value.storedText,oversized);assert.equal(received.value.storedText.length,1000189);
  assert.equal((await exported(page)).project.sessions[0].hintsUsed,1);
  return {stored_characters:oversized.length,download_bytes:received.data.length};
 });
 await scenario('Empty and unusual UTF-16 strings remain exact in recovery downloads',async page=>{
  for(const raw of ['',unicode]){
   await seed(page,raw);await page.locator('#showHint').click();const received=await copy(page);assert.equal(received.value.storedText,raw);
   assert.deepEqual(Array.from({length:raw.length},(_,i)=>received.value.storedText.charCodeAt(i)),Array.from({length:raw.length},(_,i)=>raw.charCodeAt(i)));await protectedState(page,raw);
  }
 });
 await scenario('Download and cancellation preserve protection across reload',async page=>{
  await seed(page,malformed);assert.equal((await copy(page)).value.storedText,malformed);
  await page.locator('#replaceRecovery').click();assert.ok(await page.locator('#recoveryConfirm').isVisible());await page.locator('#cancelRecoveryReplace').click();
  await page.locator('#showHint').click();await protectedState(page,malformed);
  await page.reload();await page.locator('#storageRecovery').waitFor({state:'visible'});assert.equal((await copy(page)).value.storedText,malformed);
 });
 await scenario('A different tab invalidates the reviewed saved value and both copies remain available',async page=>{
  await seed(page,malformed);await page.locator('#replaceRecovery').click();
  const other=await page.context().newPage();await other.goto(base);const changed='{"changedElsewhere":true,"incomplete":';
  await other.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:KEY,raw:changed});await page.locator('#confirmRecoveryReplace').click();
  await protectedState(page,changed);assert.match(await page.locator('#recoveryMessage').innerText(),/changed after you reviewed/);
  assert.equal(await page.locator('#recoveryCopies button').count(),2);assert.equal((await copy(page,0)).value.storedText,malformed);assert.equal((await copy(page,1)).value.storedText,changed);
  await other.close();
 });
 await scenario('Later sentence work cancels the displayed replacement decision',async page=>{
  await seed(page,malformed);await page.locator('#replaceRecovery').click();await page.locator('#sentenceInput').fill('mi un lum na');
  assert.ok(await page.locator('#recoveryConfirm').isHidden());await protectedState(page,malformed);assert.equal(await page.locator('#sentenceInput').inputValue(),'mi un lum na');
 });
 await scenario('Write failure keeps recovery active and a fresh explicit retry succeeds',async page=>{
  await seed(page,malformed);await page.locator('#showHint').click();
  await page.evaluate(key=>{const actual=Storage.prototype.setItem;window.restoreSetItem=()=>Storage.prototype.setItem=actual;Storage.prototype.setItem=function(k,v){if(this===localStorage&&k===key)throw new DOMException('Fixture quota failure','QuotaExceededError');return actual.call(this,k,v);};},KEY);
  await page.locator('#replaceRecovery').click();await page.locator('#confirmRecoveryReplace').click();await protectedState(page,malformed);assert.match(await page.locator('#recoveryMessage').innerText(),/could not save/);assert.equal((await copy(page)).value.storedText,malformed);
  await page.evaluate(()=>window.restoreSetItem());await page.locator('#replaceRecovery').click();await page.locator('#confirmRecoveryReplace').click();
  const replacement=await stored(page),current=parseProject(replacement);assert.equal(current.sessions[0].hintsUsed,1);assert.notEqual(replacement,malformed);assert.ok(await page.locator('#storageRecovery').isHidden());
  await page.reload();await page.locator('#wordBank button').first().waitFor();assert.ok(await page.locator('#storageRecovery').isHidden());assert.equal(await stored(page),replacement);
 });
 await scenario('A storage read failure at confirmation does not replace the captured original',async page=>{
  await seed(page,malformed);await page.locator('#replaceRecovery').click();
  await page.evaluate(key=>{const actual=Storage.prototype.getItem;window.readOriginal=()=>actual.call(localStorage,key);window.restoreGetItem=()=>Storage.prototype.getItem=actual;Storage.prototype.getItem=function(k){if(this===localStorage&&k===key)throw new DOMException('Fixture read denial','SecurityError');return actual.call(this,k);};},KEY);
  await page.locator('#confirmRecoveryReplace').click();assert.equal(await page.evaluate(()=>window.readOriginal()),malformed);assert.ok(await page.locator('#storageRecovery').isVisible());assert.match(await page.locator('#recoveryMessage').innerText(),/could not be checked/);
  await page.evaluate(()=>window.restoreGetItem());assert.equal((await copy(page)).value.storedText,malformed);
 });
 await scenario('Startup storage getter failure cannot invent a recovery copy or overwrite data',async page=>{
  assert.ok(await page.locator('#storageRecovery').isVisible());assert.equal(await page.locator('#recoveryCopies button').count(),0);
  await page.locator('#showHint').click();assert.equal(await page.evaluate(()=>window.recoveryReadActual()),malformed);assert.equal(await page.evaluate(()=>window.recoveryWriteCount),0);
  await page.evaluate(()=>window.recoveryAllowRead());await page.locator('#reviewRecovery').click();assert.equal((await copy(page)).value.storedText,malformed);assert.equal(await page.evaluate(()=>window.recoveryWriteCount),0);await protectedState(page,malformed);
 },{beforeNavigate:page=>page.addInitScript(({key,raw})=>{
  const actual=window.localStorage,originalSet=Storage.prototype.setItem;actual.setItem(key,raw);window.recoveryWriteCount=0;let denied=true;
  Object.defineProperty(window,'localStorage',{configurable:true,get(){if(denied)throw new DOMException('Fixture storage getter denial','SecurityError');return actual;}});
  window.recoveryReadActual=()=>actual.getItem(key);window.recoveryAllowRead=()=>denied=false;
  Storage.prototype.setItem=function(k,v){if(this===actual&&k===key)window.recoveryWriteCount++;return originalSet.call(this,k,v);};
 },{key:KEY,raw:malformed})});
 await scenario('A valid Open stays usable in memory without destroying unread storage',async page=>{
  const valid=JSON.parse(await stored(page));valid.title='Opened project in protected tab';const file=JSON.stringify(valid);
  await seed(page,malformed);await page.locator('#projectFile').setInputFiles({name:'valid-project.json',mimeType:'application/json',buffer:Buffer.from(file)});
  await page.waitForFunction(()=>document.getElementById('projectFile').value==='');
  assert.equal((await exported(page)).project.title,valid.title);await page.locator('#showHint').click();await protectedState(page,malformed);
 });
 await scenario('Recovery envelopes are rejected by Open while current practice stays intact',async page=>{
  await seed(page,malformed);await page.locator('#showHint').click();const before=(await exported(page)).data,received=await copy(page);
  await page.locator('#projectFile').setInputFiles({name:'recovery-copy.json',mimeType:'application/json',buffer:received.data});
  await page.waitForFunction(()=>document.getElementById('projectFile').value==='');
  assert.match(await page.locator('#toast').innerText(),/Could not open this file/);assert.deepEqual((await exported(page)).data,before);await protectedState(page,malformed);
 });

 await scenario('Protected creation review and download preserve both browser stores',async page=>{
  const raw='{"unread-project":';await seed(page,raw);const archiveBefore=await archiveText(page);await observeWrites(page);
  await reviewCreation(page);const data=await download(page,()=>page.locator('#exportCreatedLanguage').click()),created=parseProject(data.toString('utf8'));
  assert.equal(created.history[0].name,'Kiri');await page.locator('#createLanguage').click();
  assert.equal(await stored(page),raw);assert.equal(await archiveText(page),archiveBefore);assert.deepEqual(await page.evaluate(()=>window.recoveryObservedWrites),[]);
  assert.ok(await page.locator('#languageCreationDialog').isVisible());await closeCreation(page);await protectedState(page,raw);assert.equal((await copy(page)).value.storedText,raw);
 });
 await scenario('Externally matching active data cannot bypass the explicit recovery decision',async page=>{
  const raw='{"unread-before-external-change":';await seed(page,raw);const current=await exported(page),matchingValue=current.data.toString('utf8'),archiveBefore=await archiveText(page);
  await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:KEY,value:matchingValue});await observeWrites(page);
  await reviewCreation(page);await page.locator('#createLanguage').click();assert.equal(await stored(page),matchingValue);assert.equal(await archiveText(page),archiveBefore);assert.deepEqual(await page.evaluate(()=>window.recoveryObservedWrites),[]);
  await closeCreation(page);assert.ok(await page.locator('#storageRecovery').isVisible());assert.equal((await copy(page)).value.storedText,raw);
 });
 await scenario('Resolved recovery supports a created language, full trade and archived restoration',async page=>{
  const raw='{"resolve-before-creation":';await seed(page,raw);const previous=(await exported(page)).project;
  await page.locator('#replaceRecovery').click();await page.locator('#confirmRecoveryReplace').click();await page.locator('#storageRecovery').waitFor({state:'hidden'});
  await reviewCreation(page);await page.locator('#createLanguage').click();await page.locator('#languageCreationDialog').waitFor({state:'hidden'});
  for(const text of ['zi an len ke','zi bi pir do','zi an len se']){await page.locator('#sentenceInput').fill(text);await page.locator('#saySentence').click();}
  assert.equal(await page.locator('#missionProgress').innerText(),'Complete');const created=(await exported(page)).project;assert.notDeepEqual(created,previous);
  await page.locator('#savedProjects').click();await page.locator('#projectArchiveDialog').waitFor({state:'visible'});const rows=page.locator('.archive-record[data-snapshot-id]');let found=-1;
  for(let i=0;i<await rows.count();i++)if(await rows.nth(i).locator('h3').textContent()===previous.title){assert.equal(found,-1);found=i;}
  assert.notEqual(found,-1);await rows.nth(found).locator('[data-action="open"]').click();await page.locator('#projectArchiveDialog').waitFor({state:'hidden'});
  assert.deepEqual((await exported(page)).project,previous);const entries=JSON.parse(await archiveText(page)).entries;assert.deepEqual(entries.find(e=>e.project.history[0].languageId===created.history[0].languageId).project,created);
  return {created_language:'Kiri',completed_trade:true,previous_project_restored:true,created_practice_retained:true};
 });
 await scenario('Creation draft invalidates a pending recovery confirmation',async page=>{
  const raw='{"pending-recovery-decision":';await seed(page,raw);const archiveBefore=await archiveText(page);
  await page.locator('#replaceRecovery').click();await page.locator('#recoveryConfirm').waitFor({state:'visible'});await page.locator('#newLanguage').click();await page.locator('#creationName').fill('Changed draft');
  await closeCreation(page);assert.ok(await page.locator('#recoveryConfirm').isHidden());
  // Deliberately invoke an obsolete hidden control to test the handler guard.
  await page.locator('#confirmRecoveryReplace').evaluate(button=>button.click());await protectedState(page,raw);assert.equal(await archiveText(page),archiveBefore);
 });
 await scenario('A newer Open invalidates a previously reviewed creation',async page=>{
  const opened=await exported(page);await reviewCreation(page);const archiveBefore=await archiveText(page);
  await page.locator('#projectFile').setInputFiles({name:'independent-open.json',mimeType:'application/json',buffer:opened.data});
  await page.waitForFunction(()=>document.getElementById('projectFile').value==='');await page.locator('#createLanguage').evaluate(button=>button.click());await closeCreation(page);
  assert.deepEqual((await exported(page)).project,opened.project);assert.equal(await archiveText(page),archiveBefore);
 });
 await scenario('Protected archived snapshots stay downloadable without replacing unread active data',async page=>{
  const healthy=await exported(page),raw='{"unread-active-with-valid-archive":',archiveValue=JSON.stringify({format:'glossopia-project-archive',schemaVersion:1,entries:[{snapshotId:'snapshot-fixture',savedAt:'2026-10-29T00:00:00Z',project:healthy.project}]});
  await page.evaluate(({activeKey,archiveKey,raw,archiveValue})=>{localStorage.setItem(archiveKey,archiveValue);localStorage.setItem(activeKey,raw);},{activeKey:KEY,archiveKey:ARCHIVE_KEY,raw,archiveValue});
  await page.reload();await page.locator('#storageRecovery').waitFor({state:'visible'});const active=(await exported(page)).project;await observeWrites(page);
  await page.locator('#savedProjects').click();await page.locator('#projectArchiveDialog').waitFor({state:'visible'});const row=page.locator('.archive-record[data-snapshot-id="snapshot-fixture"]');assert.equal(await row.count(),1);
  const data=await download(page,()=>row.locator('[data-action="export"]').click());assert.deepEqual(parseProject(data.toString('utf8')),healthy.project);
  await row.locator('[data-action="open"]').click();assert.equal(await stored(page),raw);assert.equal(await archiveText(page),archiveValue);assert.deepEqual(await page.evaluate(()=>window.recoveryObservedWrites),[]);
  await page.locator('#closeArchive').click();assert.deepEqual((await exported(page)).project,active);await protectedState(page,raw);assert.equal((await copy(page)).value.storedText,raw);
 });
 await scenario('Recovery during creation preserves the draft identity and requires a fresh review',async page=>{
  const raw='{"recovery-during-creation":';await seed(page,raw);await reviewCreation(page);const preview=page.locator('#creationPreview'),languageId=await preview.getAttribute('data-language-id'),archiveBefore=await archiveText(page);assert.ok(languageId);
  // Programmatic background controls cover the unusual stale-modal path.
  await page.locator('#replaceRecovery').evaluate(button=>button.click());await page.locator('#confirmRecoveryReplace').evaluate(button=>button.click());assert.ok(await page.locator('#storageRecovery').isHidden());
  assert.ok(await page.locator('#languageCreationDialog').isVisible());assert.equal(await page.locator('#creationName').inputValue(),'Kiri');assert.equal(await page.locator('#creationAuthor').inputValue(),'Independent author');assert.equal(await page.locator('#creationOrder').inputValue(),'SOV');
  for(const [id,value] of Object.entries(creationForms))assert.equal(await page.locator('#creationForm-'+id).inputValue(),value);
  const resolved=await stored(page);await page.locator('#createLanguage').evaluate(button=>button.click());assert.equal(await stored(page),resolved);assert.equal(await archiveText(page),archiveBefore);
  await page.locator('#reviewCreation').click();await preview.waitFor({state:'visible'});assert.equal(await preview.getAttribute('data-language-id'),languageId);
  assert.ok(await page.locator('#createLanguage').isEnabled());await page.locator('#createLanguage').click();await page.locator('#languageCreationDialog').waitFor({state:'hidden'});
  assert.notEqual(await stored(page),resolved);assert.notEqual(await archiveText(page),archiveBefore);assert.deepEqual(parseProject(await stored(page)),(await exported(page)).project);
 });

 await scenario('Healthy valid startup and autosave remain unchanged',async page=>{
  const valid=JSON.parse(await stored(page));valid.title='Healthy existing project';await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:KEY,raw:JSON.stringify(valid)});
  await page.reload();await page.locator('#wordBank button').first().waitFor();assert.ok(await page.locator('#storageRecovery').isHidden());
  await page.locator('#sentenceInput').fill('mi un lum na');await page.locator('#saySentence').click();const updated=await stored(page);assert.equal(parseProject(updated).title,valid.title);assert.deepEqual(parseProject(updated).sessions[0].inputs,['mi un lum na']);
  await page.reload();await page.locator('#wordBank button').first().waitFor();assert.equal(await stored(page),updated);assert.ok(await page.locator('#storageRecovery').isHidden());
 });
 await scenario('Recovery and replacement controls fit a 320px view and remain keyboard reachable',async page=>{
  await seed(page,malformed);await page.locator('#replaceRecovery').click();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'cancelRecoveryReplace');
  const sizes=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(sizes.scroll<=sizes.width+1);
  await page.screenshot({path:resolve(evidence,'recovery-confirm-320px.png'),fullPage:true});await page.locator('#cancelRecoveryReplace').press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'replaceRecovery');await protectedState(page,malformed);
 },{width:320,height:800});
 report.passed=true;report.passed_scenarios=results.length;
}catch(error){report.passed=false;report.error={message:String(error),stack:error.stack};throw error}
finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));report.finished_at=new Date().toISOString();await writeFile(resolve(evidence,'browser-recovery-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
