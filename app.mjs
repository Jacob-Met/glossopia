import {parse, compose, semanticGloss, proposeRevision, acceptRevision} from './src/language-core.mjs';
import {starterLanguage} from './src/starter-language.mjs';
import {replayMission, submitSentence, canPlayMission} from './src/mission-core.mjs';
import {createProject, validateProject, serializeProject, parseProject, addPractice} from './src/project.mjs';

const $ = id => document.getElementById(id);
const storageKey = 'glossopia-project-v1';
let project = createProject(starterLanguage), pending = null, hintVisible = false, inspectedVersionId = null;
let importSelection = 0;
let toastTimer;
let persistence = 'This tab holds your project. Download a copy to keep it.';
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function button(text, action) { const b = node('button', text); b.type = 'button'; b.addEventListener('click', action); return b; }
function tell(message) {
  clearTimeout(toastTimer);
  const toast = $('toast');
  const dismiss = button('Dismiss', () => { clearTimeout(toastTimer); toast.hidden = true; });
  dismiss.setAttribute('aria-label', 'Dismiss notification');
  dismiss.style.color = 'inherit'; dismiss.style.borderColor = 'currentColor'; dismiss.style.marginLeft = '12px';
  toast.replaceChildren(node('span', message), dismiss); toast.hidden = false;
  const hideWhenUnfocused = () => {
    if (toast.contains(document.activeElement)) toastTimer = setTimeout(hideWhenUnfocused, 1000);
    else toast.hidden = true;
  };
  toastTimer = setTimeout(hideWhenUnfocused, 10000);
}
function guarded(action, target = 'toast') {
  try { return action(); } catch (error) {
    if (target === 'toast') tell(error.message);
    else { $(target).textContent = error.message; $(target).hidden = false; }
  }
}
const version = id => project.history.find(item => item.versionId === id);
const current = () => version(project.currentVersionId);
const viewed = () => version(project.viewVersionId);
const session = () => project.sessions.find(item => item.id === project.activeSessionId);
function persist() {
  try { localStorage.setItem(storageKey, serializeProject(project)); persistence = 'Saved in this browser. Download a copy to move or back up your project. Proposal previews stay in this tab only.'; }
  catch { persistence = 'Browser saving is unavailable. Your project is in this tab; download a copy before closing it.'; }
  $('saveState').textContent = persistence;
}
function commit(next) { project = validateProject(next); persist(); render(); }
function showView(name, focus = false) {
  for (const tab of document.querySelectorAll('[data-view]')) {
    const selected = tab.dataset.view === name;
    tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
    $(tab.dataset.view + 'View').hidden = !selected;
    if (selected && focus) tab.focus();
  }
}
function interpretation(result) {
  if (result.status === 'ok') return semanticGloss(result.meaning);
  if (result.status === 'unknown_words') return 'Unknown words: ' + result.unknownWords.join(', ');
  if (result.status === 'ambiguous') return 'Ambiguous: ' + result.readings.map(reading => semanticGloss(reading.meaning ?? reading)).join(' / ');
  return 'Not a sentence under these rules (' + result.status + ').';
}
function startPractice(id) {
  guarded(() => { commit(addPractice(project, id)); hintVisible = false; renderMarket(); showView('market'); $('sentenceInput').focus(); });
}
function renderMarket() {
  const active = session(), language = version(active.versionId), state = replayMission(language, active);
  $('missionHeading').textContent = 'Bring a lantern home.';
  $('missionProgress').textContent = state.complete ? 'Complete' : (state.stage + 1) + ' of 3';
  $('missionGoal').textContent = 'Practicing version ' + language.number + ' · ' + state.goal;
  $('sentenceLabel').textContent = 'What would you say in version ' + language.number + '?';
  $('sentenceFeedback').textContent = state.lastResult?.feedback ?? '';
  $('conversation').replaceChildren(...state.events.map(event => {
    const row = node('div', undefined, 'utterance ' + event.speaker);
    row.append(node('strong', event.speaker === 'merchant' ? 'Trader' : event.speaker === 'player' ? 'You' : 'Practice', 'speaker'), node('p', event.text));
    if ($('showGlosses').checked && event.meaning) row.append(node('small', semanticGloss(event.meaning), 'meaning'));
    if ($('showGlosses').checked && event.status === 'ambiguous') row.append(node('small', interpretation({status: event.status, readings: event.readings}), 'meaning'));
    return row;
  }));
  $('wordBank').replaceChildren(...language.lexicon.map(entry => {
    const b = button(entry.form, () => {
      const input = $('sentenceInput'), next = [input.value.trim(), entry.form].filter(Boolean).join(' ');
      if (next.length > 240) { tell('A sentence supports at most 240 characters.'); return; }
      input.value = next; input.focus();
    });
    if ($('showGlosses').checked) b.append(node('small', entry.gloss));
    b.title = entry.role + ': ' + entry.gloss; return b;
  }));
  const slots = language.grammar.order === 'SOV' ? ['Speaker', 'Quantity', 'Thing', 'Action'] : ['Speaker', 'Action', 'Quantity', 'Thing'];
  $('grammarRibbon').replaceChildren(...slots.map(label => node('span', label)));
  $('grammarDescription').textContent = 'Practice version ' + language.number + ' uses ' + language.grammar.order + ': ' + slots.join(' → ') + '. The quantity comes directly before the thing.';
  const example = language.examples[0] && parse(language, language.examples[0].text);
  $('exampleSentence').replaceChildren(...(example?.readings[0]?.derivations[0] ?? []).map(token => {
    const item = node('span', token.token, 'gloss-token'); item.append(node('small', token.gloss)); return item;
  }));
  $('inventory').replaceChildren(...[['pear', 'pears'], ['lantern', 'lanterns']].map(([key, label]) => {
    const item = node('span'); item.append(node('strong', state.inventory[key]), node('small', label)); return item;
  }));
  $('missionHint').hidden = !hintVisible;
  $('missionHint').textContent = state.expected ? 'Try: ' + compose(language, state.expected).text : 'This conversation is complete. Start a new practice to try again.';
  $('showHint').disabled = state.complete;
}
function renderStudio() {
  const language = viewed(), historical = language.versionId !== project.currentVersionId;
  if (inspectedVersionId !== language.versionId) { $('inspectResult').textContent = ''; inspectedVersionId = language.versionId; }
  $('historicalNotice').hidden = !historical;
  $('historicalNotice').replaceChildren(node('span', 'Inspecting version ' + language.number + '. Proposals must start from the latest accepted version. '), button('Return to latest version', () => commit({...project, viewVersionId: project.currentVersionId})));
  $('wordCount').textContent = language.lexicon.length + ' words · version ' + language.number;
  $('lexiconBody').replaceChildren(...language.lexicon.map(entry => { const row = node('tr'); row.append(node('td', entry.form), node('td', entry.gloss), node('td', entry.role)); return row; }));
  $('acceptedOrder').textContent = 'Displayed version ' + language.number + ' · ' + language.grammar.order;
  $('acceptedGrammar').textContent = language.grammar.rationale;
  $('expressiveScope').textContent = 'Four-token statements: speaker, action, quantity and object in the accepted order. Actions are request, give and have. Naming a new object does not add it to the trader’s stock.';
  const selected = $('renameConcept').value;
  $('renameConcept').replaceChildren(...language.lexicon.map(entry => { const option = node('option', entry.form + ' — ' + entry.gloss); option.value = entry.id; return option; }));
  if (language.lexicon.some(entry => entry.id === selected)) $('renameConcept').value = selected;
  for (const control of $('proposalForm').elements) control.disabled = historical;
  updateProposalFields();
}
function renderHistory() {
  $('versionList').replaceChildren(...project.history.map(language => {
    const card = node('article', undefined, 'version-card' + (language.versionId === project.currentVersionId ? ' current' : ''));
    card.append(node('h2', 'Version ' + language.number + (language.versionId === project.currentVersionId ? ' · Latest accepted' : '')),
      node('p', 'Author: ' + language.author + ' · ' + language.rationale));
    if (language.acceptance) card.append(node('p', 'Accepted locally by ' + language.acceptance.author));
    const actions = node('div', undefined, 'version-actions');
    actions.append(button('Inspect version ' + language.number, () => { commit({...project, viewVersionId: language.versionId}); showView('studio'); }));
    const playable = canPlayMission(language), practice = button('Practice version ' + language.number, () => startPractice(language.versionId));
    practice.disabled = !playable.available; actions.append(practice); card.append(actions);
    if (!playable.available) card.append(node('p', playable.reason));
    return card;
  }));
  $('practiceRecords').replaceChildren(...project.sessions.map(record => {
    const language = version(record.versionId), state = replayMission(language, record), row = node('div', undefined, 'practice-record');
    row.append(button(record.id + ' · version ' + language.number + ' · ' + (state.complete ? 'Complete' : 'Stage ' + (state.stage + 1)), () => {
      hintVisible = false; commit({...project, activeSessionId: record.id}); showView('market');
    }), node('p', record.inputs.length + ' utterances · ' + state.inventory.pear + ' pears · ' + state.inventory.lantern + ' lanterns'));
    return row;
  }));
}
function renderImpact() {
  $('impactPanel').hidden = !pending;
  if (!pending) return;
  const {summary, examples} = pending.impact;
  $('impactTitle').textContent = 'Review version ' + pending.candidate.number;
  $('impactBadge').textContent = summary.unresolved ? 'Needs resolution' : 'Ready for your decision';
  $('impactSummary').textContent = summary.changed + ' examples change; ' + summary.migrationsAvailable + ' can retain their meaning. Acceptance applies only to this local project. Names are self-entered attribution.';
  $('impactProblems').textContent = summary.unresolved ? summary.unresolved + ' examples cannot migrate safely. Accepted state is unchanged.' : 'Accepted state is unchanged until you explicitly accept.';
  const changes = pending.changes.map(change => node('p', change.type === 'grammar_order' ? 'Sentence order: ' + change.from + ' → ' + change.to : change.type === 'word_form' ? 'Word form: ' + change.from + ' → ' + change.to + ' (' + change.meaning + ')' : 'Add object word: ' + change.form + ' = ' + change.meaning));
  $('impactRows').replaceChildren(...changes, ...examples.map(example => {
    const row = node('div', undefined, 'impact-row');
    const before = node('div', example.oldText, 'before'), after = node('div', example.migration.status === 'ok' ? example.migration.text : 'No verified equivalent', 'after');
    before.append(node('small', 'Original: ' + semanticGloss(example.intendedMeaning)));
    after.append(node('small', 'Original text under proposed rules: ' + interpretation(example.after)), node('small', 'Migration: ' + interpretation(example.migration)));
    row.append(before, node('span', '→', 'arrow'), after);
    return row;
  }));
  $('acceptProposal').disabled = summary.unresolved > 0;
}
function render() {
  $('languageName').textContent = current().name;
  $('languageVersion').textContent = 'Latest accepted version ' + current().number + ' · Studio version ' + viewed().number + ' · Practice version ' + version(session().versionId).number;
  $('saveState').textContent = persistence;
  renderMarket(); renderStudio(); renderHistory(); renderImpact();
}

