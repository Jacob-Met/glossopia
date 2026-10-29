import {validateVersion, parse, compose, meaningsEqual} from './language-core.mjs';
import {validateProject} from './project.mjs';

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

// Keep actual parser diagnostics and readings, but omit potentially repetitive
// token derivations: this report compares meanings, not derivation alternatives.
function snapshot(parsed) {
  const result = {};
  for (const key of ['versionId', 'tokens', 'status', 'meaning', 'unknownWords', 'issues']) {
    if (Object.hasOwn(parsed, key)) result[key] = parsed[key];
  }
  result.readings = parsed.readings.map(reading => ({meaning: reading.meaning}));
  return result;
}

/** Compare reuse of saved utterances under a proposed next version.
 * Historical sessions retain their own interpretation. This result neither
 * changes the project nor grants or denies proposal acceptance.
 */
export function analyzePracticeImpact(projectInput, candidateInput) {
  // Validation may freeze normalized history. Clone first so even malformed
  // caller-owned objects cannot be frozen or retained by this analysis.
  const project = validateProject(structuredClone(projectInput));
  const candidate = validateVersion(structuredClone(candidateInput));
  const latest = project.history.at(-1);
  if (candidate.languageId !== latest.languageId) throw new Error('Practice impact requires a candidate from the same language.');
  if (candidate.parentVersionId !== latest.versionId || candidate.number !== latest.number + 1 || project.history.some(version => version.versionId === candidate.versionId)) {
    throw new Error('Practice impact requires a fresh candidate based on the latest accepted version.');
  }

  const summary = {
    sessionCount: project.sessions.length,
    utteranceCount: 0,
    preservedCount: 0,
    changedMeaningCount: 0,
    unresolvedMeaningCount: 0,
    unverifiedOriginalCount: 0,
    affectedCount: 0,
    verifiedEquivalentCount: 0
  };
  // Invocation-local caches: at most 3,000 original input keys, 3,000
  // candidate input keys plus generated equivalents, and 3,000 meanings.
  const originals = new Map(), candidates = new Map(), equivalents = new Map();
  function candidateParse(text) {
    if (!candidates.has(text)) candidates.set(text, snapshot(parse(candidate, text)));
    return candidates.get(text);
  }
  function equivalentFor(original) {
    if (original.status !== 'ok') return {status: 'not_attempted', reason: 'original_intent_unverified'};
    const m = original.meaning, key = JSON.stringify([m.actor, m.verb, m.quantity, m.object]);
    if (!equivalents.has(key)) {
      const composed = compose(candidate, m);
      let equivalent;
      if (composed.status !== 'ok') {
        equivalent = {status: 'unavailable', reason: composed.status, issues: composed.issues};
      } else {
        const roundTrip = candidateParse(composed.text);
        equivalent = roundTrip.status === 'ok' && meaningsEqual(m, roundTrip.meaning)
          ? {status: 'verified', text: composed.text, meaning: roundTrip.meaning}
          : {status: 'unavailable', reason: 'round_trip_unverified', issues: roundTrip.issues};
      }
      equivalents.set(key, equivalent);
    }
    return equivalents.get(key);
  }

  const groups = [];
  for (const language of project.history) {
    const sessions = project.sessions.filter(session => session.versionId === language.versionId);
    if (!sessions.length) continue;
    const group = {versionId: language.versionId, versionNumber: language.number, sessions: []};
    for (const session of sessions) {
      const rows = session.inputs.map((text, inputIndex) => {
        const key = JSON.stringify([language.versionId, text]);
        if (!originals.has(key)) originals.set(key, snapshot(parse(language, text)));
        const original = originals.get(key), proposed = candidateParse(text);
        let classification;
        if (original.status !== 'ok') {
          classification = 'original_intent_unverified'; summary.unverifiedOriginalCount++;
        } else if (proposed.status !== 'ok') {
          classification = 'meaning_unresolved'; summary.unresolvedMeaningCount++;
        } else if (!meaningsEqual(original.meaning, proposed.meaning)) {
          classification = 'meaning_changed'; summary.changedMeaningCount++;
        } else {
          classification = 'meaning_preserved'; summary.preservedCount++;
        }
        const affected = classification === 'meaning_changed' || classification === 'meaning_unresolved';
        const equivalent = equivalentFor(original);
        summary.utteranceCount++;
        if (affected) summary.affectedCount++;
        if (equivalent.status === 'verified') summary.verifiedEquivalentCount++;
        return {sourceVersionId: language.versionId, sessionId: session.id, inputIndex, text, classification, affected, original, candidate: proposed, equivalent};
      });
      group.sessions.push({sessionId: session.id, rows});
    }
    groups.push(group);
  }
  return freeze({candidateVersionId: candidate.versionId, summary, groups});
}
