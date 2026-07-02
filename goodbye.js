const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const Database = require('better-sqlite3');

// Create a database to remember the goodbye channel
const db = new Database('goodbye.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS goodbye_settings (
        guild_id TEXT PRIMARY KEY,
        channel_id TEXT
    )
`);

const getGoodbye = db.prepare('SELECT channel_id FROM goodbye_settings WHERE guild_id = ?');
const setGoodbye = db.prepare(`
    INSERT INTO goodbye_settings (guild_id, channel_id) 
    VALUES (?, ?) 
    ON CONFLICT(guild_id) DO UPDATE SET channel_id = ?
`);

module.exports = (client) => {
    // 1. Create the Setup Slash Command
    client.on('clientReady', async () => {
        try {
            await client.application.commands.create({
                name: 'setgoodbye',
                description: 'Set the channel where Starry will send goodbye messages',
                default_member_permissions: '8', // Administrators only
                options: [
                    {
                        name: 'channel',
                        description: 'The channel to send goodbye embeds to',
                        type: 7, 
                        required: true
                    }
                ]
            });
            console.log('✅ Goodbye Slash Command Added');
        } catch (error) {
            console.error('❌ Failed to add goodbye slash command:', error);
        }
    });

    // 2. Handle the Setup Command
    client.on('interactionCreate', async interaction => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'setgoodbye') {
            const channel = interaction.options.getChannel('channel');
            
            setGoodbye.run(interaction.guildId, channel.id, channel.id);
            
            return interaction.reply({ 
                content: `👋 Success! I will now send goodbye messages to ${channel}!`, 
                ephemeral: true 
            }).catch(() => {});
        }
    });

    // 3. The Goodbye Event Trigger
    client.on('guildMemberRemove', async member => {
        const setting = getGoodbye.get(member.guild.id);
        if (!setting || !setting.channel_id) return;

        const goodbyeChannel = member.guild.channels.cache.get(setting.channel_id);
        if (!goodbyeChannel) return; 

        // Build the Goodbye Embed
        const goodbyeEmbed = new EmbedBuilder()
            .setColor('#2b2d31') // A darker color for farewells
            .setTitle(`Farewell, ${member.user.username}... 🌠`)
            .setDescription(`**${member.user.username}** has left the server. We're sad to see you go!`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '👤 Member Count', value: `We are now down to **${member.guild.memberCount}** members.`, inline: true }
            )
            // ⚠️ REPLACE THIS LINK WITH YOUR NEW GOODBYE IMAGE ⚠️
            .setImage('https://cdn.discordapp.com/attachments/1508799648154779772/1515357119564742847/lv_0_20260519173542.jpg?ex=6a47c24b&is=6a4670cb&hm=309e462cd4c198ffe6667d605b32750ef439d0f81e86393c9a5448c69602087d&') 
            .setFooter({ text: 'May our paths cross again!', iconURL: member.guild.iconURL() })
            .setTimestamp();

        // Send the message
        goodbyeChannel.send({ 
            content: `Goodbye, **${member.user.username}**. 🕊️`, 
            embeds: [goodbyeEmbed] 
        }).catch(err => console.error("Could not send goodbye message:", err));
    });
};
