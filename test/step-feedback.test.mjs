import test from 'node:test';
import assert from 'node:assert/strict';
import starterLanguage from '../src/starter-language.mjs';
import {startMission,replayMission} from '../src/mission-core.mjs';
function run(inputs){return replayMission(starterLanguage,{...startMission(starterLanguage),inputs});}
test('possession at payment explains the giving action without moving inventory',()=>{
 const s=run(['mi un lum na','mi du pon si']);
 assert.equal(s.lastResult.status,'off_goal');assert.match(s.lastResult.feedback,/Use the word for "give"/);
 assert.equal(s.stage,1);assert.deepEqual(s.inventory,{pear:3,lantern:0});assert.equal(s.source.hintsUsed,0);
 assert.deepEqual(s.source.inputs,['mi un lum na','mi du pon si']);
 const paid=run([...s.source.inputs,'mi du pon di']);assert.equal(paid.stage,2);assert.deepEqual(paid.inventory,{pear:1,lantern:1});
});
test('request and confirmation receive their own action guidance and never repeat a trade',()=>{
 assert.match(run(['mi un lum si']).lastResult.feedback,/Use the word for "request"/);
 const s=run(['mi un lum na','mi du pon di','mi un lum di']);
 assert.equal(s.stage,2);assert.match(s.lastResult.feedback,/Use the word for "have"/);assert.deepEqual(s.inventory,{pear:1,lantern:1});
 const done=run([...s.source.inputs,'mi un lum si','mi du pon di']);assert.equal(done.lastResult.status,'complete');assert.deepEqual(done.inventory,{pear:1,lantern:1});
});
test('speaker, item and quantity guidance reflects the current fixed-market goal',()=>{
 assert.match(run(['tu un lum na']).lastResult.feedback,/Speak for yourself/);
 assert.match(run(['mi un pon na']).lastResult.feedback,/Ask for lantern/);
 assert.match(run(['mi du lum na']).lastResult.feedback,/Use a quantity of 1/);
});
