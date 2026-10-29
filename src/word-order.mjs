import {validateVersion, parse} from './language-core.mjs';

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function permutations(tokens) {
  const results = [];
  function visit(prefix, remaining) {
    if (!remaining.length) { results.push(prefix.join(' ')); return; }
    for (let index = 0; index < remaining.length; index++) {
      if (index > 0 && remaining[index] === remaining[index - 1]) continue;
      visit([...prefix, remaining[index]], [...remaining.slice(0, index), ...remaining.slice(index + 1)]);
    }
  }
  // Accepted forms are ASCII letters. Default ordering is deterministic and
  // independent of host locale; duplicate occurrences remain in each sentence.
  visit([], [...tokens].sort());
  return results;
}

/** Analyze only reordering of the same accepted words, never intended meaning
 * or mission correctness. Search counters are zero when no search is eligible.
 * This function neither edits input nor submits a statement.
 */
export function analyzeWordOrder(versionInput, text) {
  const version = validateVersion(structuredClone(versionInput));
  const original = parse(version, text);
  const result = {
    versionId: version.versionId,
    original,
    status: original.status === 'ok' ? 'already_valid' : 'not_applicable',
    expectedRoles: version.grammar.order === 'SOV' ? ['actor', 'quantity', 'object', 'verb'] : ['actor', 'verb', 'quantity', 'object'],
    permutationCount: 0,
    meaningCount: 0,
    suggestion: null
  };
  if (original.status !== 'invalid_syntax' || original.tokens.length !== 4 || original.unknownWords.length !== 0 || !original.issues.some(issue => issue.code === 'ROLE_ORDER_MISMATCH')) {
    return freeze(result);
  }

  const meanings = new Map(), unambiguous = [];
  const candidates = permutations(original.tokens);
  // All four accepted forms have at most 20 ASCII letters, so every permutation
  // fits the parser's 240-character bound. The current parser exhausts all role
  // assignments (at most 4^4); it does not truncate readings. Do not catch errors
  // or skip unknown outcomes: incomplete analysis must never assert uniqueness.
  for (const candidateText of candidates) {
    const interpretation = parse(version, candidateText);
    result.permutationCount++;
    if (interpretation.status === 'invalid_syntax') {
      if (!interpretation.issues.every(issue => issue.code === 'ROLE_ORDER_MISMATCH')) throw new Error('Word-order search could not completely verify a permutation.');
      continue;
    }
    if (!['ok', 'ambiguous'].includes(interpretation.status)) throw new Error('Word-order search encountered an unexpected parser outcome.');
    for (const reading of interpretation.readings) {
      const meaning = reading.meaning;
      meanings.set(JSON.stringify([meaning.actor, meaning.verb, meaning.quantity, meaning.object]), meaning);
    }
    if (interpretation.status === 'ok') unambiguous.push({text: candidateText, meaning: interpretation.meaning, interpretation});
  }
  result.meaningCount = meanings.size;
  if (meanings.size === 0) result.status = 'no_rearrangement';
  else if (meanings.size !== 1 || unambiguous.length === 0) result.status = 'ambiguous_rearrangement';
  else { result.status = 'suggested'; result.suggestion = unambiguous[0]; }
  return freeze(result);
}
