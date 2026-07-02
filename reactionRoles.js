const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'rrData.json');

module.exports = (client) => {
    const PREFIX = '.';

    function getRRData() {
        if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify([]));
        return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    }

    function saveRRData(data) {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    }

    // ==========================================
    // 1. SETUP COMMAND (Slash & Prefix)
    // ==========================================
    client.on('ready', async () => {
        try {
            await client.application.commands.create({
                name: 'rrsetup',
                description: 'Create a Reaction Role message (Admin Only)',
                default_member_permissions: '8',
                options: [
                    { name: 'channel', description: 'Where to send the message', type: 7, required: true },
                    { name: 'role', description: 'The role to give', type: 8, required: true },
                    { name: 'emoji', description: 'The emoji to react with (e.g. 🍎)', type: 3, required: true },
                    { name: 'text', description: 'The message text', type: 3, required: true }
                ]
            });
            console.log('✅ Reaction Roles Module Loaded');
        } catch (err) {}
    });

    async function createReactionRole(channel, role, emoji, text) {
        try {
            const embed = new EmbedBuilder()
                .setColor('Blurple')
                .setTitle('Self-Assign Role')
                .setDescription(`${text}\n\nReact with ${emoji} to get the <@&${role.id}> role!`);

            const msg = await channel.send({ embeds: [embed] });
            await msg.react(emoji);

            const rrData = getRRData();
            rrData.push({
                messageId: msg.id,
                channelId: channel.id,
                guildId: channel.guild.id,
                roleId: role.id,
                emoji: emoji
            });
            saveRRData(rrData);
            return '✅ Reaction Role created successfully!';
        } catch (err) {
            return `❌ Failed to create reaction role. Make sure my role is HIGHER than the role I am trying to give, and the emoji is valid.`;
        }
    }

    // Slash Command
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'rrsetup') return;
        const channel = interaction.options.getChannel('channel');
        const role = interaction.options.getRole('role');
        const emoji = interaction.options.getString('emoji');
        const text = interaction.options.getString('text');

        const response = await createReactionRole(channel, role, emoji, text);
        await interaction.reply({ content: response, ephemeral: true }).catch(() => {});
    });

    // ==========================================
    // 2. ASSIGN / REMOVE ROLES ON REACTION
    // ==========================================
    client.on('messageReactionAdd', async (reaction, user) => {
        if (user.bot) return;
        if (reaction.partial) await reaction.fetch().catch(() => {});
        if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

        const rrData = getRRData();
        const rr = rrData.find(r => r.messageId === reaction.message.id && (r.emoji === reaction.emoji.name || r.emoji === `<:${reaction.emoji.name}:${reaction.emoji.id}>`));
        
        if (rr) {
            const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
            if (member) await member.roles.add(rr.roleId).catch(() => {});
        }
    });

    client.on('messageReactionRemove', async (reaction, user) => {
        if (user.bot) return;
        if (reaction.partial) await reaction.fetch().catch(() => {});
        if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

        const rrData = getRRData();
        const rr = rrData.find(r => r.messageId === reaction.message.id && (r.emoji === reaction.emoji.name || r.emoji === `<:${reaction.emoji.name}:${reaction.emoji.id}>`));
        
        if (rr) {
            const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
            if (member) await member.roles.remove(rr.roleId).catch(() => {});
        }
    });
};
