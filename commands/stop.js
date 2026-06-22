const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  name: "stop",
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop playback and clear the queue"),

  async messageExecute(client, message) {
    const queue = client.distube.getQueue(message.guild.id);
    if (!queue) return message.reply("❌ Nothing is playing right now.");

    await queue.stop();
    return message.reply("⏹️ Stopped playback and cleared the queue.");
  },

  async slashExecute(client, interaction) {
    const queue = client.distube.getQueue(interaction.guildId);
    if (!queue) {
      return interaction.reply({ content: "❌ Nothing is playing right now.", ephemeral: true });
    }

    await queue.stop();
    return interaction.reply("⏹️ Stopped playback and cleared the queue.");
  }
};
