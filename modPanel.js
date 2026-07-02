const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const warnDbPath = path.join(__dirname, 'warnings.json');

module.exports = (client) => {
    // Helper Functions for Warning Database
    function getWarns() {
        if (!fs.existsSync(warnDbPath)) fs.writeFileSync(warnDbPath, JSON.stringify({}));
        return JSON.parse(fs.readFileSync(warnDbPath, 'utf-8'));
    }

    function saveWarns(data) {
        fs.writeFileSync(warnDbPath, JSON.stringify(data, null, 2));
    }

    // Convert time strings (10m, 1h) into milliseconds
    function parseTime(timeStr) {
        const match = timeStr.match(/^(\d+)(s|m|h|d)$/);
        if (!match) return null;
        const val = parseInt(match[1]);
        const unit = match[2];
        if (unit === 's') return val * 1000;
        if (unit === 'm') return val * 60 * 1000;
        if (unit === 'h') return val * 60 * 60 * 1000;
        if (unit === 'd') return val * 24 * 60 * 60 * 1000;
        return null;
    }

    // ==========================================
    // 1. REGISTER THE COMMAND
    // ==========================================
    client.on('ready', async () => {
        try {
            await client.application.commands.create({
                name: 'modpanel',
                description: 'Open an interactive UI dashboard to moderate a user (Mod Only)',
                default_member_permissions: '8192', // Manage Messages permission
                options: [
                    { name: 'user', description: 'The user you want to moderate', type: 6, required: true }
                ]
            });
            console.log('✅ Interactive Mod Panel Loaded');
        } catch (err) {}
    });

    // ==========================================
    // 2. SPAWN THE BUTTON DASHBOARD
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'modpanel') return;

        const targetUser = interaction.options.getUser('user');

        const embed = new EmbedBuilder()
            .setColor('Blurple')
            .setTitle(`🛡️ Moderation Panel: ${targetUser.tag}`)
            .setDescription(`Select an action below to perform on <@${targetUser.id}>.\n*You will be prompted to enter a reason in the next step.*`)
            .setThumbnail(targetUser.displayAvatarURL());

        // Create the Buttons (We hide the user's ID inside the button's customId!)
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`mod_warn_${targetUser.id}`).setLabel('Warn').setStyle(ButtonStyle.Primary).setEmoji('⚠️'),
            new ButtonBuilder().setCustomId(`mod_timeout_${targetUser.id}`).setLabel('Timeout').setStyle(ButtonStyle.Secondary).setEmoji('⏱️'),
            new ButtonBuilder().setCustomId(`mod_kick_${targetUser.id}`).setLabel('Kick').setStyle(ButtonStyle.Danger).setEmoji('👢'),
            new ButtonBuilder().setCustomId(`mod_ban_${targetUser.id}`).setLabel('Ban').setStyle(ButtonStyle.Danger).setEmoji('🔨')
        );

        // Send privately to the moderator
        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    });

    // ==========================================
    // 3. HANDLE BUTTON CLICKS (OPEN MODALS)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith('mod_')) return;

        const parts = interaction.customId.split('_');
        const action = parts[1];
        const targetId = parts[2];

        if (action === 'warn') {
            const modal = new ModalBuilder().setCustomId(`modal_warn_${targetId}`).setTitle('Issue a Warning');
            const reasonInput = new TextInputBuilder().setCustomId('reason').setLabel('Reason for warning').setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
            await interaction.showModal(modal);
        } 
        else if (action === 'timeout') {
            const modal = new ModalBuilder().setCustomId(`modal_timeout_${targetId}`).setTitle('Timeout User');
            const durationInput = new TextInputBuilder().setCustomId('duration').setLabel('Duration (e.g., 10m, 1h, 1d)').setStyle(TextInputStyle.Short).setRequired(true);
            const reasonInput = new TextInputBuilder().setCustomId('reason').setLabel('Reason').setStyle(TextInputStyle.Paragraph).setRequired(false);
            modal.addComponents(new ActionRowBuilder().addComponents(durationInput), new ActionRowBuilder().addComponents(reasonInput));
            await interaction.showModal(modal);
        }
        else if (action === 'kick' || action === 'ban') {
            const modal = new ModalBuilder().setCustomId(`modal_${action}_${targetId}`).setTitle(`${action.toUpperCase()} User`);
            const reasonInput = new TextInputBuilder().setCustomId('reason').setLabel('Reason').setStyle(TextInputStyle.Paragraph).setRequired(false);
            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
            await interaction.showModal(modal);
        }
    });

    // ==========================================
    // 4. HANDLE MODAL SUBMISSIONS (EXECUTE ACTION)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isModalSubmit()) return;
        if (!interaction.customId.startsWith('modal_')) return;

        const parts = interaction.customId.split('_');
        const action = parts[1];
        const targetId = parts[2];
        const reason = interaction.fields.getTextInputValue('reason') || 'No reason provided';
        
        const member = await interaction.guild.members.fetch(targetId).catch(() => null);
        
        try {
            if (action === 'warn') {
                const warns = getWarns();
                if (!warns[interaction.guild.id]) warns[interaction.guild.id] = {};
                if (!warns[interaction.guild.id][targetId]) warns[interaction.guild.id][targetId] = [];

                const warnId = Math.random().toString(36).substring(2, 8).toUpperCase();
                warns[interaction.guild.id][targetId].push({ id: warnId, reason: reason, moderator: interaction.user.id, date: Date.now() });
                saveWarns(warns);

                if (member) member.send(`⚠️ You received a warning in **${interaction.guild.name}** for: *${reason}*`).catch(() => {});
                await interaction.reply({ content: `✅ Successfully warned <@${targetId}>. (Warn ID: \`${warnId}\`)`, ephemeral: true });
            } 
            
            else if (action === 'timeout') {
                if (!member) return interaction.reply({ content: '❌ User is not in the server.', ephemeral: true });
                const durationStr = interaction.fields.getTextInputValue('duration');
                const msDuration = parseTime(durationStr);
                
                if (!msDuration) return interaction.reply({ content: '❌ Invalid duration format! Use `m`, `h`, or `d`.', ephemeral: true });
                
                await member.timeout(msDuration, reason);
                await interaction.reply({ content: `✅ Successfully timed out <@${targetId}> for ${durationStr}.`, ephemeral: true });
            } 
            
            else if (action === 'kick') {
                if (!member) return interaction.reply({ content: '❌ User is not in the server.', ephemeral: true });
                await member.kick(reason);
                await interaction.reply({ content: `✅ Successfully kicked <@${targetId}>.`, ephemeral: true });
            } 
            
            else if (action === 'ban') {
                await interaction.guild.members.ban(targetId, { reason: reason });
                await interaction.reply({ content: `✅ Successfully banned <@${targetId}>.`, ephemeral: true });
            }
        } catch (error) {
            await interaction.reply({ content: `❌ Error: I don't have permission to do that to this user. Make sure my role is higher than theirs!`, ephemeral: true }).catch(() => {});
        }
    });
};
