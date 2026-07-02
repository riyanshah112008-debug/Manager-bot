const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'rrData.json');

module.exports = (client) => {
    function getRRData() {
        if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify([]));
        return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    }

    function saveRRData(data) {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    }

    // ==========================================
    // 1. REGISTER MULTI-ROLE SETUP COMMAND
    // ==========================================
    client.on('ready', async () => {
        try {
            await client.application.commands.create({
                name: 'rrsetup',
                description: 'Create a Reaction Role embed with up to 5 roles (Admin Only)',
                default_member_permissions: '8',
                options: [
                    { name: 'channel', description: 'Where to send the message', type: 7, required: true },
                    { name: 'title', description: 'The title of the embed', type: 3, required: true },
                    { name: 'text', description: 'The main message text', type: 3, required: true },
                    { name: 'role1', description: 'First role', type: 8, required: true },
                    { name: 'emoji1', description: 'First emoji (e.g. 🍎)', type: 3, required: true },
                    // Optional extra roles
                    { name: 'role2', description: 'Second role (Optional)', type: 8, required: false },
                    { name: 'emoji2', description: 'Second emoji (Optional)', type: 3, required: false },
                    { name: 'role3', description: 'Third role (Optional)', type: 8, required: false },
                    { name: 'emoji3', description: 'Third emoji (Optional)', type: 3, required: false },
                    { name: 'role4', description: 'Fourth role (Optional)', type: 8, required: false },
                    { name: 'emoji4', description: 'Fourth emoji (Optional)', type: 3, required: false },
                    { name: 'role5', description: 'Fifth role (Optional)', type: 8, required: false },
                    { name: 'emoji5', description: 'Fifth emoji (Optional)', type: 3, required: false }
                ]
            });
            console.log('✅ Multi-Reaction Roles Module Loaded');
        } catch (err) {}
    });

    // ==========================================
    // 2. CREATE THE EMBED & ADD REACTIONS
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'rrsetup') return;
        
        const channel = interaction.options.getChannel('channel');
        const title = interaction.options.getString('title');
        const text = interaction.options.getString('text');

        // Extract all the paired roles and emojis the user provided
        const pairs = [];
        for (let i = 1; i <= 5; i++) {
            const role = interaction.options.getRole(`role${i}`);
            const emoji = interaction.options.getString(`emoji${i}`);
            if (role && emoji) {
                pairs.push({ role, emoji: emoji.trim() });
            }
        }

        // Build the embed description automatically
        let embedDescription = `${text}\n\n`;
        pairs.forEach(pair => {
            embedDescription += `${pair.emoji} ━ <@&${pair.role.id}>\n\n`;
        });

        try {
            const embed = new EmbedBuilder()
                .setColor('Blurple')
                .setTitle(title)
                .setDescription(embedDescription)
                .setFooter({ text: 'Click a reaction below to get your role!' });

            const msg = await channel.send({ embeds: [embed] });

            // React to the message and save to database
            const rrData = getRRData();
            
            for (const pair of pairs) {
                await msg.react(pair.emoji).catch(() => console.log(`Failed to react with ${pair.emoji}`));
                
                rrData.push({
                    messageId: msg.id,
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    roleId: pair.role.id,
                    emoji: pair.emoji
                });
            }
            
            saveRRData(rrData);
            await interaction.reply({ content: '✅ Multi-Role Embed created successfully!', ephemeral: true }).catch(() => {});
        } catch (err) {
            await interaction.reply({ content: `❌ Failed! Make sure you are using actual emojis (not text like :smile:) and that I have permissions in that channel.`, ephemeral: true }).catch(() => {});
        }
    });

    // ==========================================
    // 3. ASSIGN ROLE ON REACTION
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
                    const errorMsg = await reaction.message.channel.send(`❌ <@${user.id}>, Discord blocked me from giving you the role! My "Starry" role must be placed **ABOVE** the role you selected in Server Settings.`);
                    setTimeout(() => errorMsg.delete().catch(() => {}), 8000);
                }
            }
        }
    });

    // ==========================================
    // 4. REMOVE ROLE ON UN-REACT
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
                    console.log("Role Remove Error:", err.message);
                }
            }
        }
    });
};
