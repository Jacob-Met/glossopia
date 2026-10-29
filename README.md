# GLOSSOPIA — local experimental receiving build

GLOSSOPIA is an invented-language studio with an authored fixed-price trading mission. Version 0.5.0 adds creation of a named language you can play, with local snapshots for retaining projects when switching. It builds on market compatibility, word-order help and saved-practice review while preserving the existing parser, fixed-price mission and version history. It also preserves version 0.4.1 protection of newer work while a project file is opening.

## Run

Use Node.js 20 or newer. No dependency installation is needed.

```sh
npm start
```

Open http://127.0.0.1:4183 in a modern browser. The server binds only to loopback. Set the PORT environment variable if that port is in use. Stop it with Ctrl+C.

```sh
npm test
```

The maintained test command checks mission inventory and failure behavior, immutable histories, proposal validation, project roundtrip, bounded version identifiers, saved-practice impact semantics and word-order suggestion safety. Browser receiving is recorded separately; passing these core tests alone does not establish a working UI.

## Use

In Market, use the accepted word bank to request one lantern, give exactly two pears, and confirm possession. Unknown, ambiguous and out-of-order expressions do not authorize an exchange. Glosses and hints come from the active conversation's language version.

In Language studio, inspect words and token derivations, preview a sentence-order or vocabulary change, review the affected examples, then explicitly accept or discard. Acceptance is local, with self-entered attribution. Editing a pending proposal requires a fresh preview.

In Versions, inspect earlier language versions, reopen earlier conversations or start a fresh practice. Existing conversations retain their original version. The header distinguishes latest accepted language, displayed studio language and practice language.

Use Save a copy to download the full validated project JSON. Open reopens such a file. Malformed replacements retain the current project. The browser may also retain a local copy; the interface reports storage failures. Downloaded copies are the portable backup.

## Create a language and play it

Name your language, enter your author attribution, choose SOV or SVO, and supply ten word forms: I, you, request, give, have, lantern, pear, one, two and three. Forms use 1–20 ASCII letters. Review the normalized words and actual generated examples before explicitly creating the project. Missing or ambiguous required forms are rejected; the app does not silently fill them with Luma words. Reusing a form across different roles is allowed when the required expressions remain unambiguous.

Creation produces a new language identity and version 1 with your supplied attribution, plus an empty practice conversation. Its six examples are generated and reparsed using your language. The exercise still exchanges two pears for one lantern. Your attribution describes your word forms and selected grammar order; the application supplies the fixed meanings, engine and mission. It is self-entered attribution, not identity verification.

Opening or cancelling a creation draft, or submitting invalid fields, does not replace accepted project data. A successful switch clears transient proposal/input help; those drafts are not part of saved project snapshots. You can export the reviewed new project even if local storage prevents switching.

## Local project snapshots

Before switching, the app retains a validated snapshot of the current accepted project in a separate browser-local archive. Snapshots include accepted language history and saved conversations, and can be reopened or exported. Reopening uses the same retention process for the project you are leaving. Exactly equal accepted project snapshots are deduplicated; changed saved content is retained separately.

The archive supports at most 100 snapshots and 10 MB of serialized archive data. Your browser’s quota may be smaller. There is no deletion interface in this version. If retention or active-project saving fails, the current project remains active; export the reviewed new project instead. An active-save failure may leave an additional harmless snapshot of the current project. Malformed archive data is not overwritten.

Snapshots are local to this browser storage, not a cloud backup. Use exported project files for portable copies. A download request does not prove that a file was saved. Clearing browser data can remove local snapshots. Changes detected in the active storage value or archive cause switching to stop, but independent tabs are not transactionally fenced: this is not a distributed or concurrent-editing system.

## Verification of version 0.5.0

This candidate composes language creation with version 0.4.1 Open protection from commit `320b81e4c612bdab75d2766e99ec4e912d54d937`. Qualification of this exact composed source is pending. The results below belong only to the earlier pre-composition source/build and must not be treated as qualification of this candidate.

The pre-composition version 0.5 source qualification passed all 42 maintained tests across nine files and the independent repeated-token adversarial receiver. The initial qualification command completed those checks but its browser step failed before launch because the source directory was passed as an argument instead of through SOURCE_DIR. That failed invocation is retained. A distinct corrected browser command using explicit SOURCE_DIR passed all seven scenarios with no recorded browser errors. These native results were executed and reported by the receiving lead.

The maintained/adversarial command was `estate-6653e323-language-creation-source-qualification-20261029-01`; corrected browser command `estate-6653e323-language-creation-source-browser-20261029-02` ran at 2026-10-29 16:13:13–16:13:34 UTC. The earlier pre-composition Linux package also passed its receiving checks; those results apply only to its recorded artifact. New source, package and platform qualification must identify the composed artifact. Version 0.4 and earlier results below retain their historical scope.

