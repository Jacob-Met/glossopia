# GLOSSOPIA — local experimental receiving build

GLOSSOPIA is an invented-language studio with an authored fixed-price trading mission. Version 0.2.0 adds proposal impact review for saved practice sentences while preserving the original Luma language, transparent parser, mission and immutable version history.

## Run

Use Node.js 20 or newer. No dependency installation is needed.

```sh
npm start
```

Open http://127.0.0.1:4183 in a modern browser. The server binds only to loopback. Set the PORT environment variable if that port is in use. Stop it with Ctrl+C.

```sh
npm test
```

The maintained test command checks mission inventory and failure behavior, immutable histories, proposal validation, project roundtrip, bounded version identifiers and saved-practice impact semantics. Browser receiving is recorded separately; passing these core tests alone does not establish a working UI.

## Use

In Market, use the accepted word bank to request one lantern, give exactly two pears, and confirm possession. Unknown, ambiguous and out-of-order expressions do not authorize an exchange. Glosses and hints come from the active conversation's language version.

In Language studio, inspect words and token derivations, preview a sentence-order or vocabulary change, review the affected examples, then explicitly accept or discard. Acceptance is local, with self-entered attribution. Editing a pending proposal requires a fresh preview.

In Versions, inspect earlier language versions, reopen earlier conversations or start a fresh practice. Existing conversations retain their original version. The header distinguishes latest accepted language, displayed studio language and practice language.

Use Save a copy to download the full validated project JSON. Open reopens such a file. Malformed replacements retain the current project. The browser may also retain a local copy; the interface reports storage failures. Downloaded copies are the portable backup.

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
Current work record: glossopia-saved-practice-impact-6653e323.
Canonical worker prompt fully read: 2026-10-28.25.

The earlier receiving contribution added browser wiring, fixed version-ID construction for long valid language identifiers, corrected narrow interface wording, and supplied maintained tests. Version 0.2.0 adds saved-practice proposal impact analysis and its interface. Original source attribution and historical language/session data remain preserved; this work does not modify the original contributor's workspace.
