const { SlashCommandBuilder } = require("discord.js");
const { StarryAudioEngine } = require("../../utils/nativeAudioEngine");
const { isLavalinkRequired } = require("../../utils/audioBackendPolicy");

module.exports = {
  name: "summon",
  aliases: ["join", "connect"],
  category: "Music",
  description: "Summons the bot into your current voice channel.",
  usage: "summon",
  data: new SlashCommandBuilder().setName("summon").setDescription("Summon the bot to your voice channel."),

  async execute(context, args, client) {
    const member = context.member;
    const voiceChannel = member?.voice?.channel;

    if (!voiceChannel) {
      return context.reply({
        content: "❌ You must be connected to a voice channel first!",
        ephemeral: true,
      });
    }

    try {
      const manager = client.manager;
      const hasReadyLavalink = Boolean(
        manager?.shoukaku?.nodes &&
        Array.from(manager.shoukaku.nodes.values()).some(node => node.state === 1)
      );
      if (hasReadyLavalink) {
        let player = manager.getPlayer(context.guild.id);
        if (!player) {
          player = await manager.createPlayer({
            guildId: context.guild.id,
            voiceId: voiceChannel.id,
            textId: context.channel.id,
            deaf: true
          });
        } else if (player.voiceId !== voiceChannel.id) {
          await player.setVoiceChannel(voiceChannel.id);
        }
        return context.reply({ content: `🎧 Joined voice channel: **${voiceChannel.name}** using Starry's dedicated audio node.` });
      }

      if (isLavalinkRequired()) {
        return context.reply({ content: '⚠️ Starry’s dedicated Render audio node is not ready. Please retry after Lavalink reconnects.', ephemeral: true });
      }

      const player = StarryAudioEngine.getOrCreatePlayer(client, context.guild.id, voiceChannel, context.channel);
      await player.connect();
      return context.reply({ content: `🎧 Joined voice channel: **${voiceChannel.name}**` });
    } catch (err) {
      return context.reply({ content: `❌ Could not join voice channel: ${err.message}`, ephemeral: true });
    }
  },
};
