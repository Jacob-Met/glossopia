// Server-side word suggestions for the language creation form.
// NVIDIA Nemotron on Nebius Token Factory proposes candidate word forms.
// The app's own deterministic creation check (createLanguage) verifies every
// candidate before the browser sees it. The API key never leaves this module.
import {createLanguage} from './language-creation.mjs';
import {starterLanguage} from './starter-language.mjs';

export const NEBIUS_BASE_URL = 'https://api.tokenfactory.nebius.com/v1';
// Super is the strongest Nemotron 3 model on Token Factory that answered this
// short task in about 8 seconds during testing. The smaller Nano model used its
// whole reasoning budget on the first, longer prompt and returned no answer text.
export const NEMOTRON_MODEL = 'nvidia/nemotron-3-super-120b-a12b';
export const MAX_CANDIDATES = 3;
// Reasoning models spend completion tokens before the visible answer.
export const MAX_TOKENS = 6000;
const FORM = /^[a-z]{1,20}$/;
const ORDERS = ['SOV', 'SVO'];
const MEANINGS = starterLanguage.lexicon.map(entry => ({id: entry.id, role: entry.role, gloss: entry.gloss}));

export class SuggestionError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'SuggestionError';
    this.code = code;
    this.status = status;
  }
}

/** Validate the draft fields the browser sends. Returns a normalized draft or throws. */
export function normalizeDraft(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new SuggestionError('bad-request', 'Send a JSON object.', 400);
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const author = typeof input.author === 'string' ? input.author.trim() : '';
  const rationale = typeof input.rationale === 'string' ? input.rationale.trim() : '';
  const order = input.order;
  if (!name || name.length > 80) throw new SuggestionError('bad-request', 'Name the language first (1–80 characters).', 400);
  if (!author || author.length > 80) throw new SuggestionError('bad-request', 'Enter an author name first (1–80 characters).', 400);
  if (rationale.length > 240) throw new SuggestionError('bad-request', 'The note must be 240 characters or fewer.', 400);
  if (!ORDERS.includes(order)) throw new SuggestionError('bad-request', 'Choose SOV or SVO.', 400);
  return {name, author, order, rationale};
}

/** Chat messages asking for several complete candidate sets as JSON. */
export function buildMessages(draft) {
  const meanings = MEANINGS.map(m => `"${m.id}" = ${m.gloss} (${m.role})`).join('; ');
  const system = 'Invent word forms for a small language. Reply with JSON only, in this shape: '
    + '{"candidates":[{"note":"one short sentence","forms":{"<meaning id>":"<form>"}}]}. '
    + 'Each form is 1 to 20 lowercase letters a-z. Within one candidate every form is different. '
    + `Give ${MAX_CANDIDATES} different candidates, each with every meaning id.`;
  const user = [
    `Language name: ${draft.name}.`,
    `Order: ${draft.order === 'SOV' ? 'speaker, quantity, thing, action' : 'speaker, action, quantity, thing'}.`,
    draft.rationale ? `Feel: ${draft.rationale}.` : 'Make the words short and easy to say.',
    `Meanings: ${meanings}.`
  ].join(' ');
  return [{role: 'system', content: system}, {role: 'user', content: user}];
}

/** Build the Token Factory chat-completions request. The key is supplied only in the header. */
export function buildRequest({apiKey, messages, model = NEMOTRON_MODEL, baseUrl = NEBIUS_BASE_URL, maxTokens = MAX_TOKENS}) {
  return {
    url: baseUrl.replace(/\/+$/, '') + '/chat/completions',
    init: {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey},
      body: JSON.stringify({model, messages, temperature: 0.7, max_tokens: maxTokens})
    }
  };
}

/** Read message.content. Reasoning fields are ignored. */
export function extractContent(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new SuggestionError('upstream', 'Nemotron returned no answer text.', 502);
  return content;
}

/** Tolerant parse: accepts a fenced block or prose around the JSON object. */
export function parseCandidates(text) {
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return [];
  let data;
  try { data = JSON.parse(text.slice(start, end + 1)); } catch { return []; }
  if (!data || !Array.isArray(data.candidates)) return [];
  return data.candidates.slice(0, MAX_CANDIDATES).map(candidate => ({
    note: typeof candidate?.note === 'string' ? candidate.note.slice(0, 200) : '',
    forms: candidate && typeof candidate.forms === 'object' && candidate.forms !== null ? candidate.forms : {}
  }));
}

/** Deterministic check. Every form must match the rule and the app's own createLanguage must accept the set. */
export function checkCandidate(draft, candidate) {
  const forms = {};
  for (const meaning of MEANINGS) {
    const raw = candidate.forms[meaning.id];
    if (typeof raw !== 'string') return {ok: false, forms, reason: 'No form was proposed for ' + meaning.gloss + '.'};
    const form = raw.trim().toLowerCase();
    if (!FORM.test(form)) return {ok: false, forms, reason: '“' + raw.slice(0, 24) + '” for ' + meaning.gloss + ' is not 1–20 letters a–z.'};
    forms[meaning.id] = form;
  }
  const values = Object.values(forms);
  const duplicate = values.find((form, index) => values.indexOf(form) !== index);
  if (duplicate) return {ok: false, forms, reason: '“' + duplicate + '” is proposed for two meanings.'};
  try {
    const language = createLanguage({languageId: 'suggestion-check', name: draft.name, author: draft.author, order: draft.order, forms});
    return {ok: true, forms, examples: language.examples.map(example => example.text)};
  } catch (error) {
    return {ok: false, forms, reason: error.message};
  }
}

/** Call Nemotron. fetchImpl is injectable so tests never touch the network. */
export async function callNemotron({apiKey, messages, model, baseUrl, fetchImpl = fetch, timeoutMs = 60000}) {
  const {url, init} = buildRequest({apiKey, messages, model, baseUrl});
  let response;
  try {
    response = await fetchImpl(url, {...init, signal: AbortSignal.timeout(timeoutMs)});
  } catch {
    throw new SuggestionError('upstream', 'Could not reach Nebius Token Factory. Check the connection and try again.', 502);
  }
  if (!response.ok) throw new SuggestionError('upstream', 'Nebius Token Factory answered HTTP ' + response.status + '. Try again later.', 502);
  return extractContent(await response.json());
}

/** Full flow: propose with Nemotron, parse, and verify each set. */
export async function suggestWords(input, {apiKey = process.env.NEBIUS_API_KEY, model = NEMOTRON_MODEL, baseUrl, fetchImpl} = {}) {
  const draft = normalizeDraft(input);
  if (!apiKey) throw new SuggestionError('no-key', 'Word suggestions need the Node server started with NEBIUS_API_KEY set. Forms can still be typed by hand.', 503);
  const text = await callNemotron({apiKey, messages: buildMessages(draft), model, baseUrl, fetchImpl});
  const candidates = parseCandidates(text);
  if (!candidates.length) throw new SuggestionError('upstream', 'Nemotron did not return a readable set of words. Try again.', 502);
  return {
    model,
    checkedBy: 'GLOSSOPIA creation check',
    candidates: candidates.map(candidate => ({note: candidate.note, ...checkCandidate(draft, candidate)}))
  };
}