## Check market compatibility before accepting a proposal

A language proposal can preserve the authored examples and saved utterances yet prevent a fresh market practice from starting. Compatibility review checks the current exercise’s five required statements: your lantern request, two-pear payment and confirmation, plus the trader’s price and receipt statements.

The result describes whether the current market engine can generate all five statements unambiguously using its existing word-selection rules. A failure may mean a missing word, an unresolved choice among accepted forms, or ambiguity in the selected expression. It does not prove that the language cannot express the meaning: another accepted synonym may work even when the engine’s preferred form does not.

This information supports your decision without adding an acceptance restriction. It does not change the fixed price, stock, inventory transfers or mission progression. Existing conversations remain attached to their historical versions. A compatible result does not guarantee that every sentence you might enter is understood or that you will complete the exchange.

## Verification of version 0.4.0

Source qualification completed successfully on Coordinator3 at 2026-10-29 15:41:37 UTC with Node.js 22.23.4, npm 10.9.9 and Chrome 156.0.8078.47. All 27 maintained tests across seven files, the independent form-choice adversarial receiver, five equivalence cases against the frozen version 0.3 implementation, and five actual-browser checks passed with no recorded browser errors. The receiving lead executed and reported these native results.

Package and Mac receiving are separate exact-artifact checks; no result for those stages is claimed here. Earlier results below retain their original version scope.

## Keep working while a file opens

Open reads and validates your selected file before replacing the current project. If you continue working while that read is pending, the app keeps your later practice, accepted revisions, sentence or proposal drafts, and inspection results. A notice explains that Open was skipped. Select the file again if you still want to replace the project.

A newly selected file supersedes every earlier selection, even when the newer file is invalid. Cancelling a file chooser without selecting a file leaves an earlier pending Open alone. Merely changing tabs does not cancel Open. Work that predates file selection is still replaced when a valid Open finishes normally.

The regression receiver uses controlled asynchronous file reads in a real browser. To run it, make Playwright available to Node (or set GLOSSOPIA_PLAYWRIGHT to its module path), then run `npm run test:browser`. GLOSSOPIA_CHROME can select an existing Chrome executable, and GLOSSOPIA_EVIDENCE selects the output directory. The browser receiver is optional development tooling; starting the app and running `npm test` still require no dependency installation.

## Recover from a word-order error

After you submit four accepted words in an invalid role order, practice can show how those same words fit its sentence pattern. The help uses the active conversation’s pinned language version, which may differ from the latest accepted version or the version displayed in the studio. It shows that version’s role order and labels suggested tokens with roles from the actual parser interpretation. The gloss toggle controls the additional meaning labels.

A suggestion is offered only when all valid rearrangements of those words support one meaning and a suggested expression parses unambiguously. The helper checks every distinct ordering, up to 24, including the meanings of ambiguous parses. It keeps your words and synonyms, applying the parser’s normal case, whitespace and terminal-period normalization. It does not replace them with a canonical mission answer or infer what you intended.

**Use this order** only fills the sentence input. Review it, then press **Say it** to submit. Filling the input does not add a conversation turn, advance the mission or transfer inventory. Your original unsuccessful submission remains in the conversation. A grammatical suggestion can still be off goal; normal mission checks apply when you submit it.

Unknown words, already valid or ambiguous sentences, unsupported token counts and malformed input are not automatically repaired. When rearrangements allow different meanings, no suggestion is offered. When the words cannot fill all four roles, the help asks you to choose words from the word bank.

Help is transient and is not saved or exported. Editing or clearing the input, adding a word from the bank, switching conversations or changing the project clears it. The apply action also checks the project, conversation, language version and empty input before filling, so an obsolete suggestion cannot overwrite new typing. Reopening a project does not restore an old help panel.

## Verification of version 0.3.0

Source qualification completed successfully on Linux with Node.js 22.23.4, npm 10.9.9 and Chrome 156.0.8078.47. All 20 maintained tests across six files, the independent cross-role adversarial receiver and six actual-browser checks passed, with no recorded browser errors. The browser checks include equality of persisted storage before and after applying a suggestion, verifying that Apply fills the input without a persisted project mutation.

Package and platform receiving are recorded separately in each release’s exact-artifact reports. Source qualification does not establish those receiving results. Version 0.2.0 results below remain historical evidence for that earlier feature.

## Review changes against your saved practice

A proposal preview also compares the sentences you have saved in practice conversations with the proposed language rules. This can reveal a change that the authored examples do not cover: a word you used may become unknown or ambiguous, or the same sentence may acquire a different meaning.

