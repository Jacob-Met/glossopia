import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const file = process.env.STANDALONE_FILE, output = process.env.EVIDENCE_DIR;
assert.ok(file && path.isAbsolute(file), 'STANDALONE_FILE must be an absolute HTML path');
assert.ok(output && path.isAbsolute(output), 'EVIDENCE_DIR must be absolute');
await mkdir(output, {recursive: true});
const report = {suite: 'standalone-runtime-receiving', attribution: 'Builder-author receiving, not independent acceptance', startedAt: new Date().toISOString(), server: null, serverStarted: false, offline: true, checks: [], pageUrls: [], requests: [], forbiddenRequests: [], browserErrors: [], consoleErrors: []};
let browser, mainPage;
async function step(name, fn) {
  try { await fn(); report.checks.push({name, pass: true}); }
  catch (error) { report.checks.push({name, pass: false, error: String(error.stack || error)}); throw error; }
}
async function poll(read, accept, label) {
  const end = Date.now() + 10000;
  do { const value = await read(); if (accept(value)) return value; await new Promise(resolve => setTimeout(resolve, 50)); } while (Date.now() < end);
  throw new Error('Timed out: ' + label);
}
const forms = {'actor-i':'zi','actor-you':'va','verb-request':'ke','verb-give':'do','verb-have':'se','object-lantern':'len','object-pear':'pir','quantity-one':'an','quantity-two':'bi','quantity-three':'ci'};
try {
  const html = await readFile(file);
  report.sourceHTML = {path: file, bytes: html.length, sha256: createHash('sha256').update(html).digest('hex')};
  const url = pathToFileURL(file).href; report.url = url;
  const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ? (path.isAbsolute(process.env.PLAYWRIGHT_MODULE) ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : process.env.PLAYWRIGHT_MODULE) : 'playwright');
  browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
  report.browserVersion = await browser.version();
  async function fresh() {
    const context = await browser.newContext({offline: true, serviceWorkers: 'block', acceptDownloads: true, viewport: {width: 1440, height: 1100}});
    context.on('request', request => {
      const requested = request.url(), protocol = new URL(requested).protocol;
      report.requests.push({url: requested, resourceType: request.resourceType()});
      if (!['file:', 'blob:', 'data:'].includes(protocol)) report.forbiddenRequests.push(requested);
    });
    await context.route('**/*', route => ['file:', 'blob:', 'data:'].includes(new URL(route.request().url()).protocol) ? route.continue() : route.abort('blockedbyclient'));
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    page.on('pageerror', error => report.browserErrors.push(String(error)));
    page.on('console', message => {
      if (message.type() === 'error' || /content security policy|violates.*directive|refused to (?:load|execute|apply)/i.test(message.text())) report.consoleErrors.push({type: message.type(), text: message.text()});
    });
    await page.goto(url, {waitUntil: 'load', timeout: 15000});
    assert.equal(page.url(), url); report.pageUrls.push(page.url());
    await page.locator('#wordBank button').first().waitFor();
    return {context, page};
  }
  async function download(page, locator, label) {
    const pending = page.waitForEvent('download'); await locator.click(); const item = await pending;
    assert.equal(await item.failure(), null);
    const stream = await item.createReadStream(); assert.ok(stream);
    const chunks = []; for await (const chunk of stream) chunks.push(chunk);
    const text = Buffer.concat(chunks).toString('utf8');
    await writeFile(path.join(output, label + '.json'), text);
    const project = JSON.parse(text);
    assert.equal(project.format, 'glossopia-project'); assert.equal(project.schemaVersion, 1);
    return project;
  }
  const exported = (page, label) => download(page, page.locator('#saveProject'), label);
  let initial, completed, restored;
  const primary = await fresh(); mainPage = primary.page;
  await step('file-bootstrap-and-real-tabs', async () => {
    assert.equal(await mainPage.locator('#wordBank button').count(), 10);
    const homeDraft = 'home navigation retains this unsent draft';
    await mainPage.locator('#sentenceInput').fill(homeDraft);
    await mainPage.locator('#tab-studio').click(); assert.equal(await mainPage.locator('#studioView').isVisible(), true);
    assert.equal(await mainPage.locator('#tab-studio').getAttribute('aria-selected'), 'true');
    await mainPage.getByRole('link', {name: 'Glossopia home', exact: true}).click();
    assert.equal(await mainPage.locator('#marketView').isVisible(), true);
    assert.equal(await mainPage.locator('#studioView').isVisible(), false);
    assert.equal(await mainPage.locator('#tab-market').getAttribute('aria-selected'), 'true');
    assert.equal(await mainPage.locator('#sentenceInput').inputValue(), homeDraft);
    await mainPage.locator('#clearSentence').click();
    initial = await exported(mainPage, 'initial');
  });
  await step('offline-create-authored-language-and-complete-trade', async () => {
    await mainPage.locator('#newLanguage').click();
    await mainPage.locator('#creationName').fill('Offline Kiri'); await mainPage.locator('#creationAuthor').fill('Offline receiving author');
    await mainPage.locator('#creationOrder').selectOption('SOV');
    for (const [id, form] of Object.entries(forms)) await mainPage.locator('#creationForm-' + id).fill(form);
    await mainPage.locator('#reviewCreation').click(); await mainPage.locator('#creationPreview').waitFor({state: 'visible'});
    assert.equal(await mainPage.locator('#creationExamples [data-example-id]').count(), 6);
    await mainPage.locator('#createLanguage').click();
    await poll(() => mainPage.locator('#languageName').innerText(), value => value === 'Offline Kiri', 'Create named language using file-origin storage');
    const created = await exported(mainPage, 'created');
    assert.notEqual(created.history[0].languageId, initial.history[0].languageId);
    assert.equal(created.history[0].author, 'Offline receiving author');
    for (const entry of created.history[0].lexicon) assert.equal(entry.form, forms[entry.id]);
    const sentences = ['zi an len ke', 'zi bi pir do', 'zi an len se'];
    for (const [index, sentence] of sentences.entries()) {
      await mainPage.locator('#sentenceInput').fill(sentence); await mainPage.locator('#saySentence').click();
      assert.deepEqual(await mainPage.locator('#inventory strong').allTextContents(), index === 0 ? ['3', '0'] : ['1', '1']);
    }
    assert.equal(await mainPage.locator('#missionProgress').innerText(), 'Complete');
    completed = await exported(mainPage, 'completed');
    assert.deepEqual(completed.sessions.find(session => session.id === completed.activeSessionId).inputs, sentences);
    await mainPage.screenshot({path: path.join(output, 'completed-desktop.png'), fullPage: true});
  });
  await step('reload-restores-browser-local-project-and-transcript', async () => {
    await mainPage.reload({waitUntil: 'load'}); assert.equal(mainPage.url(), url); report.pageUrls.push(mainPage.url());
    await poll(() => mainPage.locator('#languageName').innerText(), value => value === 'Offline Kiri', 'Persisted project after reload');
    assert.equal(await mainPage.locator('#missionProgress').innerText(), 'Complete');
    assert.deepEqual(await exported(mainPage, 'reloaded'), completed);
  });
  await step('saved-project-archive-survives-reload-and-restores-original', async () => {
    await mainPage.locator('#savedProjects').click();
    const prior = mainPage.locator('#archivedProjects [data-snapshot-id]').first(); await prior.waitFor();
    assert.deepEqual(await download(mainPage, prior.locator('[data-action="export"]'), 'archived-original'), initial);
    await prior.locator('[data-action="open"]').click();
    await poll(() => mainPage.locator('#languageName').innerText(), value => value === initial.history.at(-1).name, 'Original archived project restored');
    restored = await exported(mainPage, 'restored-original'); assert.deepEqual(restored, initial);
    await mainPage.locator('#savedProjects').click();
    assert.ok(await mainPage.locator('#archivedProjects [data-snapshot-id]').count() >= 2);
    await mainPage.locator('#closeArchive').click();
    await mainPage.reload({waitUntil: 'load'}); await mainPage.locator('#wordBank button').first().waitFor();
    assert.deepEqual(await exported(mainPage, 'restored-reload'), initial);
  });
  await step('download-reopens-exactly-in-fresh-offline-context', async () => {
    const other = await fresh();
    assert.deepEqual(await exported(other.page, 'fresh-before-import'), initial);
    await other.page.locator('#projectFile').setInputFiles(path.join(output, 'completed.json'));
    await poll(() => other.page.locator('#languageName').innerText(), value => value === 'Offline Kiri', 'Downloaded project import');
    assert.deepEqual(await exported(other.page, 'fresh-imported'), completed);
    assert.equal(await other.page.locator('#missionProgress').innerText(), 'Complete');
    assert.deepEqual(await other.page.locator('#inventory strong').allTextContents(), ['1', '1']);
    await other.page.setViewportSize({width: 390, height: 844});
    await other.page.screenshot({path: path.join(output, 'fresh-mobile.png'), fullPage: true});
    await other.context.close();
  });
  await step('no-network-or-csp-or-browser-errors', async () => {
    assert.deepEqual(report.forbiddenRequests, []);
    assert.deepEqual(report.browserErrors, []); assert.deepEqual(report.consoleErrors, []);
    assert.ok(report.requests.length > 0);
    for (const request of report.requests.filter(request => request.url.startsWith('file:'))) assert.equal(request.url, url, 'Standalone must not load other local assets');
  });
  await primary.context.close();
} catch (error) {
  report.error = String(error.stack || error);
  if (mainPage && !mainPage.isClosed()) {
    try { await mainPage.screenshot({path: path.join(output, 'failure.png'), fullPage: true}); }
    catch (screenshotError) { report.screenshotError = String(screenshotError); }
  }
} finally {
  try { if (browser) await browser.close(); } catch (error) { report.cleanupError = String(error); }
  report.passed = !report.error && !report.cleanupError && report.forbiddenRequests.length === 0 && report.browserErrors.length === 0 && report.consoleErrors.length === 0;
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(output, 'standalone-runtime-receiving.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2)); process.exitCode = report.passed ? 0 : 1;
}
