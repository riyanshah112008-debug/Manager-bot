// ==========================================
// 🎙️ STARRY DYNAMIC ORBIT VOICE ENGINE (Join-to-Create)
// Premium Join-to-Create • Private Rooms • Owner Access Controls
// ==========================================
const {
    Events,
    ChannelType,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const TempVoiceConfig = require('../models/TempVoiceConfig');
const config = require('../config');

const activeTempChannels = new Map();
const premiumNoticeSent = new Set();

function hasPremium(client, guildId) {
    return typeof client.isPremium === 'function' && client.isPremium(guildId);
}

function getControlPermission(interaction, channelId) {
    const data = activeTempChannels.get(channelId);
    const isOwner = data && data.ownerId === interaction.user.id;
    const isAdmin = interaction.member?.permissions?.has(PermissionFlagsBits.ManageChannels);
    return Boolean(isOwner || isAdmin);
}

async function replyError(interaction, content) {
    if (interaction.deferred || interaction.replied) {
        return interaction.followUp({ content, ephemeral: true }).catch(() => {});
    }
    return interaction.reply({ content, ephemeral: true }).catch(() => {});
}

function initTempVoice(client) {
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        try {
            const guild = newState.guild || oldState.guild;
            if (!guild) return;

            if (newState.channelId && newState.channelId !== oldState.channelId) {
                const conf = await TempVoiceConfig.findOne({ guildId: guild.id, enabled: true });
                if (conf && conf.lobbyChannelId === newState.channelId) {
                    if (!hasPremium(client, guild.id)) {
                        if (!premiumNoticeSent.has(guild.id)) {
                            premiumNoticeSent.add(guild.id);
                            const systemChannel = guild.systemChannel;
                            if (systemChannel?.isTextBased()) {
                                systemChannel.send('💎 Join-to-Create voice rooms are available to Starry Premium servers.').catch(() => {});
                            }
                        }
                        return;
                    }

                    const member = newState.member;
                    if (!member) return;
                    const channelName = conf.namingPattern.replace('{user}', member.displayName || member.user.username);
                    const parentCategory = conf.categoryId || newState.channel.parentId;
                    const newChannel = await guild.channels.create({
                        name: channelName,
                        type: ChannelType.GuildVoice,
                        parent: parentCategory,
                        userLimit: conf.userLimit || 0,
                        permissionOverwrites: [
                            {
                                id: guild.roles.everyone.id,
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
                            },
                            {
                                id: member.id,
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.ManageChannels,
                                    PermissionFlagsBits.MoveMembers,
                                    PermissionFlagsBits.MuteMembers,
                                    PermissionFlagsBits.DeafenMembers,
                                    PermissionFlagsBits.Connect,
                                    PermissionFlagsBits.Speak
                                ]
                            }
                        ]
                    }).catch(error => {
                        console.warn('[Temp Voice] Channel creation failed:', error.message || error);
                        return null;
                    });

                    if (newChannel) {
                        activeTempChannels.set(newChannel.id, { ownerId: member.id, guildId: guild.id });
                        await member.voice.setChannel(newChannel).catch(() => {});

                        const embed = new EmbedBuilder()
                            .setColor(config.EMBED_COLORS.PRIMARY)
                            .setAuthor({ name: `${member.displayName}'s Starlight Orbit`, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
                            .setTitle('🎛️ Orbit Voice Control Hub')
                            .setDescription(
                                `Welcome to your voice room, <@${member.id}>! You own this channel.\n\n` +
                                '• **Lock** — stop new members from connecting\n' +
                                '• **Private** — hide the room from everyone except you and invited members\n' +
                                '• **Invite** — grant a member access by Discord mention or user ID\n' +
                                '• **Unlock** — make the room visible and joinable again\n' +
                                '• **Limit** — set Duo or Squad capacity\n' +
                                '• *The room auto-deletes when everyone leaves.*'
                            )
                            .setFooter({ text: 'Starry Premium • Dynamic Voice Rooms' });

                        const row1 = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`tempvc_lock_${newChannel.id}`).setLabel('Lock').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
                            new ButtonBuilder().setCustomId(`tempvc_unlock_${newChannel.id}`).setLabel('Unlock').setStyle(ButtonStyle.Success).setEmoji('🔓'),
                            new ButtonBuilder().setCustomId(`tempvc_private_${newChannel.id}`).setLabel('Private').setStyle(ButtonStyle.Secondary).setEmoji('🕶️'),
                            new ButtonBuilder().setCustomId(`tempvc_invite_${newChannel.id}`).setLabel('Invite').setStyle(ButtonStyle.Primary).setEmoji('➕')
                        );
                        const row2 = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`tempvc_limit2_${newChannel.id}`).setLabel('Duo (2)').setStyle(ButtonStyle.Secondary).setEmoji('👥'),
                            new ButtonBuilder().setCustomId(`tempvc_limit5_${newChannel.id}`).setLabel('Squad (5)').setStyle(ButtonStyle.Secondary).setEmoji('🎮')
                        );
                        await newChannel.send({ embeds: [embed], components: [row1, row2] }).catch(() => {});
                    }
                }
            }

            if (oldState.channelId && oldState.channelId !== newState.channelId) {
                const leftChannel = oldState.channel;
                if (leftChannel && activeTempChannels.has(leftChannel.id) && leftChannel.members.size === 0) {
                    activeTempChannels.delete(leftChannel.id);
                    await leftChannel.delete('Temp Voice Channel Empty').catch(() => {});
                }
            }
        } catch (err) {
            console.warn('[Temp Voice] Voice-state handler error:', err.message || err);
        }
    });

    client.on(Events.InteractionCreate, async (interaction) => {
        const isInviteModal = interaction.isModalSubmit?.() && interaction.customId.startsWith('tempvc_invite_');
        const isTempButton = interaction.isButton?.() && interaction.customId.startsWith('tempvc_');
        if (!isInviteModal && !isTempButton) return;

        const prefix = isInviteModal ? 'tempvc_invite_' : 'tempvc_';
        const remainder = interaction.customId.slice(prefix.length);
        const channelId = isInviteModal ? remainder : remainder.split('_').slice(1).join('_');
        const action = isInviteModal ? 'invite_submit' : remainder.split('_')[0];
        const channel = interaction.guild?.channels.cache.get(channelId);
        if (!channel) return replyError(interaction, '❌ This voice room no longer exists.');
        if (!hasPremium(client, interaction.guildId)) {
            return replyError(interaction, '💎 This control is available only while Starry Premium is active for this server.');
        }
        if (!getControlPermission(interaction, channelId)) {
            return replyError(interaction, '❌ Only the room owner or a server manager can control this voice room.');
        }

        try {
            if (action === 'invite') {
                const modal = new ModalBuilder().setCustomId(`tempvc_invite_${channelId}`).setTitle('Invite member to private VC');
                const memberInput = new TextInputBuilder()
                    .setCustomId('member_id')
                    .setLabel('Discord user mention or ID')
                    .setPlaceholder('@member or 123456789012345678')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(40);
                modal.addComponents(new ActionRowBuilder().addComponents(memberInput));
                return interaction.showModal(modal);
            }

            if (action === 'invite_submit') {
                const raw = interaction.fields.getTextInputValue('member_id').trim();
                const memberId = raw.replace(/[<@!>]/g, '');
                if (!/^\d{17,20}$/.test(memberId)) return replyError(interaction, '❌ Enter a valid Discord user mention or ID.');
                const member = await interaction.guild.members.fetch(memberId).catch(() => null);
                if (!member) return replyError(interaction, '❌ That member is not in this server.');
                await channel.permissionOverwrites.edit(member, { ViewChannel: true, Connect: true, Speak: true });
                return interaction.reply({ content: `✅ <@${member.id}> can now see and join <#${channel.id}>.`, ephemeral: true });
            }

            if (action === 'lock') {
                await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
                return interaction.reply({ content: '🔒 **Room locked:** new members cannot connect. Existing invited members retain access.', ephemeral: true });
            }
            if (action === 'unlock') {
                await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: true, Connect: true });
                return interaction.reply({ content: '🔓 **Room unlocked:** the room is visible and joinable by everyone.', ephemeral: true });
            }
            if (action === 'private') {
                await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false, Connect: false });
                return interaction.reply({ content: '🕶️ **Private room enabled:** only the owner and members explicitly invited can see or join this room.', ephemeral: true });
            }
            if (action === 'limit2') {
                await channel.setUserLimit(2);
                return interaction.reply({ content: '👥 **User limit:** set to 2 members (Duo).', ephemeral: true });
            }
            if (action === 'limit5') {
                await channel.setUserLimit(5);
                return interaction.reply({ content: '🎮 **User limit:** set to 5 members (Squad).', ephemeral: true });
            }
        } catch (error) {
            console.error('[Temp Voice] Control action failed:', error);
            return replyError(interaction, `❌ Could not update this voice room: ${error.message || 'Discord API error'}`);
        }
    });

    console.log('🎙️ [Temp Voice Engine] Premium Dynamic Voice Hub Armed.');
}

module.exports = { initTempVoice, activeTempChannels };
