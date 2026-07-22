const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'rrData.json');

module.exports = (client) => {
    // ==========================================
    // DATABASE HELPERS
    // ==========================================
    function getRRData() {
        if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify([]));
        return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    }

    function saveRRData(data) {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    }

    // ==========================================
    // 1. MODULAR BUILDER SYSTEM (SLASH COMMANDS)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'rr') return;

        // 🛑 Admin Only
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: '❌ You need **Administrator** permissions to manage reaction roles.', ephemeral: true }).catch(() => {});
        }

        const subcommand = interaction.options.getSubcommand();

        // --- STEP 1: SPAWN THE PANEL ---
        if (subcommand === 'spawn') {
            const channel = interaction.options.getChannel('channel');
            const title = interaction.options.getString('title');
            const text = interaction.options.getString('text');

            const embed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle(title)
                .setDescription(`${text}\n\n`) // Leaves space for the dynamic role list
                .setFooter({ text: 'Click a reaction below to get your role!' });

            try {
                const msg = await channel.send({ embeds: [embed] });
                return interaction.reply({ 
                    content: `✅ **Reaction Role panel spawned!**\n\n**Channel:** <#${channel.id}>\n**Message ID:** \`${msg.id}\`\n\nUse \`/rr add\` and paste this Message ID to start attaching roles to it! *(Max 20 roles per message)*`, 
                    ephemeral: true 
                }).catch(() => {});
            } catch (err) {
                return interaction.reply({ content: '❌ Failed to send the message. Check my channel permissions!', ephemeral: true }).catch(() => {});
            }
        }

        // --- STEP 2: ADD A ROLE TO THE PANEL ---
        if (subcommand === 'add') {
            const channel = interaction.options.getChannel('channel');
            const messageId = interaction.options.getString('message_id');
            const role = interaction.options.getRole('role');
            const emoji = interaction.options.getString('emoji').trim();

            let targetMessage;
            try {
                targetMessage = await channel.messages.fetch(messageId);
            } catch (err) {
                return interaction.reply({ content: '❌ Could not find that message. Make sure the Channel and Message ID are correct!', ephemeral: true }).catch(() => {});
            }

            // Try to react to verify the emoji is valid
            try {
                await targetMessage.react(emoji);
            } catch (err) {
                return interaction.reply({ content: '❌ Failed to react! Make sure you are using a standard emoji or a custom emoji from this server.', ephemeral: true }).catch(() => {});
            }

            // Update the Embed Description dynamically
            const oldEmbed = targetMessage.embeds[0];
            if (!oldEmbed) return interaction.reply({ content: '❌ That message does not have an embed to edit.', ephemeral: true }).catch(() => {});

            const newEmbed = EmbedBuilder.from(oldEmbed);
            newEmbed.setDescription(`${oldEmbed.description}${emoji} ━ <@&${role.id}>\n\n`);

            await targetMessage.edit({ embeds: [newEmbed] }).catch(() => {});

            // Save to Database
            const rrData = getRRData();
            rrData.push({
                messageId: targetMessage.id,
                channelId: channel.id,
                guildId: interaction.guildId,
                roleId: role.id,
                emoji: emoji
            });
            saveRRData(rrData);

            return interaction.reply({ content: `✅ Successfully attached ${emoji} for <@&${role.id}> to the panel!`, ephemeral: true }).catch(() => {});
        }
    });

    // ==========================================
    // 2. ASSIGN ROLE ON REACTION
    // ==========================================
    client.on('messageReactionAdd', async (reaction, user) => {
        if (user.bot) return;

        if (reaction.partial) await reaction.fetch().catch(() => {});
        if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

        const rrData = getRRData();
        const rr = rrData.find(r => 
            r.messageId === reaction.message.id && 
            (r.emoji === reaction.emoji.name || r.emoji === reaction.emoji.toString())
        );
        
        if (rr) {
            const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
            if (member) {
                try {
                    await member.roles.add(rr.roleId);
                } catch (err) {
                    const errorMsg = await reaction.message.channel.send(`❌ <@${user.id}>, Discord blocked me from giving you the role! My bot role must be placed **ABOVE** the role you selected in Server Settings.`);
                    setTimeout(() => errorMsg.delete().catch(() => {}), 8000);
                }
            }
        }
    });

    // ==========================================
    // 3. REMOVE ROLE ON UN-REACT
    // ==========================================
    client.on('messageReactionRemove', async (reaction, user) => {
        if (user.bot) return;

        if (reaction.partial) await reaction.fetch().catch(() => {});
        if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

        const rrData = getRRData();
        const rr = rrData.find(r => 
            r.messageId === reaction.message.id && 
            (r.emoji === reaction.emoji.name || r.emoji === reaction.emoji.toString())
        );
        
        if (rr) {
            const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
            if (member) {
                try {
                    await member.roles.remove(rr.roleId);
                } catch (err) {
                    // Fail silently so we don't spam the chat if a user leaves the server while un-reacting
                }
            }
        }
    });
};
                    
