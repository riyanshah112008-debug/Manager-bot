const { ChannelType, PermissionsBitField } = require('discord.js');
const mongoStore = require('../utils/mongoStore');

module.exports = (client) => {
    async function getVcData(guildId) {
        const record = await mongoStore.get('voice_manager', String(guildId));
        return record?.data || { hubChannelId: null, activeVCs: [] };
    }

    async function updateVcData(guildId, changes) {
        const current = await mongoStore.get('voice_manager', String(guildId));
        if (!current) {
            return mongoStore.put('voice_manager', String(guildId), {
                hubChannelId: null, activeVCs: [], ...changes
            }, { expectedRevision: 0 });
        }
        return mongoStore.patch('voice_manager', String(guildId), changes, {
            expectedRevision: current.revision
        });
    }

    // ==========================================
    // 1. SLASH COMMANDS
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'setupvc') return;
        
        // 🛑 Premium Lock
        if (!client.isPremium(interaction.guildId)) {
            return interaction.reply({ content: '❌ **Join-to-Create VC is a Premium feature!** Use `.premium` to upgrade.', ephemeral: true });
        }

        const channel = interaction.options.getChannel('channel');
        await updateVcData(interaction.guild.id, { hubChannelId: channel.id });

        await interaction.reply({ content: `✅ Successfully set <#${channel.id}> as the "Join to Create" hub!`, ephemeral: true });
    });

    // ==========================================
    // 2. DYNAMIC CHANNEL LOGIC
    // ==========================================
    client.on('voiceStateUpdate', async (oldState, newState) => {
        const guildId = newState.guild?.id || oldState.guild?.id;
        if (!guildId) return;
        const data = await getVcData(guildId);
        const hubChannelId = data.hubChannelId;

        // USER JOINS HUB
        if (newState.channelId === hubChannelId && hubChannelId !== null) {
            try {
                const member = newState.member;
                const tempChannel = await newState.guild.channels.create({
                    name: `${member.user.username}'s Lounge`,
                    type: ChannelType.GuildVoice,
                    parent: newState.channel.parentId,
                    permissionOverwrites: [
                        { id: newState.guild.id, allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak] },
                        { id: member.id, allow: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.MuteMembers, PermissionsBitField.Flags.DeafenMembers] }
                    ]
                });

                await member.voice.setChannel(tempChannel);
                await updateVcData(guildId, { activeVCs: [...new Set([...(data.activeVCs || []), tempChannel.id])] });
            } catch (err) { console.error("VC Create Error:", err.message); }
        }

        // USER LEAVES TEMPORARY CHANNEL
        if (oldState.channelId && oldState.channelId !== newState.channelId) {
            if ((data.activeVCs || []).includes(oldState.channelId)) {
                const channel = oldState.guild.channels.cache.get(oldState.channelId);
                if (channel && channel.members.size === 0) {
                    try {
                        await channel.delete();
                        await updateVcData(guildId, { activeVCs: (data.activeVCs || []).filter(id => id !== oldState.channelId) });
                    } catch (err) { console.error("VC Delete Error:", err.message); }
                }
            }
        }
    });
};
    
