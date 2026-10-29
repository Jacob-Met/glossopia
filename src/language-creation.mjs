import {LanguageError, validateVersion, compose, parse, meaningsEqual} from './language-core.mjs';
import {starterLanguage} from './starter-language.mjs';
import {analyzeMissionCompatibility} from './mission-core.mjs';

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function require(condition, message) {
  if (!condition) throw new LanguageError('INVALID_CREATION', message);
}
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Construct an original set of forms for the existing fixed practice meanings.
 * Identity is supplied by the caller. This pure constructor neither replaces a
 * project nor writes storage, and never supplies a missing starter word.
 */
export function createLanguage(input) {
  require(record(input), 'Language creation needs an object of authored fields.');
  const draft = structuredClone(input);
  const required = ['languageId', 'name', 'author', 'order', 'forms'];
  require(required.every(key => Object.hasOwn(draft, key)), 'Supply languageId, name, author, order and all ten forms.');
  require(Object.keys(draft).every(key => [...required, 'rationale'].includes(key)), 'Language creation contains an unsupported field.');
  require(typeof draft.languageId === 'string', 'Supply a valid language identity.');
  require(record(draft.forms), 'Supply all ten authored forms by their semantic entry IDs.');
  const ids = starterLanguage.lexicon.map(entry => entry.id);
  require(ids.every(id => Object.hasOwn(draft.forms, id)), 'Every required form must be supplied: ' + ids.filter(id => !Object.hasOwn(draft.forms, id)).join(', ') + '.');
  require(Object.keys(draft.forms).every(id => ids.includes(id)), 'The form map contains an unsupported semantic entry ID.');
  const rationale = Object.hasOwn(draft, 'rationale') ? draft.rationale
    : 'Initial authored forms and chosen sentence order for the application’s fixed market practice meanings.';
  const raw = {
    schemaVersion: 1,
    languageId: draft.languageId,
    versionId: draft.languageId.slice(0, 61) + '-v1',
    number: 1,
    parentVersionId: null,
    name: draft.name,
    author: draft.author,
    rationale,
    grammar: {
      order: draft.order,
      quantityPosition: 'before-object',
      author: draft.author,
      rationale: draft.order === 'SOV'
        ? 'Chosen order: speaker, quantity, thing, action. The quantity directly precedes its object.'
        : 'Chosen order: speaker, action, quantity, thing. The quantity directly precedes its object.'
    },
    lexicon: starterLanguage.lexicon.map(({id, role, meaning, gloss}) => ({
      id, role, meaning, gloss, form: draft.forms[id], author: draft.author,
      rationale, canonical: true
    })),
    examples: []
  };
  const language = validateVersion(raw);
  const examples = starterLanguage.examples.map(({id, meaning, note}) => {
    const composition = compose(language, meaning);
    require(composition.status === 'ok', 'The authored forms cannot generate example ' + id + ' unambiguously (' + composition.status + ').');
    const interpretation = parse(language, composition.text);
    require(interpretation.status === 'ok' && meaningsEqual(interpretation.meaning, meaning), 'Generated example ' + id + ' did not preserve its required meaning.');
    return {id, text: composition.text, meaning: structuredClone(meaning), note};
  });
  const completed = validateVersion({...language, examples});
  const compatibility = analyzeMissionCompatibility(completed);
  require(compatibility.available, 'The current mission engine cannot generate these required statements with the authored forms: ' + compatibility.statements.filter(statement => !statement.available).map(statement => statement.id + ' (' + statement.composition.status + ')').join(', ') + '.');
  return freeze(completed);
}