for (const tab of document.querySelectorAll('[data-view]')) {
  tab.addEventListener('click', () => showView(tab.dataset.view));
  tab.addEventListener('keydown', event => {
    const tabs = [...document.querySelectorAll('[data-view]')], index = tabs.indexOf(tab);
    const indexForKey = {ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1};
    if (event.key in indexForKey) { event.preventDefault(); showView(tabs[indexForKey[event.key]].dataset.view, true); }
  });
}
$('sentenceForm').addEventListener('submit', event => { event.preventDefault(); guarded(() => {
  const active = session(), result = submitSentence(version(active.versionId), active, $('sentenceInput').value);
  commit({...project, sessions: project.sessions.map(item => item.id === active.id ? result.session : item)});
  $('sentenceInput').value = ''; $('sentenceInput').focus();
}, 'sentenceFeedback'); });
$('clearSentence').addEventListener('click', () => { $('sentenceInput').value = ''; $('sentenceInput').focus(); });
$('restartMission').textContent = 'Start a new practice';
$('restartMission').addEventListener('click', () => startPractice(session().versionId));
$('showHint').addEventListener('click', () => guarded(() => {
  const active = session(); hintVisible = true;
  commit({...project, sessions: project.sessions.map(item => item.id === active.id ? {...item, hintsUsed: item.hintsUsed + 1} : item)});
}));
$('showGlosses').addEventListener('change', renderMarket);
$('inspectLanguage').addEventListener('click', () => { commit({...project, viewVersionId: session().versionId}); showView('studio'); });
function updateProposalFields() {
  for (const kind of ['order', 'rename', 'add']) {
    const inactive = $('changeKind').value !== kind;
    $(kind + 'Fields').hidden = inactive;
    for (const control of $(kind + 'Fields').querySelectorAll('input,select')) control.disabled = inactive || project.viewVersionId !== project.currentVersionId;
  }
}
$('changeKind').addEventListener('change', updateProposalFields);
for (const id of ['renameForm', 'newWord']) { $(id).maxLength = 20; $(id).pattern = '[A-Za-z]{1,20}'; $(id).title = 'Use 1–20 ASCII letters, without spaces or punctuation.'; }
$('newConcept').pattern = '[a-z][a-z0-9_]{0,39}'; $('newConcept').title = 'Lowercase identifier: start with a letter, then letters, digits or underscores (up to 40 characters).';
for (const option of $('proposedOrder').options) option.textContent = option.value === 'SOV' ? 'Speaker → quantity → thing → action' : 'Speaker → action → quantity → thing';
function invalidatePreview() {
  if (pending) { pending = null; renderImpact(); $('proposalFeedback').textContent = 'Proposal changed. Review the effects again before acceptance.'; }
}
$('proposalForm').addEventListener('input', invalidatePreview);
$('proposalForm').addEventListener('change', invalidatePreview);
$('proposalForm').addEventListener('submit', event => { event.preventDefault(); guarded(() => {
  pending = null; renderImpact();
  if (project.viewVersionId !== project.currentVersionId) throw new Error('Return to the latest accepted version before proposing a change.');
  const id = 'proposal-' + crypto.randomUUID(), author = $('proposalAuthor').value, rationale = $('proposalRationale').value;
  const patch = {id, author, rationale};
  if ($('changeKind').value === 'order') patch.order = $('proposedOrder').value;
  if ($('changeKind').value === 'rename') patch.wordChanges = [{entryId: $('renameConcept').value, form: $('renameForm').value}];
  if ($('changeKind').value === 'add') patch.addEntries = [{id: 'word-' + crypto.randomUUID(), role: 'object', meaning: $('newConcept').value.trim(), form: $('newWord').value, gloss: $('newConcept').value.trim().replaceAll('_', ' '), author, rationale, canonical: true}];
  const proposal = proposeRevision(current(), patch); pending = proposal;
  $('proposalFeedback').textContent = 'Preview only. Review each example before accepting.'; renderImpact();
  $('impactPanel').scrollIntoView({block: 'nearest'});
}, 'proposalFeedback'); });
$('acceptProposal').addEventListener('click', () => guarded(() => {
  if (!pending) throw new Error('Review a proposal first.');
  const history = acceptRevision(project.history, pending, {accept: true, author: pending.patch.author});
  const next = validateProject({...project, history, currentVersionId: history.at(-1).versionId, viewVersionId: history.at(-1).versionId});
  pending = null; commit(next); $('proposalFeedback').textContent = 'Accepted locally. Existing conversations retain their original version. Start a practice from Versions to use the new version.';
}, 'proposalFeedback'));
$('discardProposal').addEventListener('click', () => { pending = null; renderImpact(); $('proposalFeedback').textContent = 'Proposal discarded. Accepted language and practice are unchanged.'; });
$('inspectForm').addEventListener('submit', event => { event.preventDefault(); guarded(() => {
  const result = parse(viewed(), $('inspectInput').value);
  $('inspectResult').replaceChildren(node('p', 'Version ' + viewed().number + ': ' + interpretation(result)));
  for (const [index, reading] of result.readings.entries()) {
    const details = node('div'); details.append(node('strong', 'Reading ' + (index + 1) + ': ' + semanticGloss(reading.meaning)));
    for (const derivation of reading.derivations) {
      const list = node('ul');
      for (const token of derivation) list.append(node('li', token.token + ' → ' + token.role + ': ' + token.gloss + ' (entry ' + token.entryId + ')'));
      details.append(list);
    }
    $('inspectResult').append(details);
  }
}, 'inspectResult'); });
$('saveProject').addEventListener('click', () => guarded(() => {
  const text = serializeProject(project), url = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
  const link = node('a'); link.href = url; link.download = 'glossopia-project.json'; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000); tell('Download requested. Check your browser downloads for the project copy.');
}));
$('openProject').addEventListener('click', () => $('projectFile').click());
$('projectFile').addEventListener('change', async () => {
  const selection = ++importSelection;
  const file = $('projectFile').files[0]; if (!file) return;
  let next;
  try {
    if (file.size > 1000000) throw new Error('Choose a project smaller than 1 MB.');
    next = parseProject(await file.text());
  } catch (error) { if (selection === importSelection) tell('Could not open this file: ' + error.message + ' Your current project is unchanged.'); return; }
  finally { if (selection === importSelection) $('projectFile').value = ''; }
  if (selection !== importSelection) return;
  project = next; pending = null; hintVisible = false; $('sentenceInput').value = ''; $('inspectResult').textContent = ''; $('proposalFeedback').textContent = '';
  guarded(() => { persist(); render(); tell('Project opened. Earlier conversations and accepted versions are available in Versions.'); });
});
try {
  const stored = localStorage.getItem(storageKey);
  if (stored) { project = parseProject(stored); persistence = 'Restored from this browser. Download a copy to back up your project. Proposal previews are not saved.'; }
  else persist();
} catch (error) { persistence = 'Browser storage could not be restored. This tab contains a fresh project; download a copy to keep it. Existing stored data has not been overwritten.'; tell(error.message); }
$('conversation').setAttribute('aria-live', 'off');
showView('market'); render();
