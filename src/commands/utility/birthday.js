const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Birthday = require('../../models/Birthday');

function parseDate(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
    return { month, day };
}

module.exports = {
    name: 'birthday',
    aliases: ['bday', 'birthdays'],
    category: 'Social',
    description: 'Set, view, or remove your birthday and see upcoming server birthdays.',
    usage: ',birthday set YYYY-MM-DD | ,birthday view [@member] | ,birthday list | ,birthday remove',
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('Manage your birthday and view server birthdays')
        .setContexts([0]).setIntegrationTypes([0])
        .addSubcommand(sub => sub.setName('set').setDescription('Save your birthday (year is not stored)')
            .addStringOption(option => option.setName('date').setDescription('Birthday in YYYY-MM-DD format').setRequired(true)))
        .addSubcommand(sub => sub.setName('view').setDescription('View your birthday or another member’s')
            .addUserOption(option => option.setName('member').setDescription('Member to look up').setRequired(false)))
        .addSubcommand(sub => sub.setName('list').setDescription('List birthdays saved in this server'))
        .addSubcommand(sub => sub.setName('remove').setDescription('Remove your saved birthday')),
    async execute(ctx) {
        if (!ctx.guild) return ctx.reply('Birthday commands are only available inside a server.');
        const sub = ctx.isSlash ? ctx.interaction.options.getSubcommand() : (ctx.args[0] || 'view').toLowerCase();
        const target = ctx.isSlash ? (ctx.interaction.options.getUser('member') || ctx.user) : (ctx.message?.mentions?.users?.first() || ctx.user);
        if (sub === 'set' || sub === 'add') {
            const rawDate = ctx.isSlash ? ctx.interaction.options.getString('date') : ctx.args[1];
            const parsed = parseDate(rawDate);
            if (!parsed) return ctx.reply('Please use a real date in YYYY-MM-DD format, for example: `,birthday set 2008-09-24`. The year is not stored.');
            await Birthday.findOneAndUpdate({ guildId: ctx.guild.id, userId: ctx.user.id }, { $set: { ...parsed, lastAnnouncedDate: '' } }, { upsert: true, new: true, setDefaultsOnInsert: true });
            return ctx.reply('🎂 Your birthday is saved as **' + String(parsed.day).padStart(2, '0') + '/' + String(parsed.month).padStart(2, '0') + '**. Your birth year is not stored.');
        }
        if (sub === 'remove' || sub === 'delete') {
            const result = await Birthday.deleteOne({ guildId: ctx.guild.id, userId: ctx.user.id });
            return ctx.reply(result.deletedCount ? 'Your saved birthday has been removed.' : 'You do not have a birthday saved in this server.');
        }
        if (sub === 'list') {
            const rows = await Birthday.find({ guildId: ctx.guild.id }).sort({ month: 1, day: 1 }).limit(50).lean();
            if (!rows.length) return ctx.reply('No birthdays are saved in this server yet.');
            const embed = new EmbedBuilder().setColor('#F472B6').setTitle('🎂 Server Birthdays')
                .setDescription(rows.map(row => '• <@' + row.userId + '> — **' + String(row.day).padStart(2, '0') + '/' + String(row.month).padStart(2, '0') + '**').join('\n'))
                .setFooter({ text: 'Birth years are never stored • Showing up to 50 members' });
            return ctx.reply({ embeds: [embed] });
        }
        if (sub === 'view') {
            const row = await Birthday.findOne({ guildId: ctx.guild.id, userId: target.id }).lean();
            if (!row) return ctx.reply(target.id === ctx.user.id ? 'You have not saved a birthday yet. Use `,birthday set YYYY-MM-DD`.' : 'That member has not shared a birthday in this server.');
            return ctx.reply('🎂 **' + (target.id === ctx.user.id ? 'Your' : target.username + '’s') + ' birthday:** ' + String(row.day).padStart(2, '0') + '/' + String(row.month).padStart(2, '0'));
        }
        return ctx.reply('Use `,birthday set YYYY-MM-DD`, `,birthday view`, `,birthday list`, or `,birthday remove`.');
    }
};
