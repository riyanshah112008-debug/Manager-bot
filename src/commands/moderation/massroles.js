const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

const data = new SlashCommandBuilder()
    .setName('massroles')
    .setDescription('Bulk add or remove a role from server members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub => sub.setName('add').setDescription('Add a role to selected members')
        .addRoleOption(option => option.setName('role').setDescription('Role to add').setRequired(true))
        .addStringOption(option => option.setName('members').setDescription('Who should receive the role').setRequired(true)
            .addChoices({ name: 'Everyone', value: 'all' }, { name: 'Humans only', value: 'humans' }, { name: 'Bots only', value: 'bots' })))
    .addSubcommand(sub => sub.setName('remove').setDescription('Remove a role from selected members')
        .addRoleOption(option => option.setName('role').setDescription('Role to remove').setRequired(true))
        .addStringOption(option => option.setName('members').setDescription('Who should lose the role').setRequired(true)
            .addChoices({ name: 'Everyone', value: 'all' }, { name: 'Humans only', value: 'humans' }, { name: 'Bots only', value: 'bots' })));

module.exports = {
    name: 'massroles',
    aliases: ['massrole', 'roleall'],
    category: 'Moderation',
    description: 'Bulk add or remove a role from all members, humans, or bots.',
    usage: ',massroles <add|remove> <all|humans|bots> @role',
    data,
    async execute(ctx) {
        const interaction = ctx.interaction || (typeof ctx.isChatInputCommand === 'function' && ctx.isChatInputCommand() ? ctx : null);
        const isSlash = Boolean(interaction);
        const guild = ctx.guild || interaction?.guild;
        const member = ctx.member || interaction?.member;
        const user = ctx.user || interaction?.user;
        if (!guild) return ctx.reply('This command can only be used inside a server.');
        if (!member?.permissions?.has(PermissionFlagsBits.ManageRoles) && !config.BOT_OWNERS.includes(user?.id)) {
            return ctx.reply('You need the Manage Roles permission to use this command.');
        }
        const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
        if (!botMember?.permissions?.has(PermissionFlagsBits.ManageRoles)) return ctx.reply('Starry needs the Manage Roles permission.');
        let action, audience, role;
        if (isSlash) {
            const options = interaction.options;
            action = options.getSubcommand();
            audience = options.getString('members');
            role = options.getRole('role');
        } else {
            action = (ctx.args?.[0] || '').toLowerCase();
            audience = (ctx.args?.[1] || '').toLowerCase();
            const roleId = ctx.message?.mentions?.roles?.first()?.id || ctx.args?.slice(2).join(' ').replace(/[^0-9]/g, '') || '';
            role = guild.roles.cache.get(roleId) || guild.roles.cache.find(r => r.name.toLowerCase() === ctx.args?.slice(2).join(' ').toLowerCase());
        }
        if (!['add', 'remove'].includes(action) || !['all', 'humans', 'bots'].includes(audience) || !role) {
            return ctx.reply('Usage: /massroles add|remove with a role and member group (Everyone, Humans, or Bots). Prefix: ,massroles add|remove all|humans|bots @role.');
        }
        if (role.id === guild.id || role.managed || role.position >= botMember.roles.highest.position) {
            return ctx.reply('That role is managed, everyone, or above Starry in the role hierarchy.');
        }
        if (!isSlash && role.position >= member.roles.highest.position && guild.ownerId !== user.id && !config.BOT_OWNERS.includes(user.id)) {
            return ctx.reply('You cannot modify a role at or above your highest role.');
        }
        if (ctx.isSlash) await interaction.deferReply({ ephemeral: true });
        else await ctx.reply('⏳ Fetching members and applying the role. This may take a while.');
        const members = await guild.members.fetch();
        let changed = 0, skipped = 0, failed = 0;
        for (const target of members.values()) {
            if (audience === 'humans' && target.user.bot) continue;
            if (audience === 'bots' && !target.user.bot) continue;
            const hasRole = target.roles.cache.has(role.id);
            if ((action === 'add' && hasRole) || (action === 'remove' && !hasRole)) { skipped++; continue; }
            if (target.id === guild.ownerId || target.roles.highest.position >= botMember.roles.highest.position) { skipped++; continue; }
            try {
                if (action === 'add') await target.roles.add(role, 'Starry mass role command');
                else await target.roles.remove(role, 'Starry mass role command');
                changed++;
            } catch (_) { failed++; }
        }
        const summary = 'Mass role operation complete\n' +
            (action === 'add' ? 'Added' : 'Removed') + ' <@&' + role.id + '> ' +
            (action === 'add' ? 'to' : 'from') + ' ' + changed + ' members.\n' +
            'Skipped: ' + skipped + ' · Failed: ' + failed;
        if (isSlash) return interaction.editReply({ content: summary, allowedMentions: { parse: [] } });
        return guild.channels.cache.get(ctx.channel?.id)?.send({ content: summary, allowedMentions: { parse: [] } });
    }
};
