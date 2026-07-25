const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('📑 View the current music queue with interactive pages'),

    async execute(interaction, client) {
        // Defer reply so the bot has time to process large queues
        await interaction.deferReply();

        const player = client.manager.getPlayer(interaction.guild.id);
        
        if (!player || !player.queue.current) {
            return interaction.editReply('❌ There is no music currently playing in this server.');
        }

        const formatTime = (ms) => {
            if (!ms) return '0:00';
            const totalSeconds = Math.floor(ms / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        };

        const tracks = player.queue; // Array of upcoming tracks
        const current = player.queue.current; // The currently playing track
        
        // If there is no queue, just show the currently playing song
        if (!tracks.length) {
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(`🎶 Queue for ${interaction.guild.name}`)
                .setDescription(`**Now Playing:**\n[${current.title}](${current.uri}) - \`${formatTime(current.length)}\`\n\n*The queue is currently empty.*`);
            return interaction.editReply({ embeds: [embed] });
        }

        // --- PAGINATION LOGIC ---
        const itemsPerPage = 10;
        const totalPages = Math.ceil(tracks.length / itemsPerPage);
        let currentPage = 0;

        // Function to generate the embed for a specific page
        const generateEmbed = (page) => {
            const start = page * itemsPerPage;
            const end = start + itemsPerPage;
            const currentTracks = tracks.slice(start, end);

            const trackList = currentTracks.map((track, index) => {
                return `**${start + index + 1}.** [${track.title}](${track.uri}) - \`${formatTime(track.length)}\``;
            }).join('\n');

            return new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(`🎶 Queue for ${interaction.guild.name}`)
                .setDescription(
                    `**Now Playing:**\n[${current.title}](${current.uri}) - \`${formatTime(current.length)}\`\n\n` +
                    `**Up Next:**\n${trackList}`
                )
                .setFooter({ 
                    text: `Page ${page + 1} of ${totalPages} • Total Queue: ${tracks.length} songs`, 
                    iconURL: client.user.displayAvatarURL() 
                });
        };

        // Function to generate the interactive buttons based on the current page
        const generateButtons = (page) => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('q_first')
                    .setEmoji('⏪')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 0), // Disable if on the first page
                new ButtonBuilder()
                    .setCustomId('q_prev')
                    .setEmoji('◀️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('q_next')
                    .setEmoji('▶️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === totalPages - 1), // Disable if on the last page
                new ButtonBuilder()
                    .setCustomId('q_last')
                    .setEmoji('⏩')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === totalPages - 1)
            );
        };

        // Send the initial first page
        const message = await interaction.editReply({ 
            embeds: [generateEmbed(currentPage)], 
            components: [generateButtons(currentPage)] 
        });

        // --- BUTTON COLLECTOR LOGIC ---
        // This listens for button clicks on THIS specific message for 2 minutes (120,000ms)
        const collector = message.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 120000 
        });

        collector.on('collect', async (i) => {
            // Optional: Only allow the person who ran the command to click the buttons
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: '❌ Only the person who requested the queue can change pages.', ephemeral: true });
            }

            // Update the page number based on the button clicked
            if (i.customId === 'q_first') currentPage = 0;
            if (i.customId === 'q_prev') currentPage--;
            if (i.customId === 'q_next') currentPage++;
            if (i.customId === 'q_last') currentPage = totalPages - 1;

            // Refresh the message with the new page and updated button states
            await i.update({ 
                embeds: [generateEmbed(currentPage)], 
                components: [generateButtons(currentPage)] 
            });
        });

        // When the 2-minute timer runs out, disable the buttons so they don't error out later
        collector.on('end', () => {
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('q_first').setEmoji('⏪').setStyle(ButtonStyle.Primary).setDisabled(true),
                new ButtonBuilder().setCustomId('q_prev').setEmoji('◀️').setStyle(ButtonStyle.Primary).setDisabled(true),
                new ButtonBuilder().setCustomId('q_next').setEmoji('▶️').setStyle(ButtonStyle.Primary).setDisabled(true),
                new ButtonBuilder().setCustomId('q_last').setEmoji('⏩').setStyle(ButtonStyle.Primary).setDisabled(true)
            );
            
            // Failsafe in case the queue message was deleted before the timer ended
            interaction.editReply({ components: [disabledRow] }).catch(() => {}); 
        });
    }
};
