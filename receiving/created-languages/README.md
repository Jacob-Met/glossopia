# Independent language consumer references

These frozen Nemi (SOV) and Tavi (SVO) project files give the language-creation contribution independently chosen vocabulary, expected sentences and negative cases. Tavi deliberately uses **se** for both “I” and “one.” The positional grammar resolves the two roles. Globally forbidding duplicate forms would reject a supported language.

These are original invented receiving fixtures, with no claim about natural-language authenticity, learning quality or newcomer comprehension.

## Forms and independent expectations

| Meaning | Nemi — SOV | Tavi — SVO |
|---|---|---|
| I | ena | se |
| you | ori | ye |
| request | vex | avu |
| give | sul | daro |
| have | har | esu |
| lantern | vela | lani |
| pear | piri | poro |
| one | ak | se |
| two | bi | vi |
| three | ket | zu |

| Event | Nemi | Tavi |
|---|---|---|
| Player requests one lantern | ena ak vela vex | se avu se lani |
| Trader requests two pears | ena bi piri vex | se avu vi poro |
| Player gives two pears | ena bi piri sul | se daro vi poro |
| Trader confirms possession | ori ak vela har | ye esu se lani |
| Player confirms possession | ena ak vela har | se esu se lani |

A clean run records three player inputs and two trader semantic replies, finishing with one pear and one lantern. Rejected inputs remain recorded; they do not advance the mission or transfer inventory. The browser receiver starts a new practice after a rejected wrong-order input, then verifies both histories survive saving and fresh-context reopening.

REFERENCE.json retains literal independent expectations and exact fixture hashes. Do not regenerate expected strings with the formatter being tested.

## Run against an application checkout or extracted package

With Node.js 20+, the core receiver needs no added dependency:

    GLOSSOPIA_APP_ROOT=/absolute/path/to/application node receiving/created-languages/verify-core.mjs

For real-browser receiving, make Playwright available to Node, or set GLOSSOPIA_PLAYWRIGHT to its module path:

    GLOSSOPIA_APP_ROOT=/absolute/path/to/application node receiving/created-languages/receive.mjs

GLOSSOPIA_CHROME can select an existing Chrome executable. GLOSSOPIA_EVIDENCE chooses the output directory. GLOSSOPIA_URL optionally points to an already running application; otherwise the receiver starts the maintained application server on an ephemeral loopback port. GLOSSOPIA_NO_SANDBOX=1 is available only where the execution environment already requires that Chrome option. These receivers do not install dependencies or change the application.

## Observed receiving and its limits

The original run used integrated source 320b81e4c612bdab75d2766e99ec4e912d54d937, released package SHA-256 bcd658e170338d5ecf18ffafb7d62afa2de341b341a75686f3692d3fd7878f43, and Chrome 156.0.8078.47 on Linux. The frozen browser report is observed-0.4.1.json.

Both fixtures passed core meaning/mission checks, including five initial rejection cases per language, a three-pear offer where the fixed price is two, and a repeated give after completion. The actual browser imported each file, rejected one wrong-order input without inventory effects, built the correct three inputs through role-labelled word-bank buttons, verified both trader replies, and completed the exchange. Save, reload and Open in a fresh browser context preserved the full project, exact language forms and both practice histories. There were no recorded browser exceptions.

Core negative coverage is broader than the browser's single wrong-order case. Choosing words by role and gloss does not establish newcomer comprehension without those labels.

Root estate-609204fd-20261029 generated the files and executed the receivers through Renpō. Retained pool_review independently derived the literal sentence/state matrix and reviewed relayed outcomes; product_review assessed the consumer evidence boundaries. Original commands were estate-609204fd-language-fixtures-01 and estate-609204fd-language-browser-01 on owner node-1e63ba250e07e82326fe4593b03206d3.

## Remaining creator and archive acceptance

The unpublished Create-language UI has not been received by this contribution. Its owner should author these two languages through that UI, export them, and compare semantic structure against these frozen references. Generated IDs and attribution metadata may legitimately differ; byte equality is required only for the preserved frozen fixtures themselves.

The following are acceptance cases, not observed defects in unpublished code:

- A reviewed draft followed by a successful Open, practice submission, revision acceptance or archive restore must not subsequently replace the changed project.
- A delayed Open followed by editing or creating a language must preserve that later work. New draft/preview changes need the maintained noteWork path; project changes need the committed-work path.
- Editing any reviewed field, including a form, name or order, requires a fresh review. Reverting an edit still represents intervening work.
- Archive-write failure must preserve the current project and transient work. Failure while saving the new active project must not be reported as durable success.
- Retry and double activation must not lose the original project or create misleading duplicate archives.
- Restoring an archive must retain a recoverable current project and must not consume the only copy of the restored data before successful persistence.
- A complete author → preview → create → trade → Save → fresh Open → archive restore path needs actual browser receiving.

The existing creation owner retains factory, archive and UI implementation scope. These references provide complementary consumer evidence.
