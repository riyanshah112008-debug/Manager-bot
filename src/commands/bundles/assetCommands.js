// Discord asset converter: images/GIFs/ZIPs/replied stickers -> guild emoji or sticker.
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const execFileAsync = promisify(execFile);
const INPUT_LIMIT = 200 * 1024 * 1024, ZIP_LIMIT = 200 * 1024 * 1024;
const EMOJI_LIMIT = 256 * 1024, STICKER_LIMIT = 512 * 1024, MAX_BATCH = 10;
const ALLOWED = new Set(['.gif', '.png', '.apng', '.jpg', '.jpeg', '.webp']);

function safeName(value, fallback = 'starry_asset') {
    const name = String(value || fallback).normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
    return name.length >= 2 ? name : fallback;
}
function readZip(buffer) {
    let end = -1;
    for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
        if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; }
    }
    if (end < 0) throw new Error('Invalid or unsupported ZIP archive.');
    const count = buffer.readUInt16LE(end + 10);
    let cursor = buffer.readUInt32LE(end + 16);
    if (count > 100 || cursor >= buffer.length) throw new Error('ZIP contains too many entries or is malformed.');
    const files = []; let expanded = 0;
    for (let i = 0; i < count; i++) {
        if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Malformed ZIP directory.');
        const flags = buffer.readUInt16LE(cursor + 8), method = buffer.readUInt16LE(cursor + 10);
        const packedSize = buffer.readUInt32LE(cursor + 20), size = buffer.readUInt32LE(cursor + 24);
        const nameLen = buffer.readUInt16LE(cursor + 28), extraLen = buffer.readUInt16LE(cursor + 30);
        const commentLen = buffer.readUInt16LE(cursor + 32), localOffset = buffer.readUInt32LE(cursor + 42);
        const entryName = buffer.subarray(cursor + 46, cursor + 46 + nameLen).toString('utf8');
        cursor += 46 + nameLen + extraLen + commentLen;
        const base = path.posix.basename(entryName.replace(/\\/g, '/')), ext = path.extname(base).toLowerCase();
        if (!base || entryName.endsWith('/') || !ALLOWED.has(ext)) continue;
        if ((flags & 1) || ![0, 8].includes(method) || size > INPUT_LIMIT || packedSize > ZIP_LIMIT) continue;
        if (buffer.readUInt32LE(localOffset) !== 0x04034b50) continue;
        const start = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
        const packed = buffer.subarray(start, start + packedSize); let data;
        try { data = method === 0 ? Buffer.from(packed) : zlib.inflateRawSync(packed, { maxOutputLength: INPUT_LIMIT }); } catch { continue; }
        if (data.length !== size) continue;
        expanded += data.length;
        if (expanded > 15 * 1024 * 1024) throw new Error('ZIP expands beyond the 15 MB safety limit.');
        files.push({ name: base, buffer: data });
        if (files.length >= MAX_BATCH) break;
    }
    return files;
}
async function download(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('Could not download the Discord attachment.');
    if (Number(response.headers.get('content-length') || 0) > INPUT_LIMIT) throw new Error('Input exceeds the 200 MB limit.');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > INPUT_LIMIT) throw new Error('Input is empty or exceeds 200 MB.');
    return buffer;
}
async function ffmpeg(args) {
    await execFileAsync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
}
async function convert(source, kind, dir, index) {
    const ext = path.extname(source.name).toLowerCase(), input = path.join(dir, 'input_' + index + (ext || '.bin'));
    await fs.writeFile(input, source.buffer);
    const base = safeName(path.basename(source.name, ext), 'asset_' + index);
    if (kind === 'emoji') {
        if (ext === '.gif') {
            for (const preset of [{ fps: 15, size: 128, colors: 128 }, { fps: 10, size: 96, colors: 96 }]) {
                const out = path.join(dir, 'emoji_' + index + '_' + preset.fps + '.gif');
                await ffmpeg(['-i', input, '-vf', 'fps=' + preset.fps + ',scale=' + preset.size + ':' + preset.size + ':force_original_aspect_ratio=decrease:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=' + preset.colors + '[p];[s1][p]paletteuse', '-loop', '0', out]).catch(() => {});
                try { const gif = await fs.readFile(out); if (gif.length <= EMOJI_LIMIT) return { name: base, buffer: gif, animated: true }; } catch {}
            }
        }
        const png = path.join(dir, 'emoji_' + index + '.png');
        await ffmpeg(['-i', input, '-frames:v', '1', '-vf', 'scale=128:128:force_original_aspect_ratio=decrease:flags=lanczos', png]);
        const image = await fs.readFile(png);
        if (image.length > EMOJI_LIMIT) throw new Error('Image cannot be compressed below Discord 256 KB emoji limit.');
        return { name: base, buffer: image, animated: false };
    }
    const animated = ['.gif', '.webp', '.apng'].includes(ext);
    const out = path.join(dir, 'sticker_' + index + (animated ? '.apng' : '.png'));
    const filter = 'scale=320:320:force_original_aspect_ratio=decrease:flags=lanczos,pad=320:320:(ow-iw)/2:(oh-ih)/2:color=0x00000000';
    await ffmpeg(['-i', input, '-vf', filter, ...(animated ? ['-plays', '0'] : ['-frames:v', '1']), '-compression_level', '9', out]);
    const image = await fs.readFile(out);
    if (image.length > STICKER_LIMIT) throw new Error('Converted sticker exceeds Discord 512 KB limit.');
    return { name: base, buffer: image, animated };
}
async function resolveInput(ctx, attachment) {
    if (attachment?.url) return [{ name: attachment.name || 'upload', buffer: await download(attachment.url) }];
    let message = ctx.message;
    if (message?.reference?.messageId && message.fetchReference) message = await message.fetchReference().catch(() => message);
    const file = message?.attachments?.first?.();
    if (file?.url) return [{ name: file.name || 'upload', buffer: await download(file.url) }];
    const sticker = message?.stickers?.first?.();
    if (sticker?.url) return [{ name: (sticker.name || 'sticker') + '.png', buffer: await download(sticker.url) }];
    throw new Error('Attach a GIF/image/ZIP, or reply to a message containing a sticker. Supported: GIF, PNG, JPG, WEBP, ZIP.');
}
async function createAsset(guild, kind, item, reason) {
    const name = safeName(item.name);
    if (kind === 'emoji') {
        const emoji = await guild.emojis.create({ attachment: item.buffer, name, reason });
        return (emoji.animated ? '🎞️ ' : '😀 ') + ':' + emoji.name + ':';
    }
    const sticker = await guild.stickers.create({ file: item.buffer, name: name.slice(0, 30), tags: '⭐', reason });
    return '🏷️ ' + sticker.name;
}

