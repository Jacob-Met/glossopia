import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.GLOSSOPIA_PLAYWRIGHT??'playwright');
const out=fileURLToPath(new URL('.',import.meta.url));
const app=resolve(process.env.GLOSSOPIA_APP_ROOT??fileURLToPath(new URL('../../',import.meta.url)));
const {createServer}=await import(pathToFileURL(resolve(app,'server.mjs')));
const {parseProject}=await import(pathToFileURL(resolve(app,'src/project.mjs')));
const {replayMission}=await import(pathToFileURL(resolve(app,'src/mission-core.mjs')));
const ref=JSON.parse(await readFile(resolve(out,'REFERENCE.json'),'utf8')),evidence=resolve(process.env.GLOSSOPIA_EVIDENCE??resolve(out,'output'));await mkdir(evidence,{recursive:true});
const server=process.env.GLOSSOPIA_URL?null:createServer();if(server)await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=process.env.GLOSSOPIA_URL??('http://127.0.0.1:'+server.address().port);
const browser=await chromium.launch({headless:true,...(process.env.GLOSSOPIA_CHROME?{executablePath:process.env.GLOSSOPIA_CHROME}:{}),...(process.env.GLOSSOPIA_NO_SANDBOX==='1'?{args:['--no-sandbox']}:{})});
const receipts=[];
try{
 for(const [index,d]of ref.fixtures.entries()){
  const context=await browser.newContext({viewport:index===0?{width:1440,height:1100}:{width:390,height:844}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));await page.goto(url);
  await page.locator('#projectFile').setInputFiles(resolve(out,d.path));
  await page.waitForFunction(name=>document.querySelector('#languageName').textContent===name,d.name);
  const fixture=parseProject(await readFile(resolve(out,d.path),'utf8')),language=fixture.history[0],originalLanguage=JSON.stringify(language);
  await page.locator('#sentenceInput').fill(d.wrong[0]);await page.locator('#saySentence').click();
  let p=parseProject(await page.evaluate(()=>localStorage.getItem('glossopia-project-v1')));
  let s=p.sessions.find(x=>x.id===p.activeSessionId),state=replayMission(language,s);
  assert.equal(state.stage,0);assert.deepEqual(state.inventory,{pear:3,lantern:0});assert.equal(s.inputs.length,1);
  await page.locator('#restartMission').click();
  const meanings=[{actor:'actor-i',quantity:'quantity-one',object:'object-lantern',verb:'verb-request'},{actor:'actor-i',quantity:'quantity-two',object:'object-pear',verb:'verb-give'},{actor:'actor-i',quantity:'quantity-one',object:'object-lantern',verb:'verb-have'}];
  const slots=d.order==='SOV'?['actor','quantity','object','verb']:['actor','verb','quantity','object'];
  for(const [step,meaning]of meanings.entries()){
   for(const role of slots){const entry=language.lexicon.find(x=>x.id===meaning[role]);await page.locator('#wordBank').getByTitle(entry.role+': '+entry.gloss,{exact:true}).click();}
   assert.equal(await page.locator('#sentenceInput').inputValue(),d.player[step]);await page.locator('#saySentence').click();
   if(step<2)assert.equal(await page.locator('#conversation').getByText(d.trader[step],{exact:true}).isVisible(),true);
  }
  assert.equal(await page.locator('#missionProgress').textContent(),'Complete');
  p=parseProject(await page.evaluate(()=>localStorage.getItem('glossopia-project-v1')));s=p.sessions.find(x=>x.id===p.activeSessionId);state=replayMission(language,s);
  assert.equal(state.complete,true);assert.deepEqual(state.inventory,{pear:1,lantern:1});assert.equal(s.inputs.length,3);assert.equal(p.sessions[0].inputs.length,1);assert.equal(JSON.stringify(p.history[0]),originalLanguage);
  const downloadPromise=page.waitForEvent('download');await page.locator('#saveProject').click();const dl=await downloadPromise;const downloadPath=resolve(evidence,d.name.toLowerCase()+'-completed.json');await dl.saveAs(downloadPath);
  assert.deepEqual(parseProject(await readFile(downloadPath,'utf8')),p);
  await page.reload();assert.equal(await page.locator('#languageName').textContent(),d.name);assert.equal(await page.locator('#missionProgress').textContent(),'Complete');
  await page.screenshot({path:resolve(evidence,d.name.toLowerCase()+'-complete.png'),fullPage:true});
  const fresh=await browser.newContext(),receiver=await fresh.newPage();await receiver.goto(url);await receiver.locator('#projectFile').setInputFiles(downloadPath);await receiver.waitForFunction(name=>document.querySelector('#languageName').textContent===name,d.name);
  const reopened=parseProject(await receiver.evaluate(()=>localStorage.getItem('glossopia-project-v1')));assert.deepEqual(reopened,p);assert.equal(await receiver.locator('#missionProgress').textContent(),'Complete');assert.deepEqual(errors,[]);
  receipts.push({name:d.name,order:d.order,loaded_name:d.name,wordbank_inputs:s.inputs,trader_replies:d.trader,rejected_practice_retained:p.sessions[0].inputs,final_inventory:state.inventory,saved_and_fresh_reopened_equal:true,language_forms_preserved:true,browser_errors:errors});
  await fresh.close();await context.close();
 }
 const report={reference_source_commit:ref.source_commit,app_root:app,package_version:JSON.parse(await readFile(resolve(app,'package.json'),'utf8')).version,browser:await browser.version(),url,fixtures:receipts,limits:'Exercises existing Open/wordbank/trade/Save/reload/reopen. The upcoming Create language UI and archive switching are not yet received.'};
 await writeFile(resolve(evidence,'browser-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
