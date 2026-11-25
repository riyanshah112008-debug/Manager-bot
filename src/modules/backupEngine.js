// Starry server backup engine.
// Backups are opt-in per guild: administrators choose automatic daily delivery
// or manual execution with the ,backup command. No guild is backed up by default.
const {
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    AttachmentBuilder,
    Events
} = require('discord.js');
const ServerSettings = require('../models/ServerSettings');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const BACKUP_CHOICE_PREFIX = 'starry_backup_mode';
const AUTOMATIC_INTERVAL_MS = 24 * 60 * 60 * 1000;
let schedulerStarted = false;

async function fetchChannelMessageArchive(channel, limit = 50) {
    if (!channel.isTextBased() || channel.isVoiceBased()) return [];
    const botMember = channel.guild.members.me;
    const permissions = botMember ? channel.permissionsFor(botMember) : null;
    if (!permissions || !permissions.has([PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ViewChannel])) return [];
    try {
        const fetched = await channel.messages.fetch({ limit });
        return [...fetched.values()].map(message => ({
            time: new Date(message.createdTimestamp).toISOString(),
            author: message.author?.tag || 'Unknown User',
            isBot: Boolean(message.author?.bot),
            content: message.content || '',
            attachments: [...message.attachments.values()].map(attachment => attachment.url),
            id: message.id
        })).reverse();
    } catch (error) {
        console.warn('[BackupEngine] Message archive skipped:', error.message);
        return [];
    }
}

async function executeServerFullBackup(guild) {
    if (!guild || !/^\d{17,20}$/.test(String(guild.id))) throw new Error('A valid Discord server is required.');
    const [fetchedRoles, fetchedChannels] = await Promise.all([guild.roles.fetch(), guild.channels.fetch()]);
    const roles = [...fetchedRoles.values()]
        .filter(role => !role.managed && role.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map(role => ({
            id: role.id,
            name: role.name,
            position: role.position,
            color: role.hexColor,
            hoist: role.hoist,
            permissions: role.permissions.bitfield.toString()
        }));
    const getOverwrites = channel => [...channel.permissionOverwrites.cache.values()].map(overwrite => ({
        id: overwrite.id,
        type: overwrite.type,
        allow: overwrite.allow.bitfield.toString(),
        deny: overwrite.deny.bitfield.toString()
    }));
    const categories = [...fetchedChannels.values()]
        .filter(channel => channel.type === ChannelType.GuildCategory)
        .map(channel => ({ id: channel.id, name: channel.name, overwrites: getOverwrites(channel) }));
    const categoryNames = new Map(categories.map(category => [category.id, category.name]));
    const channels = [];
    let totalArchivedMessages = 0;
    const sortedChannels = [...fetchedChannels.values()]
        .filter(channel => channel.type !== ChannelType.GuildCategory)
        .sort((a, b) => String(a.parentId || '').localeCompare(String(b.parentId || '')));
    for (const channel of sortedChannels) {
        const messages = channel.isTextBased() ? await fetchChannelMessageArchive(channel, 50) : [];
        totalArchivedMessages += messages.length;
        channels.push({
            id: channel.id,
            name: channel.name,
            category: categoryNames.get(channel.parentId) || null,
            parentId: channel.parentId,
            type: channel.type,
            topic: channel.topic || '',
            nsfw: Boolean(channel.nsfw),
            rateLimitPerUser: channel.rateLimitPerUser || 0,
            userLimit: channel.userLimit || 0,
            overwrites: getOverwrites(channel),
            messages
        });
        if (channel.isTextBased()) await delay(100);
    }
    return {
        format: 'starry-server-backup',
        version: 1,
        server: { id: guild.id, name: guild.name },
        createdAt: new Date().toISOString(),
        summary: { roles: roles.length, categories: categories.length, channels: channels.length, archivedMessages: totalArchivedMessages },
        roles,
        categories,
        channels
    };
}

async function createBackupAttachment(guild) {
    const payload = await executeServerFullBackup(guild);
    const json = JSON.stringify(payload, null, 2);
    if (Buffer.byteLength(json, 'utf8') > 24 * 1024 * 1024) {
        throw new Error('This backup exceeds Discord upload limits. Reduce archived channel history and retry.');
    }
    const file = new AttachmentBuilder(Buffer.from(json, 'utf8'), {
        name: 'Starry_Backup_' + guild.id + '_' + Date.now() + '.json'
    });
    const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('Starry server backup created')
        .setDescription('A JSON snapshot of the server structure and accessible recent message history is attached.')
        .addFields(
            { name: 'Roles', value: String(payload.summary.roles), inline: true },
            { name: 'Categories', value: String(payload.summary.categories), inline: true },
            { name: 'Channels', value: String(payload.summary.channels), inline: true },
            { name: 'Messages archived', value: String(payload.summary.archivedMessages), inline: true }
        )
        .setFooter({ text: 'This file is an export; automatic restore is not available.' })
        .setTimestamp();
    return { file, embed, payload };
}

function buildBackupChoiceComponents(guildId, userId) {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(BACKUP_CHOICE_PREFIX + ':automatic:' + guildId + ':' + userId)
            .setLabel('Enable daily automatic backups')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(BACKUP_CHOICE_PREFIX + ':manual:' + guildId + ':' + userId)
            .setLabel('Manual ,backup command only')
            .setStyle(ButtonStyle.Secondary)
    )];
}

