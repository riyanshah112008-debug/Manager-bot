const { SlashCommandBuilder, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Birthday = require('../../models/Birthday');

async function privateReply(ctx, content) {
    if (ctx.isSlash && ctx.interaction) {
        const interaction = ctx.interaction;
        if (interaction.deferred || interaction.replied) return interaction.followUp({ content, ephemeral: true });
        return interaction.reply({ content, ephemeral: true });
    }
    try {
        await ctx.user.send(content);
        return ctx.message?.reply('📩 I sent you a private birthday update. Your date will never be posted publicly.');
    } catch (_) {
        return ctx.message?.reply('🔒 I could not DM you. Please enable server-member DMs, then try again. Your birthday was not shown in this channel.');
    }
}

module.exports = {
    name: 'birthday',
    aliases: ['bday'],
    category: 'Social',
    description: 'Privately save or remove your birthday. Starry celebrates without revealing the date.',
    usage: '/birthday set (opens a private form) | /birthday remove',
    autoDefer: false,
    ephemeral: true,
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('Privately manage your birthday')
        .setContexts([0]).setIntegrationTypes([0])
        .addSubcommand(sub => sub.setName('set').setDescription('Open a private form to save your birthday (year is discarded)'))
        .addSubcommand(sub => sub.setName('remove').setDescription('Privately remove your saved birthday')),
    async execute(ctx) {
        if (!ctx.guild) return privateReply(ctx, 'Birthday settings are only available inside a server.');
        const sub = ctx.isSlash ? ctx.interaction.options.getSubcommand() : (ctx.args[0] || '').toLowerCase();
        if (sub === 'set' || sub === 'add') {
            if (!ctx.isSlash) return privateReply(ctx, 'For privacy, use /birthday set. It opens a private form so your date is never posted in the channel.');
            const modal = new ModalBuilder()
                .setCustomId('starry_birthday_set')
                .setTitle('Your private birthday')
                .addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('birthday_date')
                        .setLabel('Birthday (YYYY-MM-DD)')
                        .setPlaceholder('2008-09-24')
                        .setStyle(TextInputStyle.Short)
                        .setMinLength(10)
                        .setMaxLength(10)
                        .setRequired(true)
                ));
            return ctx.interaction.showModal(modal);
        }
        if (sub === 'remove' || sub === 'delete') {
            const birthdayFilter = { guildId: ctx.guild.id, userId: ctx.user.id };
            const existingBirthday = await Birthday.findOne(birthdayFilter).lean();
            if (!existingBirthday) return privateReply(ctx, 'You do not have a saved birthday in this server.');
            if (existingBirthday.birthdayRoleId) {
                try {
                    const { removeBirthdayRoleAssignment } = require('../../modules/birthdayEngine');
                    await removeBirthdayRoleAssignment(ctx.guild, existingBirthday, 'Member removed their birthday');
                } catch (error) {
                    console.warn('[Birthday] Could not remove the assigned role before deleting the birthday:', error.message);
                    return privateReply(ctx, 'I could not safely remove your temporary birthday role. Your birthday is still saved; please try again shortly.');
                }
            }
            const result = await Birthday.deleteOne(birthdayFilter);
            return privateReply(ctx, result.deletedCount ? '💗 Your saved birthday has been privately removed.' : 'You do not have a saved birthday in this server.');
        }
        return privateReply(ctx, 'Use the birthday set command to save your birthday privately, or birthday remove to delete it. Starry never publishes birthday dates or lists.');
    }
};
