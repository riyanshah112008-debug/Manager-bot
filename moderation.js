const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// 👑 THE MASTER KEY: Paste your personal Discord User ID here
const OWNER_ID = '1465049039153135639'; 

const serverSettings = new Map();

module.exports = (client) => {
    // ==========================================
    // 1. REGISTER THE SLASH COMMAND
    // ==========================================
    client.on('clientReady', async () => {
        try {
            await client.application.commands.create({
                name: 'moderate',
                description: 'Core security and moderation control panel',
                options: [
                    {
                        name: 'toggle',
                        description: 'Toggle advanced security and bot emulation modules',
                        type: 1, // SUB_COMMAND
                        options: [
                            {
                                name: 'module',
                                description: 'Select the security protection module',
                                type: 3, // STRING
                                required: true,
                                choices: [
                                    { name: 'Wick (Anti-Nuke & Admin Limits)', value: 'wick' },
                                    { name: 'Beemo (Anti-Raid Mass Join Defense)', value: 'beemo' },
                                    { name: 'AltDentifier (Verification Gatekeeper)', value: 'altdentifier' },
                                    { name: 'Dyno/Carl (Chat Filters & AutoMod)', value: 'dyno' }
                                ]
                            },
                            {
                                name: 'status',
                                description: 'Enable or disable this module',
                                type: 5, // BOOLEAN
                                required: true
                            }
                        ]
                    },
                    {
                        name: 'autokick',
                        description: 'Configure native automated kicking rules',
                        type: 1, // SUB_COMMAND
                        options: [
                            {
                                name: 'enabled',
                                description: 'Toggle Auto-Kick engine',
                                type: 5, // BOOLEAN
                                required: true
                            },
                            {
                                name: 'account_age',
                                description: 'Minimum account age in days before triggering kick',
                                type: 4, // INTEGER
                                required: false
                            }
                        ]
                    },
                    {
                        name: 'autoban',
                        description: 'Configure native automated banning filters',
                        type: 1, // SUB_COMMAND
                        options: [
                            {
                                name: 'enabled',
                                description: 'Toggle Auto-Ban engine',
                                type: 5, // BOOLEAN
                                required: true
                            },
                            {
                                name: 'phrase_match',
                                description: 'Ban users sending messages matching this regex/phrase',
                                type: 3, // STRING
                                required: false
                            }
                        ]
                    },
                    {
                        name: 'ownerbypass',
                        description: 'Manage Owner Bypass settings for automod actions',
                        type: 1, // SUB_COMMAND
                        options: [
                            {
                                name: 'bypass',
                                description: 'Should server owners bypass security restrictions?',
                                type: 5, // BOOLEAN
                                required: true
                            }
                        ]
                    }
                ]
            });
            console.log('✅ Moderate Slash Command Added');
        } catch (error) {
            console.error('❌ Failed to add moderate slash command:', error);
        }
    });

    // ==========================================
    // 2. HANDLE THE SLASH COMMAND
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName !== 'moderate') return;

        // 👑 THE GUARD: Verify if they have Admin OR are the Bot Creator
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const isOwner = interaction.user.id === OWNER_ID;

        if (!isAdmin && !isOwner) {
            return interaction.reply({ content: '❌ You need **Administrator** permissions to use this command.', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (!serverSettings.has(guildId)) {
            serverSettings.set(guildId, { wick: false, beemo: false, altdentifier: false, dyno: false, autokick: false, autoban: false, ownerBypass: true, kickAgeLimit: 0 });
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
    });
};
                                
