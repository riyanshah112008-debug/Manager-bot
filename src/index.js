        }

        // Consume the capability before the asynchronous role mutation to prevent concurrent replay.
        client.verifyMap.delete(token);
        await member.roles.add(targetRole, 'Starry Web Human Verification');

        // Telemetry audit notification
        try {
            const chamberCh = guild.channels.cache.find(c => c.name === 'verification-chamber' || c.name === 'audit-log' || c.name === 'mod-logs');
            if (chamberCh && chamberCh.isTextBased()) {
                const { EmbedBuilder } = require('discord.js');
                const logEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')