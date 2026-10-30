// Consumer regression authored by retained priority_recovery worker; executed through Renpō by the lead.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const appRoot = resolve(process.env.GLOSSOPIA_APP_ROOT ?? fileURLToPath(new URL('../../', import.meta.url)));
const evidence = resolve(process.env.GLOSSOPIA_EVIDENCE ?? 'test-output/proposal-target');
const baseline = process.env.EXPECT_BASELINE_FAILURE === '1';
const {chromium} = await import(process.env.GLOSSOPIA_PLAYWRIGHT ?? 'playwright');
const {createServer} = await import(pathToFileURL(resolve(appRoot, 'server.mjs')));
const server = process.env.GLOSSOPIA_URL ? null : createServer();
if (server) await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = process.env.GLOSSOPIA_URL ?? ('http://127.0.0.1:' + server.address().port);
await mkdir(evidence, {recursive: true});
const results = [];
let browser;
const state = p => p.evaluate(() => JSON.parse(localStorage.getItem('glossopia-project-v1')));
const review = p => p.locator('#proposalForm button[type=submit]').click();
try {
  browser = await chromium.launch({headless: true,
    ...(process.env.GLOSSOPIA_CHROME ? {executablePath: process.env.GLOSSOPIA_CHROME} : {}),
    ...(process.env.GLOSSOPIA_NO_SANDBOX === '1' ? {args: ['--no-sandbox']} : {})});
  for (const reviewed of [false, true]) {
    const name = reviewed ? 'Reviewed rename retains its target through history and re-review' : 'Unreviewed rename retains its target through history';
    const context = await browser.newContext(), p = await context.newPage(), errors = [];
    p.setDefaultTimeout(5000);
    p.on('pageerror', e => errors.push(String(e)));
    try {
      await p.goto(url);
      await p.locator('#wordBank button').first().waitFor();
      await p.locator('#tab-studio').click();
      await p.locator('#changeKind').selectOption('add');
      await p.locator('#newConcept').fill('basket');
      await p.locator('#newWord').fill('selu');
      await p.locator('#proposalRationale').fill('Name a basket');
      await review(p);
      await p.locator('#acceptProposal').click();
      const before = await state(p);
      assert.equal(before.history.length, 2);
      const added = before.history[1].lexicon.find(e => e.meaning === 'basket');
      assert.ok(added);
      await p.locator('#changeKind').selectOption('rename');
      await p.locator('#renameConcept').selectOption(added.id);
      await p.locator('#renameForm').fill('sela');
      await p.locator('#proposalRationale').fill('Refine the basket word');
      if (reviewed) {
        await review(p);
        assert.match(await p.locator('#impactRows').textContent(), /selu → sela \(basket\)/);
      }
      await p.locator('#tab-history').click();
      await p.getByRole('button', {name: 'Inspect version 1', exact: true}).click();
      assert.equal(await p.locator('#renameConcept').isDisabled(), true);
      assert.equal(await p.locator('#lexiconBody tr').count(), 10);
      assert.doesNotMatch(await p.locator('#lexiconBody').textContent(), /basket|selu|sela/);
      assert.equal(await p.locator('#renameForm').inputValue(), 'sela');
      await p.getByRole('button', {name: 'Return to latest version', exact: true}).click();
      assert.equal(await p.locator('#renameConcept').isDisabled(), false);
      assert.equal(await p.locator('#renameConcept').inputValue(), baseline ? before.history[0].lexicon[0].id : added.id);
      assert.equal(await p.locator('#renameForm').inputValue(), 'sela');
      assert.equal(await p.locator('#proposalRationale').inputValue(), 'Refine the basket word');
      if (reviewed) assert.match(await p.locator('#impactRows').textContent(), /selu → sela \(basket\)/);
      // Re-review is a legitimate action after looking up an older version: it must retain intent.
      await review(p);
      assert.match(await p.locator('#impactRows').textContent(), baseline ? /mi → sela \(i\)/ : /selu → sela \(basket\)/);
      await p.locator('#acceptProposal').click();
      const after = await state(p);
      assert.equal(after.history.length, 3);
      assert.deepEqual(after.history.slice(0, 2), before.history);
      assert.deepEqual(after.sessions, before.sessions);
      assert.equal(after.activeSessionId, before.activeSessionId);
      const expected = structuredClone(before.history[1].lexicon);
      const changedId = baseline ? before.history[0].lexicon[0].id : added.id;
      const changed = expected.find(e => e.id === changedId);
      changed.form = 'sela';
      changed.author = 'Studio author';
      changed.rationale = 'Refine the basket word';
      assert.deepEqual(after.history[2].lexicon, expected);
      assert.deepEqual(after.history[2].grammar, before.history[1].grammar);
      assert.deepEqual(errors, []);
      await p.screenshot({path: resolve(evidence, reviewed ? 'reviewed-target.png' : 'draft-target.png'), fullPage: true});
      results.push({name, status: baseline ? 'observed-wrong-target-defect' : 'passed', intendedEntryId: added.id, actualChangedEntryId: changedId});
      console.log((baseline ? 'BASELINE DEFECT ' : 'PASS ') + name);
    } finally { await context.close(); }
  }
  await writeFile(resolve(evidence, 'proposal-target-results.json'), JSON.stringify({author: 'priority_recovery', app_root: appRoot, url, baseline, browser: await browser.version(), results}, null, 2) + '\n');
} catch (error) {
  await writeFile(resolve(evidence, 'proposal-target-failure.json'), JSON.stringify({results, error: String(error), stack: error.stack}, null, 2) + '\n');
  throw error;
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(r => server.close(r));
}
