// ==========================================
// 🧪 UNIT TESTS: STARRY AI VISION & MULTIMODAL SUITE
// File Path: tests/aiVision.test.js
// ==========================================
const assert = require('assert');
const aiEngine = require('../src/utils/aiEngine');
const utilityCommands = require('../src/commands/bundles/utilityCommands');

console.log('🧪 Starting Starry AI Vision & Multimodal Test Suite...\n');

// 1. Test Text Pagination
console.log('▶ Test 1: AI Response Text Pagination');
const shortText = 'Short response from Starry.';
const shortPages = aiEngine.splitIntoPages(shortText, 1400);
assert.strictEqual(shortPages.length, 1);
assert.strictEqual(shortPages[0], shortText);

const longText = 'Starry AI Starlight '.repeat(150); // ~3000 chars
const longPages = aiEngine.splitIntoPages(longText, 1400);
assert.ok(longPages.length >= 2, 'Should split long text into multiple pages');
for (const p of longPages) {
    assert.ok(p.length <= 1400, 'Each page should be <= 1400 characters');
}
console.log(`  ✅ Pagination passed! Split ${longText.length} chars into ${longPages.length} pages.`);

// 2. Test Persona Prompts Configuration
console.log('\n▶ Test 2: System Persona Prompts');
assert.ok(aiEngine.SYSTEM_PERSONA_PROMPTS.default, 'Default persona must exist');
assert.ok(aiEngine.SYSTEM_PERSONA_PROMPTS.dev, 'Dev persona must exist');
assert.ok(aiEngine.SYSTEM_PERSONA_PROMPTS.story, 'Story persona must exist');
assert.ok(aiEngine.SYSTEM_PERSONA_PROMPTS.roast, 'Roast persona must exist');
assert.ok(aiEngine.SYSTEM_PERSONA_PROMPTS.study, 'Study persona must exist');
console.log('  ✅ All 5 persona modes (default, dev, story, roast, study) verified!');

// 3. Test Buffer / Image Normalization
console.log('\n▶ Test 3: Image Buffer Normalization');
const sampleRaw = {
    data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    mimeType: 'image/png'
};
(async () => {
    const fetched = await aiEngine.fetchImageBuffer(sampleRaw);
    assert.ok(fetched, 'Image buffer should be resolved');
    assert.strictEqual(fetched.mimeType, 'image/png');
    assert.strictEqual(fetched.base64, sampleRaw.data);
    console.log('  ✅ Image buffer normalization passed!');

    // 4. Test Context Extraction from Mock Slash Command
    console.log('\n▶ Test 4: Extract Image from Mock Slash Interaction');
    const mockSlashCtx = {
        interaction: {
            options: {
                getAttachment: (name) => name === 'image' ? { url: 'https://cdn.discordapp.com/sample.png' } : null
            }
        }
    };
    const extractedSlash = await aiEngine.extractImageFromContext(mockSlashCtx);
    assert.strictEqual(extractedSlash, 'https://cdn.discordapp.com/sample.png');
    console.log('  ✅ Slash attachment extraction passed!');

    // 5. Test Context Extraction from Message Attachments
    console.log('\n▶ Test 5: Extract Image from Message Attachments');
    const mockMsgCtx = {
        message: {
            attachments: {
                size: 1,
                first: () => ({ url: 'https://cdn.discordapp.com/message_att.jpg', contentType: 'image/jpeg' }),
                find: () => ({ url: 'https://cdn.discordapp.com/message_att.jpg', contentType: 'image/jpeg' })
            }
        }
    };
    const extractedMsg = await aiEngine.extractImageFromContext(mockMsgCtx);
    assert.strictEqual(extractedMsg, 'https://cdn.discordapp.com/message_att.jpg');
    console.log('  ✅ Message attachment extraction passed!');

    // 6. Test Utility Bundle Commands
    console.log('\n▶ Test 6: Utility Command Bundle Verification');
    const cmdNames = utilityCommands.map(c => c.name);
    assert.ok(cmdNames.includes('ask'), '`ask` command must be present');
    assert.ok(cmdNames.includes('vision'), '`vision` command must be present');
    assert.ok(cmdNames.includes('summarize'), '`summarize` command must be present');

    const visionCmd = utilityCommands.find(c => c.name === 'vision');
    assert.ok(visionCmd.aliases.includes('analyze'), '`vision` must include `analyze` alias');
    assert.ok(visionCmd.aliases.includes('ocr'), '`vision` must include `ocr` alias');

    const summarizeCmd = utilityCommands.find(c => c.name === 'summarize');
    assert.ok(summarizeCmd.aliases.includes('catchup'), '`summarize` must include `catchup` alias');
    assert.ok(summarizeCmd.aliases.includes('tldr'), '`summarize` must include `tldr` alias');
    console.log('  ✅ Utility commands (ask, vision, summarize) verified with all aliases!');

    // 7. Verify Deploy Commands Module
    console.log('\n▶ Test 7: Deploy Commands Definition Verification');
    const deploy = require('../deploy-commands');
    assert.ok(typeof deploy.deployCommands === 'function', 'deployCommands should be exported');
    console.log('  ✅ deploy-commands.js syntax and export verified!');

    console.log('\n✨ ALL AI VISION & MULTIMODAL TESTS PASSED WITH 100% SUCCESS RATE!\n');
})().catch(err => {
    console.error('❌ Test Suite Failed:', err);
    process.exit(1);
});