async function saveBackupMode(guildId, mode, channelId) {
    if (!['automatic', 'manual'].includes(mode)) throw new Error('Unsupported backup mode.');
    return ServerSettings.findOneAndUpdate(
        { guildId: String(guildId) },
        { $set: { 'backup.enabled': mode === 'automatic', 'backup.mode': mode, 'backup.channelId': String(channelId) } },
        { upsert: true, new: true, runValidators: true }
    );
}

async function runAutomaticBackups(client) {
    const settings = await ServerSettings.find({ 'backup.enabled': true, 'backup.mode': 'automatic' }).lean();
    for (const setting of settings) {
        const guild = client.guilds.cache.get(String(setting.guildId));
        if (!guild || !setting.backup?.channelId) continue;
        const channel = guild.channels.cache.get(String(setting.backup.channelId));
        const botMember = guild.members.me;
        const permissions = channel && botMember ? channel.permissionsFor(botMember) : null;
        if (!channel?.isTextBased() || !permissions?.has(PermissionFlagsBits.SendMessages) || !permissions.has(PermissionFlagsBits.AttachFiles)) {
            console.warn('[BackupEngine] Automatic backup skipped: configured channel is unavailable or permissions are missing for guild', guild.id);
            continue;
        }
        try {
            const { file, embed } = await createBackupAttachment(guild);
            await channel.send({ embeds: [embed], files: [file] });
            await ServerSettings.updateOne(
                { guildId: guild.id, 'backup.mode': 'automatic', 'backup.enabled': true },
                { $set: { 'backup.lastRunAt': new Date() } }
            );
        } catch (error) {
            console.error('[BackupEngine] Automatic backup failed for guild ' + guild.id + ':', error.message);
        }
    }
}

module.exports = client => {
    if (schedulerStarted) return;
    schedulerStarted = true;

    client.on(Events.InteractionCreate || 'interactionCreate', async interaction => {
        if (!interaction.isButton?.() || !interaction.customId.startsWith(BACKUP_CHOICE_PREFIX + ':')) return;
        const [, mode, guildId, ownerId] = interaction.customId.split(':');
        if (!interaction.guild || interaction.guild.id !== guildId || interaction.user.id !== ownerId) {
            return interaction.reply({ content: 'This backup setup belongs to another administrator.', ephemeral: true }).catch(() => {});
        }
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'Administrator permission is required to change backup settings.', ephemeral: true }).catch(() => {});
        }
        try {
            await saveBackupMode(guildId, mode, interaction.channelId);
            const message = mode === 'automatic'
                ? 'Daily automatic backups are enabled. Starry will post a backup in this channel every 24 hours. Use ,backup any time for an extra manual snapshot.'
                : 'Automatic backups are disabled. Starry will create a backup only when an administrator runs ,backup.';
            await interaction.update({ content: '✅ ' + message, components: [] });
        } catch (error) {
            console.error('[BackupEngine] Could not save backup preference:', error.message);
            await interaction.reply({ content: 'Could not save this backup preference. Please try again later.', ephemeral: true }).catch(() => {});
        }
    });

    client.once(Events.ClientReady || 'clientReady', () => {
        console.log('[BackupEngine] Per-server opt-in backup scheduler ready.');
        runAutomaticBackups(client).catch(error => console.error('[BackupEngine] Initial scheduled run failed:', error.message));
        setInterval(() => {
            runAutomaticBackups(client).catch(error => console.error('[BackupEngine] Scheduled run failed:', error.message));
        }, AUTOMATIC_INTERVAL_MS);
    });
};

module.exports.executeServerFullBackup = executeServerFullBackup;
module.exports.createBackupAttachment = createBackupAttachment;
module.exports.buildBackupChoiceComponents = buildBackupChoiceComponents;
module.exports.saveBackupMode = saveBackupMode;
