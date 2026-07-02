const { PermissionsBitField } = require('discord.js');

module.exports = (client) => {
    // 🟢 The Safe List: Add any websites here that you WANT people to be able to link!
    const safeDomains = [
        'tenor.com',            // Discord GIFs
        'giphy.com',            // Discord GIFs
        'imgur.com',            // Image hosting
        'cdn.discordapp.com',   // Discord attachments
        'media.discordapp.net', // Discord media
        'youtube.com',          // YouTube videos
        'youtu.be',             // YouTube short links
        'spotify.com',          // Spotify songs
        'prnt.sc'               // Lightshot screenshots
    ];

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        // Admins and Moderators (anyone with 'Manage Messages') can post any link they want
        if (message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

        // Regex to detect ANY link in a message
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const links = message.content.match(urlRegex);

        if (links) {
            let isBadLink = false;

            // Check every link in the message against our Safe List
            for (const link of links) {
                const isSafe = safeDomains.some(domain => link.toLowerCase().includes(domain));
                if (!isSafe) {
                    isBadLink = true; // Found a link that isn't on the safe list!
                    break;
                }
            }

            // If a bad link was found, delete the message and warn the user
            if (isBadLink) {
                await message.delete().catch(() => {});
                
                const warningMsg = await message.channel.send(`⚠️ <@${message.author.id}>, please do not post unauthorized links here!`);
                setTimeout(() => warningMsg.delete().catch(() => {}), 5000); // Clean up the warning after 5 seconds
            }
        }
    });
};
