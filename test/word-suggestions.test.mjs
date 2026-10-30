import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRequest, buildMessages, normalizeDraft, parseCandidates, checkCandidate, extractContent,
  callNemotron, suggestWords, NEBIUS_BASE_URL, NEMOTRON_MODEL, SuggestionError
} from '../src/word-suggestions.mjs';
import {createServer} from '../server.mjs';
import {starterLanguage} from '../src/starter-language.mjs';

const draft = normalizeDraft({name: 'Lumen', author: 'Ada', order: 'SOV', rationale: 'soft and short'});
const starterForms = Object.fromEntries(starterLanguage.lexicon.map(entry => [entry.id, entry.form]));
const fakeReply = content => async () => ({ok: true, status: 200, json: async () => ({choices: [{message: {content, reasoning: 'hidden'}}]})});

test('request goes to Token Factory with the key only in the Authorization header', () => {
  const {url, init} = buildRequest({apiKey: 'test-key-123', messages: buildMessages(draft)});
  assert.equal(url, NEBIUS_BASE_URL + '/chat/completions');
  assert.equal(init.headers.Authorization, 'Bearer test-key-123');
  const body = JSON.parse(init.body);
  assert.equal(body.model, NEMOTRON_MODEL);
  assert.ok(body.max_tokens >= 1500, 'reasoning models need room for their answer');
  assert.ok(!init.body.includes('test-key-123'), 'the key never appears in the body');
});

test('draft fields are validated before any model call', () => {
  assert.throws(() => normalizeDraft({name: '', author: 'A', order: 'SOV'}), SuggestionError);
  assert.throws(() => normalizeDraft({name: 'N', author: 'A', order: 'VSO'}), SuggestionError);
  assert.throws(() => normalizeDraft({name: 'N', author: 'A', order: 'SOV', rationale: 'x'.repeat(241)}), SuggestionError);
});

test('reads message.content and ignores reasoning fields', () => {
  assert.equal(extractContent({choices: [{message: {content: 'hi', reasoning: 'x'}}]}), 'hi');
  assert.throws(() => extractContent({choices: [{message: {content: '   '}}]}), SuggestionError);
});

test('parses fenced or prose-wrapped JSON and caps the number of sets', () => {
  const text = 'Here you go:\n```json\n{"candidates":[{"note":"a","forms":{"actor-i":"ma"}},{"forms":{}},{"forms":{}},{"forms":{}}]}\n```';
  const parsed = parseCandidates(text);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].forms['actor-i'], 'ma');
  assert.deepEqual(parseCandidates('no json here'), []);
});

test('the app check accepts the starter forms and rejects bad or duplicate forms', () => {
  const good = checkCandidate(draft, {forms: starterForms});
  assert.equal(good.ok, true, good.reason);
  assert.ok(good.examples.length > 0);
  const upper = checkCandidate(draft, {forms: {...starterForms, 'object-pear': 'PON'}});
  assert.equal(upper.ok, true, 'uppercase is normalized before the check');
  const digit = checkCandidate(draft, {forms: {...starterForms, 'object-pear': 'pon2'}});
  assert.equal(digit.ok, false);
  assert.match(digit.reason, /1–20 letters/);
  const dup = checkCandidate(draft, {forms: {...starterForms, 'object-pear': 'lum'}});
  assert.equal(dup.ok, false);
  assert.match(dup.reason, /two meanings/);
  const missing = checkCandidate(draft, {forms: {...starterForms, 'object-pear': undefined}});
  assert.equal(missing.ok, false);
});

test('without a key the flow stops before any network call', async () => {
  let called = false;
  await assert.rejects(
    suggestWords({name: 'N', author: 'A', order: 'SOV'}, {apiKey: '', fetchImpl: async () => { called = true; }}),
    error => error.code === 'no-key' && error.status === 503
  );
  assert.equal(called, false);
});

test('a model reply is parsed and every set is checked by the app', async () => {
  const reply = JSON.stringify({candidates: [{note: 'starter', forms: starterForms}, {note: 'bad', forms: {}}]});
  const result = await suggestWords({name: 'N', author: 'A', order: 'SVO'},
    {apiKey: 'k', fetchImpl: fakeReply('```json\n' + reply + '\n```')});
  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0].ok, true);
  assert.equal(result.candidates[1].ok, false);
});

test('upstream failures surface a short message without the key', async () => {
  const failing = async () => ({ok: false, status: 503, json: async () => ({})});
  await assert.rejects(callNemotron({apiKey: 'secret-key-value', messages: [], fetchImpl: failing}),
    error => error instanceof SuggestionError && error.status === 502 && !error.message.includes('secret-key-value'));
  const offline = async () => { throw new Error('ENOTFOUND'); };
  await assert.rejects(callNemotron({apiKey: 'k', messages: [], fetchImpl: offline}), error => error.status === 502);
});

test('the HTTP route refuses GET, and reports no-key without a key', async () => {
  const saved = process.env.NEBIUS_API_KEY;
  delete process.env.NEBIUS_API_KEY;
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const get = await fetch(base + '/api/word-suggestions');
    assert.equal(get.status, 405);
    const post = await fetch(base + '/api/word-suggestions', {method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name: 'N', author: 'A', order: 'SOV'})});
    assert.equal(post.status, 503);
    const body = await post.json();
    assert.equal(body.error, 'no-key');
    const health = await (await fetch(base + '/health')).json();
    assert.equal(health.wordSuggestions.available, false);
    assert.equal(health.wordSuggestions.model, NEMOTRON_MODEL);
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (saved !== undefined) process.env.NEBIUS_API_KEY = saved;
  }
});
