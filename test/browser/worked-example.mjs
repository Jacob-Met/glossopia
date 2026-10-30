import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.SOURCE_DIR,fixture=process.env.PROJECT_FILE,out=process.env.EVIDENCE_DIR;
if(!root||!fixture||!out)throw Error('SOURCE_DIR PROJECT_FILE EVIDENCE_DIR required');
const load=p=>import(pathToFileURL(resolve(root,'src/'+p+'.mjs')));
const {parseProject}=await load('project'),{parse}=await load('language-core'),{replayMission}=await load('mission-core');
const input=await readFile(fixture,'utf8'),p=parseProject(input),old=p.sessions.find(s=>s.versionId===p.history[0].versionId),fresh=p.sessions.find(s=>s.id===p.activeSessionId);
assert.equal(p.schemaVersion,1);assert.equal(p.history.length,2);assert.equal(p.history[0].grammar.order,'SOV');assert.equal(p.history[1].grammar.order,'SVO');assert(p.sessions.every(s=>!Object.hasOwn(s,'scene')));assert.deepEqual(fresh.inputs,[]);assert.equal(fresh.versionId,p.history[1].versionId);
assert.equal(replayMission(p.history[0],old).complete,true);assert.deepEqual(replayMission(p.history[0],old).inventory,{pear:1,lantern:1});
assert.equal(parse(p.history[1],'mi un lum na').status,'invalid_syntax');assert.equal(parse(p.history[1],'mi na un lum').status,'ok');
const history=JSON.stringify(p.history),prior=JSON.stringify(old),results=[{name:'Independent fixture semantics',status:'passed'}];
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=process.env.STANDALONE_FILE||process.env.APP_URL?null:(await import(pathToFileURL(resolve(root,'server.mjs')))).createServer();
if(server)await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=process.env.STANDALONE_FILE?pathToFileURL(resolve(process.env.STANDALONE_FILE)).href:process.env.APP_URL||'http://127.0.0.1:'+server.address().port;
let browser,error=null;await mkdir(out,{recursive:true});
try{
 browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(String(e)));await page.goto(url);
 async function open(text){await page.locator('#projectFile').setInputFiles({name:'worked-example.json',mimeType:'application/json',buffer:Buffer.from(text)});await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Project opened'));}
 async function exported(){const wait=page.waitForEvent('download');await page.locator('#saveProject').click();const d=await wait;assert.equal(await d.failure(),null);return readFile(await d.path(),'utf8');}
 await open(input);assert.match(await page.locator('#sentenceLabel').textContent(),/version 2/);
 await page.locator('#tab-history').click();await page.locator('#practiceRecords button').filter({hasText:old.id+' ·'}).click();assert.equal(await page.locator('#missionProgress').textContent(),'Complete');assert.match(await page.locator('#sentenceLabel').textContent(),/version 1/);await page.screenshot({path:resolve(out,'historical-complete.png')});
 await page.locator('#tab-studio').click();await page.locator('#inspectInput').fill('mi un lum na');await page.locator('#inspectForm button').click();assert.match(await page.locator('#inspectResult').textContent(),/Version 2/);assert.doesNotMatch(await page.locator('#inspectResult').textContent(),/Reading 1/);assert.match(await page.locator('#inspectResult').textContent(),/Not a sentence under these rules \(invalid_syntax\)/);
 await page.locator('#inspectInput').fill('mi na un lum');await page.locator('#inspectForm button').click();const contrast=await page.locator('#inspectResult').textContent();assert.match(contrast,/Reading 1/);assert.match(contrast,/quantity: 1/);assert.match(contrast,/object: lantern/);await page.locator('#inspectResult').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,'studio-version-contrast.png')});
 await page.locator('#tab-history').click();await page.getByRole('button',{name:'Inspect version 1',exact:true}).click();await page.locator('#inspectInput').fill('mi un lum na');await page.locator('#inspectForm button').click();assert.match(await page.locator('#inspectResult').textContent(),/Version 1/);assert.match(await page.locator('#inspectResult').textContent(),/Reading 1/);
 await page.locator('#tab-history').click();await page.locator('#practiceRecords button').filter({hasText:fresh.id+' ·'}).click();
 for(const text of ['mi na un lum','mi di du pon','mi si un lum']){await page.locator('#sentenceInput').fill(text);await page.locator('#sentenceForm button[type=submit]').click();}
 assert.equal(await page.locator('#missionProgress').textContent(),'Complete');
 await page.screenshot({path:resolve(out,'v2-complete.png')});
 const saved=await exported(),completed=parseProject(saved);assert.equal(JSON.stringify(completed.history),history);assert.equal(JSON.stringify(completed.sessions.find(s=>s.id===old.id)),prior);
 const now=completed.sessions.find(s=>s.id===fresh.id);assert.deepEqual(now.inputs,['mi na un lum','mi di du pon','mi si un lum']);assert.deepEqual(replayMission(completed.history[1],now).inventory,{pear:1,lantern:1});
 await page.reload();await open(saved);assert.equal(await exported(),saved);assert.equal(await page.locator('#missionProgress').textContent(),'Complete');assert.deepEqual(errors,[]);
 results.push({name:'Actual Open historical replay studio contrast new practice and portable roundtrip',status:'passed'});
 await context.close();
}catch(e){error=String(e);throw e;}finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));await writeFile(resolve(out,'independent-worked-example.json'),JSON.stringify({source:root,fixture,url,results,error},null,2));}
console.log(JSON.stringify({results}));
