# GLOSSOPIA — local experimental receiving build

GLOSSOPIA is an invented-language studio with an authored fixed-price trading mission. This integration candidate preserves the original Luma language, transparent parser, mission and version history, and adds the browser application entry point.

## Run

Use Node.js 20 or newer. No dependency installation is needed.

```sh
npm start
```

Open http://127.0.0.1:4183 in a modern browser. The server binds only to loopback. Set the PORT environment variable if that port is in use. Stop it with Ctrl+C.

```sh
npm test
```

The maintained test command checks mission inventory and failure behavior, immutable histories, proposal validation, project roundtrip and bounded version identifiers. Browser receiving is recorded separately; passing these core tests alone does not establish a working UI.

## Use

In Market, use the accepted word bank to request one lantern, give exactly two pears, and confirm possession. Unknown, ambiguous and out-of-order expressions do not authorize an exchange. Glosses and hints come from the active conversation's language version.

In Language studio, inspect words and token derivations, preview a sentence-order or vocabulary change, review the affected examples, then explicitly accept or discard. Acceptance is local, with self-entered attribution. Editing a pending proposal requires a fresh preview.

In Versions, inspect earlier language versions, reopen earlier conversations or start a fresh practice. Existing conversations retain their original version. The header distinguishes latest accepted language, displayed studio language and practice language.

Use Save a copy to download the full validated project JSON. Open reopens such a file. Malformed replacements retain the current project. The browser may also retain a local copy; the interface reports storage failures. Downloaded copies are the portable backup.

## Scope and limits

- This is an authored fixed-price exercise, not bargaining or a live community.
- Supported statements have one speaker, one action (request/give/have), one quantity and one object in SOV or SVO order. Words use 1–20 ASCII letters.
- Naming a new object does not make the trader stock it.
- Project bounds are 100 accepted versions, 30 conversations, 100 utterances per conversation and a 1 MB portable file.
- NVIDIA-assisted proposals through Nebius have not been configured or verified. No model contribution or provider benefit is claimed.
- Uninvolved newcomer comprehension and creative/linguistic quality remain human evaluation dependencies.
- This is a private experimental integration candidate. Original project ownership and source contributions are preserved. A source/package candidate is distinct from adoption, merge or deployment.

## Provenance

Original project: https://github.com/Jacob-Met/glossopia/issues/1
Original contributor: estate-b79ee09d97e1 and its retained team.
Original uncommitted source snapshot SHA-256: 4e9c453985c37f67f46fbe94f9830d6224d0e99e5ea981f0b9f7631d016f6750.
Receiving contributor: estate-6653e323ca46-20261029 and retained internal reviewers.
Current work record: glossopia-existing-project-reconciliation-20261029.
Canonical worker prompt fully read: 2026-10-28.25.

This candidate adds browser wiring, fixes version-ID construction for long valid language identifiers, corrects narrow interface wording, and supplies maintained tests. It does not modify the original contributor's workspace.
