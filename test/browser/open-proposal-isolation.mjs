// Consumer receiver authored by retained priority_recovery worker.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const root = resolve(process.env.GLOSSOPIA_APP_ROOT ?? fileURLToPath(new URL('../../', import.meta.url)));
const evidence = resolve(process.env.GLOSSOPIA_EVIDENCE ?? 'test-output/open-proposal-isolation');
const {chromium} = await import(process.env.GLOSSOPIA_PLAYWRIGHT ?? 'playwright');
const {createServer} = await import(pathToFileURL(resolve(root, 'server.mjs')));
const {starterLanguage} = await import(pathToFileURL(resolve(root, 'src/starter-language.mjs')));
const {createProject} = await import(pathToFileURL(resolve(root, 'src/project.mjs')));
const incoming = structuredClone(starterLanguage);
incoming.languageId = 'separate-language'; incoming.versionId = 'separate-v1'; incoming.name = 'Separate language'; incoming.author = 'Incoming author';
for (const entry of incoming.lexicon) entry.id = 'separate-' + entry.id;
const imported = createProject(incoming);
const server = process.env.GLOSSOPIA_URL ? null : createServer();
if (server) await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = process.env.GLOSSOPIA_URL ?? ('http://127.0.0.1:' + server.address().port);
await mkdir(evidence, {recursive: true});
const results = []; let browser;
const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('glossopia-project-v1')));
const fields = page => page.evaluate(() => Object.fromEntries(['changeKind','proposedOrder','renameConcept','renameForm','newConcept','newWord','proposalAuthor','proposalRationale'].map(id => [id, document.getElementById(id).value])));
async function draft(page) {
  await page.locator('#tab-studio').click();
  await page.locator('#proposedOrder').selectOption('SOV');
  await page.locator('#changeKind').selectOption('add');
  await page.locator('#newConcept').fill('basket'); await page.locator('#newWord').fill('selu');
  await page.locator('#changeKind').selectOption('rename');
  await page.locator('#renameConcept').selectOption('object-lantern');
  await page.locator('#renameForm').fill('luma');
  await page.locator('#proposalAuthor').fill('Outgoing author');
  await page.locator('#proposalRationale').fill('This draft belongs to the previous project');
  await page.locator('#proposalForm button[type=submit]').click();
  assert.equal(await page.locator('#impactPanel').isVisible(), true);
}
async function open(page, text, name = 'separate-language.json') {
  await page.locator('#projectFile').setInputFiles({name, mimeType: 'application/json', buffer: Buffer.from(text)});
}
try {
  browser = await chromium.launch({headless: true,
    ...(process.env.GLOSSOPIA_CHROME ? {executablePath: process.env.GLOSSOPIA_CHROME} : {}),
    ...(process.env.GLOSSOPIA_NO_SANDBOX === '1' ? {args: ['--no-sandbox']} : {})});
  async function scenario(name, run) {
    const context = await browser.newContext(), page = await context.newPage(), errors = [];
    page.setDefaultTimeout(5000); page.on('pageerror', error => errors.push(String(error)));
    try {
      await page.goto(url); await page.locator('#wordBank button').first().waitFor();
      await run(page); assert.deepEqual(errors, []);
      results.push({name, status: 'passed'}); console.log('PASS ' + name);
    } finally { await context.close(); }
  }
  for (const disjoint of [true, false]) await scenario('Successful Open clears all outgoing proposal fields with ' + (disjoint ? 'disjoint' : 'shared') + ' word IDs', async page => {
    await draft(page);
    const target = disjoint ? imported : createProject({...structuredClone(starterLanguage), author: 'Incoming author'});
    await open(page, JSON.stringify(target));
    await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Project opened'));
    assert.deepEqual(await state(page), target);
    assert.equal(await page.locator('#impactPanel').isVisible(), false);
    assert.deepEqual(await fields(page), {changeKind: 'order', proposedOrder: 'SVO', renameConcept: target.history[0].lexicon[0].id, renameForm: '', newConcept: '', newWord: '', proposalAuthor: 'Incoming author', proposalRationale: ''});
    // The new author becomes the reset default as well as the visible value.
    assert.equal(await page.locator('#proposalAuthor').evaluate(el => el.defaultValue), 'Incoming author');
    await page.locator('#proposalRationale').fill('Put the action beside the speaker');
    await page.locator('#proposalForm button[type=submit]').click();
    await page.locator('#acceptProposal').click();
    const accepted = await state(page);
    assert.equal(accepted.history.length, 2);
    assert.deepEqual(accepted.history[0], target.history[0]);
    assert.deepEqual(accepted.history[1].lexicon, target.history[0].lexicon);
    assert.equal(accepted.history[1].grammar.order, 'SVO');
    assert.equal(accepted.history[1].author, 'Incoming author');
    assert.deepEqual(accepted.sessions, target.sessions);
    assert.equal(accepted.activeSessionId, target.activeSessionId);
    await page.screenshot({path: resolve(evidence, disjoint ? 'disjoint-open.png' : 'shared-open.png'), fullPage: true});
  });
  await scenario('Invalid Open preserves the reviewed proposal and every draft field', async page => {
    await draft(page); const before = await state(page), form = await fields(page);
    const preview = await page.locator('#impactRows').textContent();
    await open(page, '{');
    await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Could not open'));
    assert.deepEqual(await state(page), before); assert.deepEqual(await fields(page), form);
    assert.equal(await page.locator('#impactPanel').isVisible(), true);
    assert.equal(await page.locator('#impactRows').textContent(), preview);
    await page.locator('#acceptProposal').click();
    const accepted = await state(page); assert.equal(accepted.history.length, 2);
    assert.equal(accepted.history[1].lexicon.find(e => e.id === 'object-lantern').form, 'luma');
  });
  await scenario('Later proposal work supersedes delayed Open without resetting fields', async page => {
    await draft(page); const before = await state(page);
    await page.evaluate(() => { File.prototype.text = function() { return new Promise(resolve => { window.finishProposalOpen = resolve; }); }; });
    await open(page, JSON.stringify(imported));
    await page.waitForFunction(() => typeof window.finishProposalOpen === 'function');
    await page.locator('#proposalRationale').fill('Later work stays with the current language');
    await page.locator('#proposalForm button[type=submit]').click();
    const form = await fields(page), preview = await page.locator('#impactRows').textContent();
    await page.evaluate(text => window.finishProposalOpen(text), JSON.stringify(imported));
    await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Open skipped'));
    assert.deepEqual(await state(page), before); assert.deepEqual(await fields(page), form);
    assert.equal(await page.locator('#impactPanel').isVisible(), true);
    assert.equal(await page.locator('#impactRows').textContent(), preview);
    await page.locator('#acceptProposal').click();
    const accepted = await state(page); assert.equal(accepted.history.length, 2);
    assert.equal(accepted.history[1].lexicon.find(e => e.id === 'object-lantern').form, 'luma');
  });
  await writeFile(resolve(evidence, 'open-proposal-results.json'), JSON.stringify({author: 'priority_recovery', app_root: root, url, browser: await browser.version(), results}, null, 2) + '\n');
} catch (error) {
  await writeFile(resolve(evidence, 'open-proposal-failure.json'), JSON.stringify({results, error: String(error), stack: error.stack}, null, 2) + '\n');
  throw error;
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(r => server.close(r));
}
