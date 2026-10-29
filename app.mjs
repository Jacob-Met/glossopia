import {parse, compose, semanticGloss, proposeRevision, acceptRevision} from './src/language-core.mjs';
import {starterLanguage} from './src/starter-language.mjs';
import {replayMission, submitSentence, canPlayMission, analyzeMissionCompatibility} from './src/mission-core.mjs';
import {createProject, validateProject, serializeProject, parseProject, addPractice} from './src/project.mjs';
import {analyzePracticeImpact} from './src/practice-impact.mjs';
import {analyzeWordOrder} from './src/word-order.mjs';

const $ = id => document.getElementById(id);
const storageKey = 'glossopia-project-v1';
let project = createProject(starterLanguage), pending = null, hintVisible = false, inspectedVersionId = null;
let importSelection = 0, importWorkRevision = 0;
// An Open may replace only the work that existed when its file was selected.
function noteWork() { importWorkRevision++; }
function canFinishOpen(selection, revision) {
  if (selection !== importSelection) return false;
  if (revision !== importWorkRevision) {
    tell('Open skipped because you made changes. Your work is kept. Select the file again to replace this project.');
    return false;
  }
  return true;
}
let toastTimer;
let practiceImpactCache = null, practiceImpactPage = 0;
let missionCompatibilityCache = null;
let wordOrderHelp = null;
const practiceImpactPageSize = 12;
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
function commit(next) { project = validateProject(next); noteWork(); clearWordOrderHelp(); persist(); render(); }
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
function clearWordOrderHelp() {
  wordOrderHelp = null;
  const panel = $('wordOrderHelp'); panel.hidden = true;
  for (const key of ['sessionId', 'versionId', 'status']) delete panel.dataset[key];
  for (const id of ['wordOrderTitle', 'wordOrderRule', 'wordOrderOriginal', 'wordOrderMessage', 'wordOrderSentence', 'wordOrderMeaning']) $(id).textContent = '';
  $('wordOrderTokens').replaceChildren(); $('wordOrderSuggestion').hidden = true; $('applyWordOrder').disabled = true;
}
function renderWordOrderHelp() {
  const context = wordOrderHelp, active = session();
  if (!context || context.project !== project || context.sessionId !== active.id || context.versionId !== active.versionId || $('sentenceInput').value !== '') { clearWordOrderHelp(); return; }
  const language = version(active.versionId), report = context.report, suggested = report?.status === 'suggested';
  const labels = {actor: 'Speaker', verb: 'Action', quantity: 'Quantity', object: 'Thing'};
  const roles = report?.expectedRoles ?? (language.grammar.order === 'SOV' ? ['actor', 'quantity', 'object', 'verb'] : ['actor', 'verb', 'quantity', 'object']);
  const panel = $('wordOrderHelp'); panel.hidden = false;
  panel.dataset.sessionId = active.id; panel.dataset.versionId = language.versionId; panel.dataset.status = report?.status ?? 'unavailable';
  $('wordOrderTitle').textContent = suggested ? 'Your words can follow this order.' : 'Check the roles of these words.';
  $('wordOrderRule').textContent = 'Practice version ' + language.number + ' · ' + language.grammar.order + ': ' + roles.map(role => labels[role]).join(' → ') + '.';
  $('wordOrderOriginal').textContent = context.text;
  $('wordOrderSuggestion').hidden = !suggested; $('applyWordOrder').disabled = !suggested;
  $('wordOrderTokens').replaceChildren(); $('wordOrderSentence').textContent = ''; $('wordOrderMeaning').textContent = '';
  if (suggested) {
    $('wordOrderMessage').textContent = 'These same words can express one unambiguous meaning.';
    $('wordOrderSentence').textContent = report.suggestion.text;
    const showMeanings = $('showGlosses').checked;
    $('wordOrderMeaning').hidden = !showMeanings;
    $('wordOrderMeaning').textContent = 'Meaning: ' + semanticGloss(report.suggestion.meaning);
    $('wordOrderTokens').replaceChildren(...report.suggestion.interpretation.readings[0].derivations[0].map(token => {
      const item = node('div', undefined, 'word-order-token'); item.dataset.role = token.role; item.dataset.entryId = token.entryId;
      item.append(node('strong', token.token), node('small', labels[token.role] + (showMeanings ? ' · ' + token.gloss : ''))); return item;
    }));
  } else if (report?.status === 'ambiguous_rearrangement') {
    $('wordOrderMessage').textContent = 'Rearranging these words can produce ' + report.meaningCount + ' meanings. Choose words that make your meaning unambiguous.';
  } else if (report?.status === 'no_rearrangement') {
    $('wordOrderMessage').textContent = 'These words cannot fill all four sentence roles in this version. Use the word bank to choose another word.';
  } else {
    $('wordOrderMessage').textContent = 'Word order help is unavailable for this sentence. Your submitted words remain in this conversation.';
  }
}
function offerWordOrderHelp(language, text) {
  let report;
  try {
    report = analyzeWordOrder(language, text);
    if (!['suggested', 'ambiguous_rearrangement', 'no_rearrangement'].includes(report.status)) return;
  } catch { report = null; }
  const active = session();
  wordOrderHelp = {project, sessionId: active.id, versionId: active.versionId, text, report};
  renderWordOrderHelp();
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
      noteWork(); clearWordOrderHelp(); input.value = next; input.focus();
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
  renderWordOrderHelp();
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
function clearMissionCompatibility() {
  missionCompatibilityCache = null;
  const panel = $('missionCompatibility'); panel.hidden = true;
  for (const key of ['currentVersionId', 'proposedVersionId', 'analysis']) delete panel.dataset[key];
  for (const id of ['missionCurrentStatus', 'missionProposedStatus']) {
    const status = $(id); status.replaceChildren();
    delete status.dataset.available; delete status.dataset.versionId;
  }
  const summary = $('missionCompatibilitySummary'); summary.textContent = '';
  for (const key of ['currentReadyCount', 'proposedReadyCount', 'requiredCount']) delete summary.dataset[key];
  $('missionCompatibilityConsequence').textContent = '';
  $('missionCompatibilityRows').replaceChildren();
}
function missionCompositionCell(statement, side, language) {
  const result = statement.composition, cell = node('div', undefined, 'mission-composition');
  cell.dataset.side = side; cell.dataset.status = result.status;
  cell.append(node('small', (side === 'current' ? 'Current' : 'Proposed') + ' · version ' + language.number, 'mission-cell-version'));
  const labels = {ok: 'Verified statement', ambiguous: 'Ambiguous selected wording', choice_required: 'Preferred word choice needed', unexpressible: 'Required wording unavailable'};
  cell.append(node('strong', labels[result.status] ?? 'Generation unavailable', 'mission-cell-status'));
  if (result.text) cell.append(node('code', result.text, 'mission-expression'));
  if (result.status === 'ambiguous') {
    cell.append(node('p', 'The selected wording does not resolve to this one meaning. Another accepted synonym may still work; this check does not choose it.', 'mission-cell-detail'));
  } else if (result.status !== 'ok') {
    const roleNames = {actor: 'speaker', verb: 'action', quantity: 'quantity', object: 'thing'};
    const explanations = result.issues.map(issue => {
      if (issue.code === 'NO_ACCEPTED_WORD') return 'No accepted word for ' + (roleNames[issue.role] ?? issue.role) + ' “' + String(issue.meaning).replaceAll('_', ' ') + '”.';
      if (issue.code === 'FORM_CHOICE_REQUIRED') return 'Several accepted forms need a preferred choice for the ' + (roleNames[issue.role] ?? issue.role) + '.';
      return 'The market cannot generate this required statement with the current word choices.';
    });
    cell.append(node('p', explanations.join(' ') || 'No verified generated wording is available.', 'mission-cell-detail'));
  }
  return cell;
}
function renderMissionCompatibility() {
  if (!pending) { clearMissionCompatibility(); return; }
  const panel = $('missionCompatibility');
  try {
    if (missionCompatibilityCache?.proposal !== pending || missionCompatibilityCache?.project !== project) {
      missionCompatibilityCache = {proposal: pending, project, current: analyzeMissionCompatibility(current()), proposed: analyzeMissionCompatibility(pending.candidate)};
    }
    const before = missionCompatibilityCache.current, after = missionCompatibilityCache.proposed;
    const currentLanguage = current(), proposedLanguage = pending.candidate;
    panel.hidden = false; panel.dataset.analysis = 'complete';
    panel.dataset.currentVersionId = before.versionId; panel.dataset.proposedVersionId = after.versionId;
    for (const [id, label, report, language] of [['missionCurrentStatus', 'Current', before, currentLanguage], ['missionProposedStatus', 'Proposed', after, proposedLanguage]]) {
      const status = $(id); status.dataset.available = String(report.available); status.dataset.versionId = report.versionId;
      status.replaceChildren(node('small', label + ' · version ' + language.number), node('strong', report.available ? 'New practice available' : 'New practice unavailable'));
    }
    const summary = $('missionCompatibilitySummary');
    summary.dataset.currentReadyCount = String(before.summary.readyCount); summary.dataset.proposedReadyCount = String(after.summary.readyCount); summary.dataset.requiredCount = String(after.summary.requiredCount);
    summary.textContent = 'Current: ' + before.summary.readyCount + ' of ' + before.summary.requiredCount + ' required statements verified. Proposed: ' + after.summary.readyCount + ' of ' + after.summary.requiredCount + '.';
    $('missionCompatibilityConsequence').textContent = after.available
      ? (before.available ? 'New practice remains available under the proposal.' : 'This proposal restores new practice with its selected words.')
      : (before.available ? 'This proposal would make new practice on version ' + proposedLanguage.number + ' unavailable.' : 'The current version already has unavailable statements. New practice would still be unavailable under this proposal.');
    const proposedById = new Map(after.statements.map(statement => [statement.id, statement]));
    const rows = before.statements.map(statement => {
      const proposed = proposedById.get(statement.id);
      if (!proposed) throw new Error('A required market statement is missing from the comparison.');
      const row = node('article', undefined, 'mission-compatibility-row'); row.dataset.statementId = statement.id;
      const heading = node('div', undefined, 'mission-statement-heading');
      heading.append(node('span', statement.speaker === 'player' ? 'YOU' : 'TRADER', 'eyebrow'), node('h4', statement.purpose), node('p', semanticGloss(statement.meaning), 'mission-meaning'));
      const comparison = node('div', undefined, 'mission-statement-comparison');
      comparison.append(missionCompositionCell(statement, 'current', currentLanguage), missionCompositionCell(proposed, 'proposed', proposedLanguage));
      row.append(heading, comparison); return row;
    });
    $('missionCompatibilityRows').replaceChildren(...rows);
  } catch (error) {
    clearMissionCompatibility(); panel.hidden = false; panel.dataset.analysis = 'unavailable';
    $('missionCompatibilitySummary').textContent = 'Market practice could not be checked for this preview.';
    $('missionCompatibilityConsequence').textContent = 'The authored-example checks and your explicit acceptance still apply.';
    $('missionCompatibilityRows').append(node('p', error.message, 'body-copy'));
  }
}
function renderPracticeImpact() {
  if (!pending) {
    practiceImpactCache = null; practiceImpactPage = 0;
    $('practiceImpactRows').replaceChildren();
    return;
  }
  try {
    if (practiceImpactCache?.proposal !== pending || practiceImpactCache?.project !== project) {
      if (practiceImpactCache?.proposal !== pending) $('practiceImpactFilter').value = 'affected';
      practiceImpactCache = {proposal: pending, project, report: analyzePracticeImpact(project, pending.candidate)};
      practiceImpactPage = 0;
    }
    const report = practiceImpactCache.report, summary = report.summary;
    const rows = report.groups.flatMap(group => group.sessions.flatMap(record => record.rows.map(row => ({...row, sourceVersionNumber: group.versionNumber}))));
    $('practiceImpactSummary').textContent = summary.utteranceCount + ' saved utterances across ' + summary.sessionCount + ' conversations: ' + summary.affectedCount + ' meanings affected, ' + summary.preservedCount + ' preserved, and ' + summary.unverifiedOriginalCount + ' original meanings unverified.';
    const filter = $('practiceImpactFilter'); filter.disabled = false;
    const visible = rows.filter(row => filter.value === 'all' || (filter.value === 'unverified' ? row.classification === 'original_intent_unverified' : row.affected));
    practiceImpactPage = Math.min(practiceImpactPage, Math.max(0, Math.ceil(visible.length / practiceImpactPageSize) - 1));
    const first = practiceImpactPage * practiceImpactPageSize, page = visible.slice(first, first + practiceImpactPageSize);
    $('practiceImpactRange').textContent = visible.length ? 'Showing ' + (first + 1) + '–' + (first + page.length) + ' of ' + visible.length + ' utterances in this view.' : 'No utterances in this view.';
    $('practiceImpactPrevious').disabled = practiceImpactPage === 0;
    $('practiceImpactNext').disabled = first + page.length >= visible.length;
    const labels = {meaning_preserved: 'Meaning preserved', meaning_changed: 'Meaning changes', meaning_unresolved: 'Meaning no longer resolved', original_intent_unverified: 'Original intent unverified'};
    const cards = page.map(row => {
      const card = node('article', undefined, 'practice-impact-item');
      card.dataset.sessionId = row.sessionId; card.dataset.inputIndex = String(row.inputIndex);
      card.dataset.sourceVersionId = row.sourceVersionId; card.dataset.classification = row.classification;
      const heading = node('div', undefined, 'practice-impact-heading');
      heading.append(node('h4', row.sessionId + ' · version ' + row.sourceVersionNumber + ' · utterance ' + (row.inputIndex + 1)), node('span', labels[row.classification], 'practice-impact-label'));
      card.append(heading, node('p', row.text, 'practice-impact-words'));
      const comparison = node('dl', undefined, 'practice-impact-comparison');
      for (const [label, result] of [['Originally, in version ' + row.sourceVersionNumber, row.original], ['Same words under the proposal', row.candidate]]) {
        const cell = node('div'); cell.append(node('dt', label), node('dd', interpretation(result))); comparison.append(cell);
      }
      card.append(comparison);
      const equivalent = node('p', undefined, 'practice-impact-equivalent');
      if (row.equivalent.status === 'verified') {
        equivalent.append(node('strong', 'Verified wording under the proposal: '), node('code', row.equivalent.text));
      } else if (row.original.status !== 'ok') {
        equivalent.textContent = 'Original intent was not established, so no equivalent is inferred.';
      } else {
        equivalent.textContent = 'No verified equivalent is available under the proposed rules.';
      }
      const open = button('Open original conversation', () => guarded(() => {
        hintVisible = false; commit({...project, activeSessionId: row.sessionId}); showView('market');
        $('missionHeading').tabIndex = -1; $('missionHeading').focus(); $('missionHeading').scrollIntoView({block: 'nearest'});
      }));
      open.dataset.openPractice = row.sessionId;
      open.setAttribute('aria-label', 'Open original conversation ' + row.sessionId + ', language version ' + row.sourceVersionNumber);
      card.append(equivalent, open); return card;
    });
    if (!cards.length) cards.push(node('p', summary.utteranceCount === 0 ? 'There are no saved utterances yet. Practice with an accepted version to compare your own sentences here.' : filter.value === 'affected' ? 'No verified original meaning changes in this comparison. Use the filter to inspect unverified originals or all saved utterances.' : 'There are no saved utterances in this category.', 'body-copy'));
    $('practiceImpactRows').replaceChildren(...cards);
  } catch (error) {
    practiceImpactCache = null;
    $('practiceImpactSummary').textContent = 'Saved practice comparison is unavailable. The authored-example review above still applies.';
    $('practiceImpactRange').textContent = '';
    $('practiceImpactRows').replaceChildren(node('p', error.message, 'body-copy'));
    $('practiceImpactFilter').disabled = true; $('practiceImpactPrevious').disabled = true; $('practiceImpactNext').disabled = true;
  }
}
function renderImpact() {
  $('impactPanel').hidden = !pending;
  if (!pending) { renderMissionCompatibility(); renderPracticeImpact(); return; }
  const {summary, examples} = pending.impact;
  $('impactTitle').textContent = 'Review version ' + pending.candidate.number;
  $('impactBadge').textContent = summary.unresolved ? 'Needs resolution' : 'Ready for your decision';
  $('impactSummary').textContent = summary.changed + ' authored examples change; ' + summary.migrationsAvailable + ' can retain their meaning. Acceptance applies only to this local project. Names are self-entered attribution.';
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
  renderMissionCompatibility(); renderPracticeImpact();
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
  const active = session(), language = version(active.versionId), text = $('sentenceInput').value;
  const result = submitSentence(language, active, text);
  commit({...project, sessions: project.sessions.map(item => item.id === active.id ? result.session : item)});
  $('sentenceInput').value = '';
  if (result.state.lastResult?.status === 'invalid_syntax') offerWordOrderHelp(language, text);
  $('sentenceInput').focus();
}, 'sentenceFeedback'); });
$('sentenceInput').addEventListener('input', () => { noteWork(); clearWordOrderHelp(); });
$('clearSentence').addEventListener('click', () => { if ($('sentenceInput').value || wordOrderHelp) noteWork(); clearWordOrderHelp(); $('sentenceInput').value = ''; $('sentenceInput').focus(); });
$('applyWordOrder').addEventListener('click', () => {
  const context = wordOrderHelp, active = session();
  if (!context || context.project !== project || context.sessionId !== active.id || context.versionId !== active.versionId || $('sentenceInput').value !== '' || context.report?.status !== 'suggested') { clearWordOrderHelp(); return; }
  noteWork(); $('sentenceInput').value = context.report.suggestion.text;
  clearWordOrderHelp(); $('sentenceInput').focus();
});
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
$('practiceImpactFilter').addEventListener('change', () => { practiceImpactPage = 0; renderPracticeImpact(); });
$('practiceImpactPrevious').addEventListener('click', () => { practiceImpactPage = Math.max(0, practiceImpactPage - 1); renderPracticeImpact(); });
$('practiceImpactNext').addEventListener('click', () => { practiceImpactPage++; renderPracticeImpact(); });
for (const id of ['renameForm', 'newWord']) { $(id).maxLength = 20; $(id).pattern = '[A-Za-z]{1,20}'; $(id).title = 'Use 1–20 ASCII letters, without spaces or punctuation.'; }
$('newConcept').pattern = '[a-z][a-z0-9_]{0,39}'; $('newConcept').title = 'Lowercase identifier: start with a letter, then letters, digits or underscores (up to 40 characters).';
for (const option of $('proposedOrder').options) option.textContent = option.value === 'SOV' ? 'Speaker → quantity → thing → action' : 'Speaker → action → quantity → thing';
function invalidatePreview() {
  noteWork();
  if (pending) { pending = null; renderImpact(); $('proposalFeedback').textContent = 'Proposal changed. Review the effects again before acceptance.'; }
}
$('proposalForm').addEventListener('input', invalidatePreview);
$('proposalForm').addEventListener('change', invalidatePreview);
$('proposalForm').addEventListener('submit', event => { event.preventDefault(); guarded(() => {
  if (pending) noteWork();
  pending = null; renderImpact();
  if (project.viewVersionId !== project.currentVersionId) throw new Error('Return to the latest accepted version before proposing a change.');
  const id = 'proposal-' + crypto.randomUUID(), author = $('proposalAuthor').value, rationale = $('proposalRationale').value;
  const patch = {id, author, rationale};
  if ($('changeKind').value === 'order') patch.order = $('proposedOrder').value;
  if ($('changeKind').value === 'rename') patch.wordChanges = [{entryId: $('renameConcept').value, form: $('renameForm').value}];
  if ($('changeKind').value === 'add') patch.addEntries = [{id: 'word-' + crypto.randomUUID(), role: 'object', meaning: $('newConcept').value.trim(), form: $('newWord').value, gloss: $('newConcept').value.trim().replaceAll('_', ' '), author, rationale, canonical: true}];
  const proposal = proposeRevision(current(), patch); pending = proposal; noteWork();
  $('proposalFeedback').textContent = 'Preview only. Review the authored examples, market readiness and saved practice effects before accepting.'; renderImpact();
  $('impactPanel').scrollIntoView({block: 'nearest'});
}, 'proposalFeedback'); });
$('acceptProposal').addEventListener('click', () => guarded(() => {
  if (!pending) throw new Error('Review a proposal first.');
  const history = acceptRevision(project.history, pending, {accept: true, author: pending.patch.author});
  const next = validateProject({...project, history, currentVersionId: history.at(-1).versionId, viewVersionId: history.at(-1).versionId});
  pending = null; commit(next);
  const playable = canPlayMission(current());
  $('proposalFeedback').textContent = 'Accepted locally. Existing conversations retain their original version. ' + (playable.available ? 'Start a practice from Versions to use the new version.' : 'New practice is unavailable with this version’s current word choices. You can use an earlier version in Versions.');
}, 'proposalFeedback'));
$('discardProposal').addEventListener('click', () => { if (pending) noteWork(); pending = null; renderImpact(); $('proposalFeedback').textContent = 'Proposal discarded. Accepted language and practice are unchanged.'; });
$('inspectInput').addEventListener('input', noteWork);
$('inspectForm').addEventListener('submit', event => { event.preventDefault(); guarded(() => {
  const result = parse(viewed(), $('inspectInput').value); noteWork();
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
  const file = $('projectFile').files[0]; if (!file) return;
  const selection = ++importSelection, revision = importWorkRevision;
  let next;
  try {
    if (file.size > 1000000) throw new Error('Choose a project smaller than 1 MB.');
    next = parseProject(await file.text());
  } catch (error) { if (canFinishOpen(selection, revision)) tell('Could not open this file: ' + error.message + ' Your current project is unchanged.'); return; }
  finally { if (selection === importSelection) $('projectFile').value = ''; }
  if (!canFinishOpen(selection, revision)) return;
  project = next; noteWork(); pending = null; hintVisible = false; clearWordOrderHelp(); $('sentenceInput').value = ''; $('inspectResult').textContent = ''; $('proposalFeedback').textContent = '';
  guarded(() => { persist(); render(); tell('Project opened. Earlier conversations and accepted versions are available in Versions.'); });
});
try {
  const stored = localStorage.getItem(storageKey);
  if (stored) { project = parseProject(stored); persistence = 'Restored from this browser. Download a copy to back up your project. Proposal previews are not saved.'; }
  else persist();
} catch (error) { persistence = 'Browser storage could not be restored. This tab contains a fresh project; download a copy to keep it. Existing stored data has not been overwritten.'; tell(error.message); }
$('conversation').setAttribute('aria-live', 'off');
showView('market'); render();
