// Independent consumer oracle by retained /root/consumer_recovery.
// Lifecycle amendment to frozen receiver 7ca45e70a2574ae5267d486890c647fd67a9ab0b36f36b41d27f61c7c06efd10.
// Includes same-language replacement and explicit reset defaults.
// Root-authorized correction: ambiguity wording is read from code separately from its mandatory visible warning.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const root = resolve(process.env.GLOSSOPIA_APP_ROOT ?? fileURLToPath(new URL('../../', import.meta.url)));
const evidence = resolve(process.env.GLOSSOPIA_EVIDENCE ?? 'test-output/workbench');
const {chromium} = await import(process.env.GLOSSOPIA_PLAYWRIGHT ?? 'playwright');
const {createServer} = await import(pathToFileURL(resolve(root, 'server.mjs')));
const {starterLanguage} = await import(pathToFileURL(resolve(root, 'src/starter-language.mjs')));
const {createProject} = await import(pathToFileURL(resolve(root, 'src/project.mjs')));
const server = process.env.GLOSSOPIA_URL ? null : createServer();
if (server) await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = process.env.GLOSSOPIA_URL ?? 'http://127.0.0.1:' + server.address().port;
await mkdir(evidence, {recursive: true});
const results = []; let browser;
const state = p => p.evaluate(() => JSON.parse(localStorage.getItem('glossopia-project-v1')));
const status = p => p.locator('#workbenchStatus').getAttribute('data-status');
const review = p => p.locator('#proposalForm button[type=submit]').click();
async function choose(p, object = 'basket') {
  for (const [role, value] of Object.entries({Actor:'you', Verb:'give', Quantity:2, Object:object}))
    await p.locator('#workbench' + role).selectOption(JSON.stringify(value));
}
async function verified(p, sentence, version) {
  assert.equal(await status(p), 'ok');
  assert.equal((await p.locator('#workbenchSentence').textContent()).trim(), sentence);
  assert.match(await p.locator('#workbenchVersion').textContent(), new RegExp('\\b' + version + '\\b'));
  const meaning = await p.locator('#workbenchMeaning').textContent();
  for (const term of [/you/i, /give/i, /basket/i, /2|two/i]) assert.match(meaning, term);
  const derivation = await p.locator('#workbenchDerivation').textContent();
  for (const token of sentence.split(' ')) assert.ok(derivation.includes(token), 'Derivation omits ' + token);
}
async function open(p, project) {
  await p.locator('#projectFile').setInputFiles({name:'workbench.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(project))});
}
function objectEntry(id, meaning, form, canonical) {
  return {id, role:'object', meaning, form, gloss:meaning, author:'Receiver', rationale:'Independent ambiguity fixture', canonical};
}
function fixture(kind) {
  const language = structuredClone(starterLanguage);
  language.languageId = 'workbench-' + kind; language.versionId = language.languageId + '-v1';
  language.name = 'Workbench ' + kind;
  language.lexicon.push(objectEntry('basket-a','basket','selu',kind === 'ambiguous'));
  language.lexicon.push(kind === 'ambiguous' ? objectEntry('box-a','box','selu',true) : objectEntry('basket-b','basket','sela',false));
  // These additions do not affect original examples or required market statements.
  return createProject(language);
}
try {
  browser = await chromium.launch({headless:true,
    ...(process.env.GLOSSOPIA_CHROME ? {executablePath:process.env.GLOSSOPIA_CHROME} : {}),
    ...(process.env.GLOSSOPIA_NO_SANDBOX === '1' ? {args:['--no-sandbox']} : {})});
  async function scenario(name, run) {
    const context = await browser.newContext(), p = await context.newPage(), errors = [];
    p.setDefaultTimeout(5000); p.on('pageerror', e => errors.push(String(e)));
    try {
      await p.goto(url); await p.locator('#wordBank button').first().waitFor();
      await p.locator('#tab-studio').click(); await p.locator('#sentenceWorkbench').waitFor({state:'visible'});
      await run(p); assert.deepEqual(errors, []);
      results.push({name,status:'passed'}); console.log('PASS ' + name);
    } finally { await context.close(); }
  }
  await scenario('Added vocabulary composes literal sentences across accepted grammar and history', async p => {
    await p.locator('#changeKind').selectOption('add');
    await p.locator('#newConcept').fill('basket'); await p.locator('#newWord').fill('selu');
    await p.locator('#proposalRationale').fill('Name a basket'); await review(p); await p.locator('#acceptProposal').click();
    const before = await state(p); assert.equal(before.history.length,2);
    await choose(p); await verified(p,'tu du selu di',2); assert.deepEqual(await state(p),before);
    await p.locator('#changeKind').selectOption('order'); await p.locator('#proposedOrder').selectOption('SVO');
    await p.locator('#proposalRationale').fill('Put the action beside the speaker'); await review(p); await p.locator('#acceptProposal').click();
    await verified(p,'tu di du selu',3);
    const latest = await state(p);
    assert.deepEqual(latest.sessions,before.sessions); assert.equal(latest.activeSessionId,before.activeSessionId);
    await p.locator('#tab-history').click(); await p.getByRole('button',{name:'Inspect version 1',exact:true}).click();
    assert.equal(await p.locator('#workbenchObject').inputValue(),JSON.stringify('basket'));
    assert.equal(await status(p),'unexpressible');
    assert.equal((await p.locator('#workbenchSentence').textContent()).trim(),'');
    assert.match(await p.locator('#workbenchIssues').textContent(),/basket/i);
    assert.match(await p.locator('#workbenchVersion').textContent(),/\b1\b/);
    const historical = await state(p);
    assert.deepEqual(historical.history,latest.history); assert.deepEqual(historical.sessions,latest.sessions);
    await p.getByRole('button',{name:'Return to latest version',exact:true}).click();
    await verified(p,'tu di du selu',3);
    // A real reviewed proposal must remain pending and acceptable during exploration.
    const basket = latest.history.at(-1).lexicon.find(e => e.meaning === 'basket');
    await p.locator('#changeKind').selectOption('rename'); await p.locator('#renameConcept').selectOption(basket.id);
    await p.locator('#renameForm').fill('sela'); await p.locator('#proposalRationale').fill('Refine the basket word'); await review(p);
    const preview = await p.locator('#impactRows').textContent(), pendingState = await state(p);
    await choose(p,'lantern'); await choose(p); await verified(p,'tu di du selu',3);
    assert.deepEqual(await state(p),pendingState); assert.equal(await p.locator('#impactPanel').isVisible(),true);
    assert.equal(await p.locator('#impactRows').textContent(),preview);
    await p.locator('#acceptProposal').click();
    const accepted = await state(p); assert.equal(accepted.history.length,4);
    assert.equal(accepted.history[3].lexicon.find(e => e.id === basket.id).form,'sela');
    assert.deepEqual(accepted.history.slice(0,3),latest.history); assert.deepEqual(accepted.sessions,latest.sessions);
    await verified(p,'tu di du sela',4);
    await p.setViewportSize({width:390,height:844}); await p.locator('#sentenceWorkbench').scrollIntoViewIfNeeded();
    const widths = await p.evaluate(() => ({page:document.documentElement.scrollWidth, viewport:innerWidth, panel:document.querySelector('#sentenceWorkbench').getBoundingClientRect().width}));
    assert.ok(widths.page <= widths.viewport + 1,JSON.stringify(widths)); assert.ok(widths.panel > 0 && widths.panel <=390);
    await p.screenshot({path:resolve(evidence,'workbench-narrow.png'),fullPage:true});
  });
  for (const kind of ['ambiguous','synonyms']) await scenario('Imported '+kind+' vocabulary never claims a verified sentence',async p => {
    const project = fixture(kind); await open(p,project);
    await p.waitForFunction(() => document.querySelector('#toast').textContent.includes('Project opened'));
    await choose(p); assert.deepEqual(await state(p),project);
    assert.equal(await status(p),kind === 'ambiguous' ? 'ambiguous' : 'choice_required');
    const issues = await p.locator('#workbenchIssues').textContent(); assert.ok(issues.trim());
    if (kind === 'ambiguous') {
      assert.match(issues,/basket/i); assert.match(issues,/box/i);
      const candidate = p.locator('#workbenchSentence code');
      assert.equal(await candidate.isVisible(),true);
      assert.equal((await candidate.textContent()).trim(),'tu du selu di');
      const warning = p.locator('#workbenchSentence > small');
      assert.equal(await warning.isVisible(),true);
      assert.match(await warning.textContent(),/unverified|ambiguous|multiple meanings|more than one meaning/i);
    } else {
      assert.equal((await p.locator('#workbenchSentence').textContent()).trim(),'');
      assert.match(issues,/basket/i); assert.match(issues,/prefer|choos|choice|select|multiple|more than one/i);
    }
    await p.screenshot({path:resolve(evidence,'workbench-'+kind+'.png'),fullPage:true});
  });
  await scenario('Same-language delayed Open completes after read-only exploration and resets selections',async p => {
    const replacement = structuredClone(starterLanguage);
    replacement.name = 'Replacement with the same language identity';
    replacement.lexicon.find(entry => entry.id === 'object-lantern').form = 'luma';
    for (const example of replacement.examples) example.text = example.text.replace(/\blum\b/g, 'luma');
    const incoming = createProject(replacement);
    await p.evaluate(() => { File.prototype.text = function() { return new Promise(resolve => { window.finishWorkbenchOpen = resolve; }); }; });
    await open(p,incoming); await p.waitForFunction(() => typeof window.finishWorkbenchOpen === 'function');
    const before = await state(p); await choose(p,'lantern'); assert.deepEqual(await state(p),before);
    await p.evaluate(text => window.finishWorkbenchOpen(text),JSON.stringify(incoming));
    await p.waitForFunction(() => document.querySelector('#toast').textContent.includes('Project opened'));
    assert.deepEqual(await state(p),incoming);
    const selected = await p.evaluate(() => Object.fromEntries(['Actor','Verb','Quantity','Object'].map(role => [role,document.getElementById('workbench'+role).value])));
    assert.deepEqual(selected,{Actor:JSON.stringify('i'),Verb:JSON.stringify('request'),Quantity:'1',Object:JSON.stringify('lantern')});
    assert.equal(await status(p),'ok');
    assert.equal((await p.locator('#workbenchSentence').textContent()).trim(),'mi un luma na');
  });
  await writeFile(resolve(evidence,'workbench-results.json'),JSON.stringify({author:'/root/consumer_recovery',app_root:root,url,browser:await browser.version(),results},null,2)+'\n');
} catch(error) {
  await writeFile(resolve(evidence,'workbench-failure.json'),JSON.stringify({results,error:String(error),stack:error.stack},null,2)+'\n'); throw error;
} finally { if(browser) await browser.close(); if(server) await new Promise(r=>server.close(r)); }
