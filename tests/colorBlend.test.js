// ==========================================
// 🧪 UNIT TESTS: COLOR BLEND & ZERO-BOOST ENGINE
// File Path: tests/colorBlend.test.js
// ==========================================
const assert = require('assert');
const colorBlendEngine = require('../src/utils/colorBlendEngine');
const ColorRole = require('../src/models/ColorRole');
const colorRoleEngine = require('../src/modules/colorRoleEngine');

console.log('🧪 Starting Starry Color Blend & Name Color Test Suite...\n');

// 1. Test Color Parsing & Normalization
console.log('▶ Test 1: Hex and Named Color Parsing');
assert.strictEqual(colorBlendEngine.parseHex('#FF0055'), '#FF0055');
assert.strictEqual(colorBlendEngine.parseHex('ff0055'), '#FF0055');
assert.strictEqual(colorBlendEngine.parseHex('#f05'), '#FF0055');
assert.strictEqual(colorBlendEngine.parseHex('0xFF0055'), '#FF0055');
assert.strictEqual(colorBlendEngine.parseHex('blurple'), '#5865F2');
assert.strictEqual(colorBlendEngine.parseHex('gold'), '#FFD700');
assert.strictEqual(colorBlendEngine.parseHex('invalid_color'), null);
assert.strictEqual(colorBlendEngine.parseHex(''), null);
console.log('  ✅ Parsing & normalization tests passed!');

