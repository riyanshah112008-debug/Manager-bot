const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const afkCollection = new Map();
const PREFIX = '.'; 

module.exports = (client) => {
    // ==========================================
    // 1. DYNAMIC SLASH COMMAND INJECTION
    // ==========================================
    client.commands.set('afk', {
        data: new SlashCommandBuilder()
            .setName('afk')
            .setDescription('Set your AFK status for this specific server.')
            .setContexts([0]) 
            .addStringOption(option => 
                option.setName('reason')
                    .setDescription('Reason for going AFK')
                    .setRequired(false)
            ),

        async execute(interaction) {
            const reason = interaction.options.getString('reason') || 'AFK';
            const afkKey = `${interaction.guildId}-${interaction.user.id}`;

            // Initialize AFK with arrays for messages and notify requests
            afkCollection.set(afkKey, { reason: reason, time: Date.now(), messages: [], notifyOnReturn: [] });

            const embed = new EmbedBuilder()
                .setColor('#EC407A') 
                .setAuthor({ name: interaction.user.displayName || interaction.user.username })
                .setDescription(`**AFK status set.**\n\n**Reason:** ${reason}`)
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setFooter({ text: 'I will notify those who mention you. >w<' });

            await interaction.reply({ content: `<@${interaction.user.id}>`, embeds: [embed] }).catch(() => {});
        }
    });

    // ==========================================
    // 2. HANDLE PREFIX (.afk) AND MESSAGE TRACKING
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        const authorKey = `${message.guild.id}-${message.author.id}`;

        // --- A. THE PREFIX COMMAND (.afk) ---
        if (message.content.toLowerCase().startsWith(PREFIX + 'afk')) {
            const args = message.content.slice(PREFIX.length + 3).trim();
            const reason = args || 'AFK';

            afkCollection.set(authorKey, { reason: reason, time: Date.now(), messages: [], notifyOnReturn: [] });

            const embed = new EmbedBuilder()
                .setColor('#EC407A')
                .setAuthor({ name: message.member?.displayName || message.author.username })
                .setDescription(`**AFK status set.**\n\n**Reason:** ${reason}`)
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 256 }))
                .setFooter({ text: 'I will notify those who mention you. >w<' });

            const reply = await message.reply({ content: `<@${message.author.id}>`, embeds: [embed] }).catch(() => {});

            if (reply) setTimeout(() => reply.delete().catch(() => {}), 5000);
            return;
        }

        // --- B. REMOVE AFK WHEN THEY TALK ---
        if (afkCollection.has(authorKey)) {
            const afkData = afkCollection.get(authorKey);
            
            if (Date.now() - afkData.time > 3000) {
                afkCollection.delete(authorKey);
                
                let welcomeText = `**Welcome back!**\n\nI have removed your AFK status.`;
                
                // If they have missed messages, append them to the embed
                if (afkData.messages.length > 0) {
                    welcomeText += `\n\n📥 **You received ${afkData.messages.length} message(s) while away:**\n`;
                    afkData.messages.forEach(msg => {
                        welcomeText += `> **<@${msg.author}>:** ${msg.text}\n`;
                    });
                }

                const embed = new EmbedBuilder()
                    .setColor('#2ECC71') 
                    .setAuthor({ name: message.member?.displayName || message.author.username })
                    .setDescription(welcomeText)
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 256 }));
                
                const welcomeBack = await message.channel.send({ content: `<@${message.author.id}>`, embeds: [embed] }).catch(() => {});
                
                // Ping the users who requested to be notified
                if (afkData.notifyOnReturn.length > 0) {
                    const pings = afkData.notifyOnReturn.map(id => `<@${id}>`).join(' ');
                    await message.channel.send(`🔔 ${pings} — **${message.author.username}** is back!`).catch(() => {});
                }

                if (welcomeBack) setTimeout(() => welcomeBack.delete().catch(() => {}), 15000); // Wait 15s so they can read messages
            }
        }

        // --- C. WARN USERS WHO PING THEM (DYNO STYLE) ---
        // Collect all mentioned users, plus the user they are replying to (if applicable)
        const targets = new Set(message.mentions.users.values());
        if (message.mentions.repliedUser) targets.add(message.mentions.repliedUser);

        if (targets.size > 0) {
            targets.forEach(user => {
                const mentionedKey = `${message.guild.id}-${user.id}`;

                if (afkCollection.has(mentionedKey)) {
                    const data = afkCollection.get(mentionedKey);
                    const timeAgo = Math.floor(data.time / 1000);

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`afk_msg_${user.id}`)
                            .setLabel('Leave a message')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId(`afk_ntf_${user.id}`)
                            .setLabel('Tell me when they are back')
                            .setStyle(ButtonStyle.Secondary)
                    );

                    // Plain text response like Dyno, with interactive buttons
                    message.reply({ 
                        content: `\`${user.username}\` is AFK: ${data.reason} - <t:${timeAgo}:R>`, 
                        components: [row] 
                    }).catch(() => {});
                }
            });
        }
    });

    // ==========================================
    // 3. HANDLE AFK BUTTONS & MODALS
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        // --- HANDLE BUTTON CLICKS ---
        if (interaction.isButton()) {
            if (interaction.customId.startsWith('afk_msg_')) {
                const targetId = interaction.customId.split('_')[2];
                const afkKey = `${interaction.guildId}-${targetId}`;
                
                if (!afkCollection.has(afkKey)) return interaction.reply({ content: '❌ This user is no longer AFK.', ephemeral: true });

                const modal = new ModalBuilder()
                    .setCustomId(`afk_modal_${targetId}`)
                    .setTitle('Leave a Message');

                const messageInput = new TextInputBuilder()
                    .setCustomId('afk_input')
                    .setLabel("What do you want to tell them?")
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(500)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(messageInput));
                await interaction.showModal(modal);
            }

            if (interaction.customId.startsWith('afk_ntf_')) {
                const targetId = interaction.customId.split('_')[2];
                const afkKey = `${interaction.guildId}-${targetId}`;
                const data = afkCollection.get(afkKey);
                
                if (!data) return interaction.reply({ content: '❌ This user is no longer AFK.', ephemeral: true });

                if (!data.notifyOnReturn.includes(interaction.user.id)) {
                    data.notifyOnReturn.push(interaction.user.id);
                }

                await interaction.reply({ content: `✅ I will ping you the moment they type a message!`, ephemeral: true });
            }
        }

        // --- HANDLE MODAL SUBMISSIONS ---
        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('afk_modal_')) {
                const targetId = interaction.customId.split('_')[2];
                const afkKey = `${interaction.guildId}-${targetId}`;
                const data = afkCollection.get(afkKey);
                
                if (!data) return interaction.reply({ content: '❌ This user is no longer AFK. They might have just returned!', ephemeral: true });

                const messageText = interaction.fields.getTextInputValue('afk_input');
                data.messages.push({ author: interaction.user.id, text: messageText });

                await interaction.reply({ content: `✅ I saved your message. I'll deliver it to them when they get back!`, ephemeral: true });
            }
        }
    });
};
