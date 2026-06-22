
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  name: "play",

  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song")
    .addStringOption(option =>
      option
        .setName("query")
        .setDescription("Song name or URL")
        .setRequired(true)
    ),

  async messageExecute(client, message, args) {
    console.log("PLAY COMMAND TRIGGERED");

    await message.channel.send("DEBUG 1");

    const query = args.join(" ").trim();

    if (!query) {
      return message.channel.send("❌ Please provide a song name.");
    }

    if (!message.member.voice.channel) {
      return message.channel.send("❌ Join a voice channel first.");
    }

    await message.channel.send(`DEBUG 2: ${query}`);

    try {
      console.log("About to play:", query);

      await client.distube.play(
        message.member.voice.channel,
        query,
        {
          member: message.member,
          textChannel: message.channel
        }
      );

      console.log("Play finished");
      await message.channel.send("DEBUG 3");
    } catch (err) {
      console.error("PLAY ERROR:", err);
      await message.channel.send(`ERROR: ${err.message}`);
    }
  },

  async slashExecute(client, interaction) {
    const query = interaction.options.getString("query");

    if (!interaction.member.voice.channel) {
      return interaction.reply({
        content: "❌ Join a voice channel first.",
        ephemeral: true
      });
    }

    try {
      await interaction.reply(`🔎 Searching for **${query}**...`);

      await client.distube.play(
        interaction.member.voice.channel,
        query,
        {
          member: interaction.member,
          textChannel: interaction.channel
        }
      );
    } catch (err) {
      console.error("SLASH PLAY ERROR:", err);

      await interaction.followUp({
        content: `❌ ${err.message}`
      });
    }
  }
};
