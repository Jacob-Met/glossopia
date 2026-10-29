import {validateVersion} from './language-core.mjs';

function meaningLabel(entry) { return entry.role + ': ' + String(entry.meaning); }
function preference(entry) { return entry.canonical ? 'Preferred form' : 'Not marked preferred'; }
function entryLabel(entry) {
  return entry.form + ' · ' + meaningLabel(entry) + ' · label: ' + entry.gloss + ' · ' + preference(entry);
}

// This comparison covers vocabulary and sentence order, not examples or authorship metadata.
export function compareVersionHistory(previousInput, currentInput) {
  const previous = validateVersion(previousInput), current = validateVersion(currentInput);
  if (previous.languageId !== current.languageId || current.number !== previous.number + 1 ||
      current.parentVersionId !== previous.versionId || current.versionId === previous.versionId) {
    throw new Error('Version history comparison requires adjacent versions of the same language.');
  }
  const changes = [];
  const add = (kind, entryId, before, after) => changes.push({kind, entryId, before, after});
  if (previous.grammar.order !== current.grammar.order) add('order', null, previous.grammar.order, current.grammar.order);
  const beforeById = new Map(previous.lexicon.map(entry => [entry.id, entry]));
  const afterById = new Map(current.lexicon.map(entry => [entry.id, entry]));
  for (const before of previous.lexicon) {
    const after = afterById.get(before.id);
    if (!after) { add('removed', before.id, entryLabel(before), null); continue; }
    if (before.form !== after.form) add('form', before.id, before.form, after.form);
    if (before.role !== after.role || before.meaning !== after.meaning) add('meaning', before.id, meaningLabel(before), meaningLabel(after));
    if (before.gloss !== after.gloss) add('gloss', before.id, before.gloss, after.gloss);
    if (before.canonical !== after.canonical) add('canonical', before.id, preference(before), preference(after));
  }
  for (const after of current.lexicon) {
    if (!beforeById.has(after.id)) add('added', after.id, null, entryLabel(after));
  }
  return {previousVersionId: previous.versionId, currentVersionId: current.versionId, changes};
}
