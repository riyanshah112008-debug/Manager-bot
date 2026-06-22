module.exports = (client) => {
  // Regex patterns
  const linkPattern = /https?:\/\/\S+/g;
  // Matches custom discord emojis and standard unicode emojis
  const emojiPattern = /<a?:[a-zA-Z0-9_]+:[0-9]+>|[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

  client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

    const links = message.content.match(linkPattern) || [];
    const emojis = message.content.match(emojiPattern) || [];

    const isLinkSpam = links.length >= 1;
    const isEmojiSpam = emojis.length >= 5;

    if (isLinkSpam || isEmojiSpam) {
      try {
        await message.delete();

        if (isLinkSpam) {
          // Timeout for 5 minutes (300,000 ms)
          await message.member.timeout(5 * 60 * 1000, "Automod: Link Spam");
          await message.channel.send(`⚠️ ${message.author.toString()} has been timed out for 5 minutes for link spam.`);
        } else if (isEmojiSpam) {
          // Timeout for 2 minutes (120,000 ms)
          await message.member.timeout(2 * 60 * 1000, "Automod: Emoji Spam");
          await message.channel.send(`⚠️ ${message.author.toString()} has been timed out for 2 minutes for emoji spam.`);
        }
      } catch (error) {
        // Triggers if the bot lacks permissions (equivalent to discord.Forbidden)
        await message.channel.send("⚠️ I deleted the spam, but I couldn't timeout this user. They might be an Admin, or I lack permissions.");
      }
    }
  });
};

    
    
