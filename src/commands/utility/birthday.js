const { SlashCommandBuilder } = require('discord.js');
const Birthday = require('../../models/Birthday');

function parseDate(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
    return { month, day };
}

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
    usage: ',birthday set YYYY-MM-DD | ,birthday remove',
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('Privately manage your birthday')
        .setContexts([0]).setIntegrationTypes([0])
        .addSubcommand(sub => sub.setName('set').setDescription('Privately save your birthday (year is discarded)')
            .addStringOption(option => option.setName('date').setDescription('Birthday in YYYY-MM-DD format').setRequired(true)))
        .addSubcommand(sub => sub.setName('remove').setDescription('Privately remove your saved birthday')),
    async execute(ctx) {
        if (!ctx.guild) return privateReply(ctx, 'Birthday settings are only available inside a server.');
        const sub = ctx.isSlash ? ctx.interaction.options.getSubcommand() : (ctx.args[0] || '').toLowerCase();
        if (sub === 'set' || sub === 'add') {
            const rawDate = ctx.isSlash ? ctx.interaction.options.getString('date') : ctx.args[1];
            const parsed = parseDate(rawDate);
            if (!parsed) return privateReply(ctx, 'Please use a real date in YYYY-MM-DD format. Your date is handled privately and the year is discarded.');
            await Birthday.findOneAndUpdate(
                { guildId: ctx.guild.id, userId: ctx.user.id },
                { $set: { ...parsed, lastAnnouncedDate: '', birthdayRoleGrantedDate: '', birthdayRoleId: '' } },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            return privateReply(ctx, '🎂 Your birthday is saved privately! Starry will celebrate you on your special day. Your birth year is not stored, and your date will never appear in a public birthday list.');
        }
        if (sub === 'remove' || sub === 'delete') {
            const result = await Birthday.deleteOne({ guildId: ctx.guild.id, userId: ctx.user.id });
            return privateReply(ctx, result.deletedCount ? '💗 Your saved birthday has been privately removed.' : 'You do not have a saved birthday in this server.');
        }
        return privateReply(ctx, 'Use the birthday set command to save your birthday privately, or birthday remove to delete it. Starry never publishes birthday dates or lists.');
    }
};
