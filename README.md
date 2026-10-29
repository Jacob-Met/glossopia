# GLOSSOPIA — local experimental receiving build

GLOSSOPIA is an invented-language studio with an authored fixed-price trading mission. Version 0.4.0 adds pre-acceptance market compatibility information, building on version 0.3.0 word-order help and version 0.2.0 saved-practice review while preserving the original language, parser, mission and version history.

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

## Check market compatibility before accepting a proposal

A language proposal can preserve the authored examples and saved utterances yet prevent a fresh market practice from starting. Compatibility review checks the current exercise’s five required statements: your lantern request, two-pear payment and confirmation, plus the trader’s price and receipt statements.

The result describes whether the current market engine can generate all five statements unambiguously using its existing word-selection rules. A failure may mean a missing word, an unresolved choice among accepted forms, or ambiguity in the selected expression. It does not prove that the language cannot express the meaning: another accepted synonym may work even when the engine’s preferred form does not.

This information supports your decision without adding an acceptance restriction. It does not change the fixed price, stock, inventory transfers or mission progression. Existing conversations remain attached to their historical versions. A compatible result does not guarantee that every sentence you might enter is understood or that you will complete the exchange.

## Verification of version 0.4.0

Source qualification completed successfully on Coordinator3 at 2026-10-29 15:41:37 UTC with Node.js 22.23.4, npm 10.9.9 and Chrome 156.0.8078.47. All 27 maintained tests across seven files, the independent form-choice adversarial receiver, five equivalence cases against the frozen version 0.3 implementation, and five actual-browser checks passed with no recorded browser errors. The receiving lead executed and reported these native results.

Package and Mac receiving are separate exact-artifact checks; no result for those stages is claimed here. Earlier results below retain their original version scope.

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
Current native work record: https://github.com/Jacob-Met/glossopia/issues/1#issuecomment-6501026466.
Proposed board task `glossopia-mission-compatibility-6653e323` is not yet registered: the primary route timed out and standby snapshot 5032 is read-only. This record does not assert a new board claim.
Canonical worker prompt fully read: 2026-10-28.25.

The earlier receiving contribution added browser wiring, fixed version-ID construction for long valid language identifiers, corrected narrow interface wording, and supplied maintained tests. Version 0.2.0 added saved-practice proposal impact analysis and its interface. Version 0.3.0 adds version-pinned word-order analysis and an explicit fill-only recovery action. Original source attribution and historical language/session data remain preserved; this work does not modify the original contributor's workspace.
