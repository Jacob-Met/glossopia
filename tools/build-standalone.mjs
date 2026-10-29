import {readFile, writeFile, realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';

// GLOSSOPIA 0.6.3 maintained experimental standalone builder.
// This tool supports only these reviewed source bytes. Updating a pin
// requires reviewing syntax, bindings, dependencies and browser policy again.
const SOURCE_PINS = {
  "src/language-core.mjs": "60b988221a2170e3209ee9ccefdd3fe3437d72f91a9126f16c5f7a71dd39776a",
  "src/starter-language.mjs": "08c0493f315092a813911d6028d1d0af4b2adb60453eb6b6b93ea86a091366bc",
  "src/mission-core.mjs": "50f8f2655464bfa08bfcf2c06043cfaf0b77c5b1045f7f33716345028b253a4b",
  "src/project.mjs": "6cd2a83d961e3770de6323587c08509482cc21eddf1cf42231cf62ee16f08b1a",
  "src/practice-impact.mjs": "5acc58332d24938a5ab38ada9eaab0525cceeb98926d848729078a33a9845d4b",
  "src/word-order.mjs": "bd481bed9b9369cde53ea6510202c9fa3a622a982cdf94ae80d6acb84f82afe4",
  "src/language-creation.mjs": "62d16a3177bc0ee8e804737dca4f2075a7c20c240b6a059c9c77b52cae6954f6",
  "src/project-archive.mjs": "500c7cedc6dba3b291f9cd5b97f2a9ebe3d21533c6034e8ffa0985055a3d9dd9",
  "src/browser-recovery.mjs": "7f4adb3b77acca76fbb9c666fc9cf5418d579cb8095495a13bb2c00f876f0bc3",
  "src/version-history.mjs": "30d1f90e1937da652b4e3b9c6a79bf099ff2e24ac74945d50fb508b9741e4482",
  "app.mjs": "a7f0a35cbc11aa6c76888c038d97bf4d637c168b81b20b3bec27cdbfd050efb1",
  "index.html": "e1d8e04f467bb6ae1084c7c819065cd1a39166b749efc525c060b062703066fa",
  "style.css": "69049064a1ea0f13e1bb43dad84de1ef82eb7031c65e953bc9f6d1af53926fa4",
  "package.json": "761bb3ae3466c80a42986bc52407b6bec518e7526a85d08503a7cfa4682001d0"
};

const MODULES = Object.keys(SOURCE_PINS).filter(name => name.endsWith('.mjs'));
const digest = (bytes, encoding = 'hex') => createHash('sha256').update(bytes).digest(encoding);
const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
function once(text, needle, replacement) {
  assert.equal(text.split(needle).length, 2, 'Expected exactly one HTML marker: ' + needle);
  return text.replace(needle, () => replacement);
}
function transform(name, source, completed) {
  const exports = [], prelude = [];
  const body = source.split('\n').map(line => {
    let match = /^import\s*\{([^}]+)\}\s*from\s*'([^']+)';$/.exec(line);
    if (match) {
      const [, names, relative] = match;
      assert.ok(relative.startsWith('./'), 'Only explicit local relative imports are supported');
      const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(name), relative));
      assert.ok(MODULES.includes(dependency) && completed.has(dependency), 'Unsupported dependency or non-acyclic order: ' + dependency);
      const bindings = names.split(',').map(value => value.trim());
      for (const binding of bindings) {
        assert.ok(identifier.test(binding), 'Only direct named imports are supported');
        assert.ok(completed.get(dependency).includes(binding), 'Missing imported binding ' + binding);
      }
      prelude.push('const {' + bindings.join(',') + '} = modules[' + JSON.stringify(dependency) + '];');
      return '';
    }
    match = /^export (function|class|const) ([A-Za-z_$][A-Za-z0-9_$]*)\b/.exec(line);
    if (match) { exports.push([match[2], match[2]]); return line.slice('export '.length); }
    match = /^export \{([A-Za-z_$][A-Za-z0-9_$]*) as ([A-Za-z_$][A-Za-z0-9_$]*)\};$/.exec(line);
    if (match) { exports.push([match[2], match[1]]); return ''; }
    match = /^export default ([A-Za-z_$][A-Za-z0-9_$]*);$/.exec(line);
    if (match) { exports.push(['default', match[1]]); return ''; }
    assert.ok(!/^\s*(?:import|export)\b/.test(line), 'Unsupported module declaration in ' + name);
    return line;
  }).join('\n');
  assert.equal(new Set(exports.map(([key]) => key)).size, exports.length, 'Duplicate export');
  // The byte pins additionally reject changes anywhere, including declarations
  // hidden after another statement. This is not a general JavaScript parser.
  assert.ok(!/\bimport\s*(?:\(|\.)|\beval\s*\(|\bFunction\s*\(/.test(body), 'Dynamic code or module loading is not supported');
  completed.set(name, exports.map(([key]) => key));
  return 'modules[' + JSON.stringify(name) + '] = (() => {\n' + prelude.join('\n') + '\n' + body + '\nreturn Object.freeze({' + exports.map(([key, binding]) => JSON.stringify(key) + ':' + binding).join(',') + '});\n})();';
}

// API: node build-standalone.mjs ABS_SOURCE_ROOT ABS_NEW_OUTPUT_HTML
// No source imports are executed; all reads must match the reviewed byte pins.
const [sourceArgument, outputArgument, ...extra] = process.argv.slice(2);
assert.ok(sourceArgument && outputArgument && !extra.length && path.isAbsolute(sourceArgument) && path.isAbsolute(outputArgument), 'Pass absolute source root and new output .html path');
assert.ok(outputArgument.endsWith('.html'), 'Output must be an HTML file');
const sourceRoot = await realpath(sourceArgument);
const outputParent = await realpath(path.dirname(outputArgument));
const outputPath = path.join(outputParent, path.basename(outputArgument));
assert.ok(outputPath !== sourceRoot && !outputPath.startsWith(sourceRoot + path.sep), 'Output must be outside maintained source');
const sources = new Map();
for (const [name, expected] of Object.entries(SOURCE_PINS)) {
  const bytes = await readFile(path.join(sourceRoot, name));
  assert.equal(digest(bytes), expected, 'Unreviewed source bytes: ' + name);
  sources.set(name, bytes.toString('utf8'));
}
const sourcePackage = JSON.parse(sources.get('package.json'));
assert.equal(sourcePackage.name, 'glossopia');
assert.equal(sourcePackage.version, '0.6.3');
const completed = new Map();
const javascript = 'const modules = Object.create(null);\n' + MODULES.map(name => transform(name, sources.get(name), completed)).join('\n');
const css = sources.get('style.css');
// Refuse raw-text terminators instead of rewriting maintained JavaScript/CSS.
assert.ok(!/<\/script/i.test(javascript), 'Script contains an unsafe HTML raw-text terminator');
assert.ok(!/<\/style/i.test(css), 'Style contains an unsafe HTML raw-text terminator');
assert.ok(!/@import\b|url\s*\(/i.test(css), 'CSS resource loading requires separate review');
let html = sources.get('index.html');
html = once(html, '<link rel="stylesheet" href="/style.css">', '<style>' + css + '</style>');
html = once(html, '<script type="module" src="/app.mjs"></script>', '<script type="module">' + javascript + '</script>');
html = once(html, 'class="brand" href="/"', 'class="brand" href="#marketView"');
// Inline code is hash-authorized. No external resources, eval, connections,
// forms, or objects are authorized. Attribute styling preserves the maintained
// app's existing style-property behavior; the HTTP policy already permits it.
const policy = "default-src 'none'; script-src 'sha256-" + digest(javascript, 'base64') + "'; style-src 'sha256-" + digest(css, 'base64') + "'; style-src-attr 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
html = once(html, '<head>', '<head><meta http-equiv="Content-Security-Policy" content="' + policy + '">');
// No changes are made to product logic, fixed semantics or project codecs.
await writeFile(outputPath, html, {flag: 'wx'});
console.log(JSON.stringify({prototype: false, experimental: true, sourcePackage: {name: sourcePackage.name, version: sourcePackage.version, requiredNode: sourcePackage.engines.node, sha256: SOURCE_PINS['package.json']}, sourceRoot, outputPath, bytes: Buffer.byteLength(html), sha256: digest(html), sourceFiles: SOURCE_PINS,
  runtimeQualification: 'separate exact-artifact receiving required',
  scope: 'Maintained experimental 0.6.3 build from verified source and package bytes. This build report does not establish browser, file-origin storage, CSP or usability qualification; retain the separate exact-artifact receiving reports.'}, null, 2));
