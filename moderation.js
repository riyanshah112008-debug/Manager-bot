const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// 👑 THE MASTER KEY: Paste your personal Discord User ID here
const OWNER_ID = '1465049039153135639'; 

// Simulated database/memory storage for feature toggles
const serverSettings = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('moderate')
        .setDescription('Core security and moderation control panel')
        // 🔓 Removed setDefaultMemberPermissions so the command is visible to you everywhere!
        .addSubcommand(subc =>
            subc.setName('toggle')
                .setDescription('Toggle advanced security and bot emulation modules')
                .addStringOption(opt =>
                    opt.setName('module')
                        .setDescription('Select the security protection module')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Wick (Anti-Nuke & Admin Limits)', value: 'wick' },
                            { name: 'Beemo (Anti-Raid Mass Join Defense)', value: 'beemo' },
                            { name: 'AltDentifier (Verification Gatekeeper)', value: 'altdentifier' },
                            { name: 'Dyno/Carl (Chat Filters & AutoMod)', value: 'dyno' }
                        )
                )
                .addBooleanOption(opt =>
                    opt.setName('status')
                        .setDescription('Enable or disable this module')
                        .setRequired(true)
                )
        )
        .addSubcommand(subc =>
            subc.setName('autokick')
                .setDescription('Configure native automated kicking rules')
                .addBooleanOption(opt =>
                    opt.setName('enabled')
                        .setDescription('Toggle Auto-Kick engine')
                        .setRequired(true)
                )
                .addIntegerOption(opt =>
                    opt.setName('account_age')
                        .setDescription('Minimum account age in days before triggering kick')
                        .setRequired(false)
                )
        )
        .addSubcommand(subc =>
            subc.setName('autoban')
                .setDescription('Configure native automated banning filters')
                .addBooleanOption(opt =>
                    opt.setName('enabled')
                        .setDescription('Toggle Auto-Ban engine')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('phrase_match')
                        .setDescription('Ban users sending messages matching this regex/phrase')
                        .setRequired(false)
                )
        )
        .addSubcommand(subc =>
            subc.setName('ownerbypass')
                .setDescription('Manage Owner Bypass settings for automod actions')
                .addBooleanOption(opt =>
                    opt.setName('bypass')
                        .setDescription('Should server owners bypass security restrictions?')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        // 👑 THE GUARD: Verify if they have Admin OR are the Bot Creator
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const isOwner = interaction.user.id === OWNER_ID;

        if (!isAdmin && !isOwner) {
            return interaction.reply({ content: '❌ You need **Administrator** permissions to use this command.', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (!serverSettings.has(guildId)) {
            serverSettings.set(guildId, {
                wick: false,
                beemo: false,
                altdentifier: false,
                dyno: false,
                autokick: false,
                autoban: false,
                ownerBypass: true,
                kickAgeLimit: 0
            });
        }

        const settings = serverSettings.get(guildId);
        const embed = new EmbedBuilder().setColor('#5865F2').setTimestamp();

        if (subcommand === 'toggle') {
            const moduleName = interaction.options.getString('module');
            const status = interaction.options.getBoolean('status');

            settings[moduleName] = status;
            serverSettings.set(guildId, settings);

            const moduleLabels = {
                wick: '🛡️ Wick Anti-Nuke Protection',
                beemo: '🐝 Beemo Anti-Raid System',
                altdentifier: '👤 AltDentifier Verification Gate',
                dyno: '🤖 Dyno/Carl AutoMod Core'
            };

            embed.setTitle('Module Status Updated')
                 .setDescription(`${moduleLabels[moduleName]} has been successfully set to **${status ? 'ENABLED' : 'DISABLED'}**.`);
            
            return interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'autokick') {
            const enabled = interaction.options.getBoolean('enabled');
            const age = interaction.options.getInteger('account_age') || 0;

            settings.autokick = enabled;
            if (age > 0) settings.kickAgeLimit = age;
            serverSettings.set(guildId, settings);

            embed.setTitle('⚙️ Auto-Kick Configurations')
                 .setDescription(`Auto-Kick Status: **${enabled ? 'ACTIVE' : 'INACTIVE'}**\nAccount Age Threshold: **${settings.kickAgeLimit} days**`);
            
            return interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'autoban') {
            const enabled = interaction.options.getBoolean('enabled');
            settings.autoban = enabled;
            serverSettings.set(guildId, settings);

            embed.setTitle('🔨 Auto-Ban Filters Updated')
                 .setDescription(`Auto-Ban Protection Core is now **${enabled ? 'ACTIVE' : 'INACTIVE'}**.`);
            
            return interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'ownerbypass') {
            const bypass = interaction.options.getBoolean('bypass');
            settings.ownerBypass = bypass;
            serverSettings.set(guildId, settings);

            embed.setTitle('👑 Security Privileges Shifted')
                 .setDescription(`Owner Bypass Protection has been set to **${bypass ? 'ENABLED (Owners immune)' : 'DISABLED (Owners monitored)'}**.`);
            
            return interaction.reply({ embeds: [embed] });
        }
    }
};