// 2. Test Optical Gamma-Corrected Blending
console.log('\n▶ Test 2: Optical Gamma-Corrected Blending');
const red = '#FF0000';
const blue = '#0000FF';
const blended50 = colorBlendEngine.blendColors(red, blue, 0.5);
console.log(`  Red (#FF0000) + Blue (#0000FF) @ 50% = ${blended50}`);
assert.strictEqual(typeof blended50, 'string');
assert.match(blended50, /^#[0-9A-F]{6}$/);

// Verify ratio boundaries
assert.strictEqual(colorBlendEngine.blendColors(red, blue, 0.0), '#FF0000');
assert.strictEqual(colorBlendEngine.blendColors(red, blue, 1.0), '#0000FF');
assert.strictEqual(colorBlendEngine.blendColors(red, blue, 0), '#FF0000');
assert.strictEqual(colorBlendEngine.blendColors(red, blue, 100), '#0000FF');
console.log('  ✅ Optical blending and boundary ratios passed!');

// 3. Test Multi-Color Blend
console.log('\n▶ Test 3: Multi-Color Blend');
const triColor = colorBlendEngine.blendMulti(['#FF0000', '#00FF00', '#0000FF']);
console.log(`  Red + Green + Blue Multi-Blend = ${triColor}`);
assert.match(triColor, /^#[0-9A-F]{6}$/);
console.log('  ✅ Multi-color blending passed!');

// 4. Test Gradient Step Swatch Generation
console.log('\n▶ Test 4: Gradient Step Generator');
const steps = colorBlendEngine.generateSteps('#FF512F', '#DD2476', 5);
assert.strictEqual(steps.length, 5);
assert.strictEqual(steps[0], '#FF512F');
assert.strictEqual(steps[4], '#DD2476');
console.log(`  Steps generated: ${steps.join(' -> ')}`);
console.log('  ✅ Gradient steps generation passed!');

// 5. Test WCAG Readability & Contrast
console.log('\n▶ Test 5: WCAG Readability & Contrast Analytics');
const readability = colorBlendEngine.analyzeDiscordReadability('#FF512F');
assert.strictEqual(typeof readability.darkContrast, 'number');
assert.strictEqual(typeof readability.lightContrast, 'number');
assert.strictEqual(typeof readability.rating, 'string');
console.log(`  Sunset (#FF512F) on Dark: ${readability.darkContrast}:1, Light: ${readability.lightContrast}:1 (${readability.rating})`);
console.log('  ✅ Readability analysis passed!');

// 6. Test Curated Presets
console.log('\n▶ Test 6: Curated Master Presets');
assert.ok(Object.keys(colorBlendEngine.PRESETS).length >= 25, 'Expected at least 25 presets');
const cyberpunk = colorBlendEngine.getPreset('cyberpunk');
assert.ok(cyberpunk, 'Cyberpunk preset should exist');
assert.strictEqual(cyberpunk.id, 'cyberpunk');

const sunset = colorBlendEngine.getPreset('sunset');
assert.ok(sunset, 'Sunset preset should exist');

const holographic = colorBlendEngine.getPreset('holographic');
assert.ok(holographic, 'Holographic preset should exist');
console.log(`  Resolved presets: Cyberpunk (${cyberpunk.hex1} -> ${cyberpunk.hex2}), Holographic (${holographic.hex1} -> ${holographic.hex2})`);
console.log('  ✅ Preset resolution passed!');

// 7. Test Random Blend Generator
console.log('\n▶ Test 7: Random Blend Generator');
const rand = colorBlendEngine.randomBlend();
assert.match(rand.hex1, /^#[0-9A-F]{6}$/);
assert.match(rand.hex2, /^#[0-9A-F]{6}$/);
assert.match(rand.blended, /^#[0-9A-F]{6}$/);
console.log(`  Generated random blend: ${rand.hex1} + ${rand.hex2} => ${rand.blended} (${rand.name})`);
console.log('  ✅ Random blend generator passed!');

// 8. Test ColorRole Model Definition
console.log('\n▶ Test 8: ColorRole Mongoose Schema');
assert.ok(ColorRole.schema, 'ColorRole should have valid schema');
assert.ok(ColorRole.schema.paths.guildId, 'guildId should exist');
assert.ok(ColorRole.schema.paths.userId, 'userId should exist');
assert.ok(ColorRole.schema.paths.roleId, 'roleId should exist');
assert.ok(ColorRole.schema.paths.blendedColor, 'blendedColor should exist');
console.log('  ✅ ColorRole schema verification passed!');

// 9. Test ColorRoleEngine Interface
console.log('\n▶ Test 9: ColorRoleEngine Interface');
assert.strictEqual(typeof colorRoleEngine.applyColorRole, 'function');
assert.strictEqual(typeof colorRoleEngine.removeColorRole, 'function');
assert.strictEqual(typeof colorRoleEngine.getColorRoleStatus, 'function');
assert.strictEqual(typeof colorRoleEngine.calculateSafeRolePosition, 'function');
assert.strictEqual(typeof colorRoleEngine.getSettings, 'function');
// 10. Test HSL & Aesthetic Badge Engine
console.log('\n▶ Test 10: HSL Conversion & Aesthetic Badge Engine');
const hslBlue = colorBlendEngine.hexToHsl('#0000FF');
assert.strictEqual(hslBlue.h, 240);
assert.strictEqual(hslBlue.s, 100);
assert.strictEqual(hslBlue.l, 50);

const badgeSunset = colorBlendEngine.getAestheticBadge('#FF512F');
assert.strictEqual(typeof badgeSunset, 'string');
const badgePreset = colorBlendEngine.getAestheticBadge('#0000FF', { emoji: '⚡' });
assert.strictEqual(badgePreset, '⚡');
console.log(`  HSL of #0000FF: ${JSON.stringify(hslBlue)}, Badge for Sunset: ${badgeSunset}`);
console.log('  ✅ HSL and aesthetic badges passed!');

// 11. Test ColorRole Schema support for No-Role Profile mode
console.log('\n▶ Test 11: ColorRole No-Role Profile Mode Schema Verification');
assert.ok(ColorRole.schema.paths.applyMode, 'applyMode path should exist in schema');
assert.ok(ColorRole.schema.paths.originalNickname, 'originalNickname path should exist in schema');
console.log('  ✅ Schema supports both No-Role Profile mode and Shared Role pool!');

console.log('\n✨ ALL TESTS COMPLETED SUCCESSFULLY WITH 100% PASS RATE!\n');