module.exports = [{
    name: 'asset', aliases: ['toemoji', 'tosticker', 'emojify', 'stickerify'], category: 'Utility',
    description: 'Convert images, GIFs, ZIP archives, or replied-to stickers into server emojis or stickers.',
    usage: ',asset [emoji|sticker] [name] (attach a file or reply to a sticker)',
    data: new SlashCommandBuilder().setName('asset').setDescription('Convert an image, GIF, ZIP, or replied-to sticker into a server emoji or sticker.')
        .addSubcommand(sub => sub.setName('emoji').setDescription('Convert and add as a server emoji.')
            .addAttachmentOption(opt => opt.setName('file').setDescription('Image, GIF, or ZIP').setRequired(false))
            .addStringOption(opt => opt.setName('name').setDescription('Optional emoji name').setMaxLength(32).setRequired(false)))
        .addSubcommand(sub => sub.setName('sticker').setDescription('Convert and add as a server sticker.')
            .addAttachmentOption(opt => opt.setName('file').setDescription('Image, GIF, or ZIP').setRequired(false))
            .addStringOption(opt => opt.setName('name').setDescription('Optional sticker name').setMaxLength(30).setRequired(false))),
    async execute(ctx) {
        if (!ctx.guild) return ctx.reply('❌ Use this command inside a server.');
        const kind = ctx.isSlash ? ctx.options.getSubcommand() : String(ctx.args[0] || '').toLowerCase();
        if (!['emoji', 'sticker'].includes(kind)) return ctx.reply('Use ,asset emoji or ,asset sticker, attach a file, or reply to a sticker message.');
        const userPerms = ctx.member?.permissions;
        if (!userPerms?.has(PermissionFlagsBits.ManageGuildExpressions) && !userPerms?.has(PermissionFlagsBits.Administrator)) return ctx.reply('❌ You need Manage Expressions permission.');
        const botMember = ctx.guild.members.me || await ctx.guild.members.fetchMe().catch(() => null);
        if (!botMember?.permissions?.has(PermissionFlagsBits.ManageGuildExpressions)) return ctx.reply('❌ I need Manage Expressions permission.');
        const attachment = ctx.isSlash ? ctx.options.getAttachment('file') : null;
        const customName = ctx.isSlash ? ctx.options.getString('name') : ctx.args.slice(1).join('_').trim();
        await ctx.defer(true);
        let temp;
        try {
            const sources = await resolveInput(ctx, attachment);
            let items = sources;
            if (sources.length === 1 && path.extname(sources[0].name).toLowerCase() === '.zip') {
                if (sources[0].buffer.length > ZIP_LIMIT) throw new Error('ZIP files must be 200 MB or smaller.');
                items = readZip(sources[0].buffer);
                if (!items.length) throw new Error('No supported image/GIF files found in the ZIP.');
            }
            items = items.slice(0, MAX_BATCH);
            temp = await fs.mkdtemp(path.join(os.tmpdir(), 'starry-asset-'));
            const report = [];
            for (let i = 0; i < items.length; i++) {
                try {
                    const ready = await convert(items[i], kind, temp, i);
                    if (customName && items.length === 1) ready.name = safeName(customName);
                    const created = await createAsset(ctx.guild, kind, ready, 'Asset added by ' + (ctx.user.tag || ctx.user.id));
                    report.push('✅ ' + created + ' — ' + items[i].name.slice(0, 70));
                } catch (error) { report.push('⚠️ ' + items[i].name.slice(0, 70) + ': ' + String(error.message || error).slice(0, 130)); }
            }
            return ctx.editReply('**' + (kind === 'emoji' ? 'Emoji' : 'Sticker') + ' import results**\\n' + report.join('\\n') +
                '\\n\\nUpload only non-explicit media that you own or have permission to use.');
        } catch (error) {
            return ctx.editReply('❌ ' + String(error.message || error).slice(0, 900));
        } finally {
            if (temp) await fs.rm(temp, { recursive: true, force: true }).catch(() => {});
        }
    }
}];