Each saved sentence is interpreted first using the accepted language version of its original conversation. The preview then shows what that same text means under the proposal. Where the original sentence has one clear meaning, the report may offer an equivalent expression in the proposed language; an equivalent is shown as verified only when it parses back to that original meaning.

Repeated sentences remain separate saved occurrences. Report totals describe all saved occurrences, even when the interface shows only a page of results.

Use the Show menu to switch between Changed or unresolved meanings, Original meaning unverified, and All saved utterances; Open original conversation returns to the preserved conversation in its original language version.

The report compares interpretations supported by the language rules. It cannot recover what a person intended when their original sentence was unknown, invalid or ambiguous. Such sentences are marked as unverified rather than treated as successfully preserved or automatically repaired.

Reviewing this report does not rewrite saved conversations, migrate their inputs or change their outcomes. Existing conversations keep their original language version. Accepting a proposal still uses the normal explicit acceptance checks; the saved-practice report provides additional information for that decision.

## Verification of version 0.2.0

Source qualification executed through Renpō passed all 11 maintained tests across five test files, an independent semantic regression, and six actual-browser checks with no recorded browser errors. The independent semantic regression covers ambiguous equivalent expressions, changed meanings despite successful parsing, foreign-language rejection and unchanged input state.

A separate maximum-volume helper receiver verified all 3,000 saved occurrences from 30 conversations of 100 inputs each, including exact occurrence references and unchanged inputs. Its measured analysis time was approximately 65.08 ms in that run; this is an observation, not a performance guarantee. Expected totals matched: 750 preserved, 1,500 unresolved under the proposal, 750 originally unverified and 2,250 verified equivalents. That helper result establishes complete report data, not DOM pagination behavior.

These are source-check results. Package and platform qualification are recorded separately in each release's receiving reports, alongside the exact downloaded artifact identity.

## Scope and limits

- This is an authored fixed-price exercise, not bargaining or a live community.
- Supported statements have one speaker, one action (request/give/have), one quantity and one object in SOV or SVO order. Words use 1–20 ASCII letters.
- Naming a new object does not make the trader stock it.
- Project bounds are 100 accepted versions, 30 conversations, 100 utterances per conversation and a 1 MB portable file.
- NVIDIA-assisted proposals through Nebius have not been configured or verified. No model contribution or provider benefit is claimed.
- Uninvolved newcomer comprehension and creative/linguistic quality remain human evaluation dependencies.
- This private experimental build preserves original project ownership and source contributions. Each release records its exact source and integration state; running locally does not constitute internet deployment.

## Provenance

Original project: https://github.com/Jacob-Met/glossopia/issues/1
Original contributor: estate-b79ee09d97e1 and its retained team.
Original uncommitted source snapshot SHA-256: 4e9c453985c37f67f46fbe94f9830d6224d0e99e5ea981f0b9f7631d016f6750.
Receiving contributor: estate-6653e323ca46-20261029 and retained internal reviewers.
Original receiving work record: glossopia-existing-project-reconciliation-20261029.
Version 0.2.0 work record: glossopia-saved-practice-impact-6653e323.
Version 0.3.0 work record: glossopia-word-order-recovery-6653e323.
Version 0.4 native work record: https://github.com/Jacob-Met/glossopia/issues/1#issuecomment-6501026466.
Current native work record: https://github.com/Jacob-Met/glossopia/issues/1#issuecomment-6501724678.
The proposed language-creation board task is unregistered; no new authoritative board claim is asserted.
Proposed board task `glossopia-mission-compatibility-6653e323` is also not registered. The earlier snapshot 5032 was observed read-only; route Page sequence 6 now reports a promotion whose authority and fencing have not yet been verified. Current coordination authority is unresolved. This record asserts no new board claim or write authority.
Canonical worker prompt fully read: 2026-10-28.25.

The earlier receiving contribution added browser wiring, fixed version-ID construction for long valid language identifiers, corrected narrow interface wording, and supplied maintained tests. Version 0.2.0 added saved-practice proposal impact analysis and its interface. Version 0.3.0 added version-pinned word-order analysis and an explicit fill-only recovery action. Original source attribution and historical language/session data remain preserved; this work does not modify the original contributor's workspace.

Version 0.4 added market compatibility information; version 0.5 adds authored language construction and local snapshot retention. The retained runtime reviewer authored the language factory, the coordination reviewer authored the archive helper, the consumer reviewer supplies independent receiving tests, and the lead integrates the interface and brokers native execution.

Version 0.4.1 Open protection: estate-609204fd-20261029 and retained independent reviewers. Base source: 65600cc282efc9361e4efa7403b47a7139310491. Native scope and evidence: https://github.com/Jacob-Met/glossopia/issues/1#issuecomment-6501756636. Proposed board task glossopia-open-preserve-work-609204fd remains pending primary recovery; this contribution does not transfer existing ownership.
