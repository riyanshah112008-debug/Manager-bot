const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const Database = require('better-sqlite3');

// Create a small database just to remember which channel to use
const db = new Database('welcome.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS welcome_settings (
        guild_id TEXT PRIMARY KEY,
        channel_id TEXT
    )
`);

const getWelcome = db.prepare('SELECT channel_id FROM welcome_settings WHERE guild_id = ?');
const setWelcome = db.prepare(`
    INSERT INTO welcome_settings (guild_id, channel_id) 
    VALUES (?, ?) 
    ON CONFLICT(guild_id) DO UPDATE SET channel_id = ?
`);

module.exports = (client) => {
    // 1. Create the Setup Slash Command
    client.on('clientReady', async () => {
        try {
            await client.application.commands.create({
                name: 'setwelcome',
                description: 'Set the channel where Starry will send welcome messages',
                default_member_permissions: '8', // Only Administrators can use this
                options: [
                    {
                        name: 'channel',
                        description: 'The channel to send welcome embeds to',
                        type: 7, // Type 7 represents a Channel
                        required: true
                    }
                ]
            });
            console.log('✅ Welcome Slash Command Added');
        } catch (error) {
            console.error('❌ Failed to add welcome slash command:', error);
        }
    });

    // 2. Handle the Setup Command
    client.on('interactionCreate', async interaction => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'setwelcome') {
            const channel = interaction.options.getChannel('channel');
            
            // Save the channel ID to the database
            setWelcome.run(interaction.guildId, channel.id, channel.id);
            
            return interaction.reply({ 
                content: `🎉 Success! I will now welcome all new members in ${channel}!`, 
                ephemeral: true 
            }).catch(() => {});
        }
    });

    // 3. The Welcome Event Trigger
    client.on('guildMemberAdd', async member => {
        // Check if this server has set up a welcome channel
        const setting = getWelcome.get(member.guild.id);
        if (!setting || !setting.channel_id) return;

        // Find the actual channel in the server
        const welcomeChannel = member.guild.channels.cache.get(setting.channel_id);
        if (!welcomeChannel) return; // If the channel was deleted, do nothing

        // Build the Welcome Embed
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#7289DA')
            .setTitle(`✨ Welcome to ${member.guild.name}! ✨`)
            .setDescription(`Hello <@${member.id}>, we are so glad you joined the server! Be sure to read the rules and enjoy your stay.`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '👤 Member Count', value: `You are member **#${member.guild.memberCount}**!`, inline: true },
                { name: '📅 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
            )
            // Updated with your specific image URL
            .setImage('https://cdn.discordapp.com/attachments/1508799648154779772/1515357119564742847/lv_0_20260519173542.jpg?ex=6a47c24b&is=6a4670cb&hm=309e462cd4c198ffe6667d605b32750ef439d0f81e86393c9a5448c69602087d&') 
            .setFooter({ text: 'Enjoy your stay!', iconURL: member.guild.iconURL() })
            .setTimestamp();

        // Send the message
        welcomeChannel.send({ 
            content: `Hey <@${member.id}>! 👋`, 
            embeds: [welcomeEmbed] 
        }).catch(err => console.error("Could not send welcome message:", err));
    });
};
