const { ChannelType, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'vcData.json');

module.exports = (client) => {
    function getVcData() {
        if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({ setups: {}, activeVCs: [] }));
        return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    }

    function saveVcData(data) {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    }

    // ==========================================
    // 1. SETUP COMMAND
    // ==========================================
    client.on('ready', async () => {
        try {
            await client.application.commands.create({
                name: 'setupvc',
                description: 'Set a "Join to Create" voice channel hub (Admin Only)',
                default_member_permissions: '8',
                options: [{ name: 'channel', description: 'The hub voice channel', type: 7, channel_types: [2], required: true }]
            });
            console.log('✅ Dynamic Voice Channel Manager Loaded');
        } catch (err) {}
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'setupvc') return;
        
        const channel = interaction.options.getChannel('channel');
        const data = getVcData();
        
        data.setups[interaction.guild.id] = channel.id;
        saveVcData(data);

        await interaction.reply({ content: `✅ Successfully set <#${channel.id}> as the "Join to Create" hub! When users join it, I will make them a custom VC.`, ephemeral: true });
    });

    // ==========================================
    // 2. AUTO-CREATE AND AUTO-DELETE VCs
    // ==========================================
    client.on('voiceStateUpdate', async (oldState, newState) => {
        const data = getVcData();
        const hubChannelId = data.setups[newState.guild.id];

        // USER JOINS THE HUB CHANNEL (Create VC)
        if (newState.channelId === hubChannelId && hubChannelId !== null) {
            try {
                const member = newState.member;
                const parentCategory = newState.channel.parentId;

                // Create a temporary channel for the user
                const tempChannel = await newState.guild.channels.create({
                    name: `${member.user.username}'s Lounge`,
                    type: ChannelType.GuildVoice,
                    parent: parentCategory,
                    permissionOverwrites: [
                        {
                            id: newState.guild.id, // @everyone
                            allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak]
                        },
                        {
                            id: member.id, // The creator gets full control
                            allow: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.MuteMembers, PermissionsBitField.Flags.DeafenMembers]
                        }
                    ]
                });

                // Move the user into their new channel
                await member.voice.setChannel(tempChannel);

                // Save to database so we know this is a temporary channel
                data.activeVCs.push(tempChannel.id);
                saveVcData(data);
            } catch (err) {
                console.log("Failed to create temporary VC:", err.message);
            }
        }

        // USER LEAVES A TEMPORARY CHANNEL (Delete VC if empty)
        if (oldState.channelId && oldState.channelId !== newState.channelId) {
            if (data.activeVCs.includes(oldState.channelId)) {
                const channel = oldState.guild.channels.cache.get(oldState.channelId);
                
                // If the channel exists and is now completely empty
                if (channel && channel.members.size === 0) {
                    try {
                        await channel.delete();
                        // Remove from active list
                        data.activeVCs = data.activeVCs.filter(id => id !== oldState.channelId);
                        saveVcData(data);
                    } catch (err) {
                        console.log("Failed to delete empty temporary VC.");
                    }
                }
            }
        }
    });
};
