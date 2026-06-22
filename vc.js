const path = require("path");
const fs = require("fs");
const ffmpegPath = require("ffmpeg-static");
const { Collection } = require("discord.js");
const { DisTube } = require("distube");
const { SpotifyPlugin } = require("@distube/spotify");

if (ffmpegPath) {
  process.env.FFMPEG_PATH = ffmpegPath;
}

module.exports = (client) => {
  // Initialize command collection if it doesn't exist
  if (!client.commands) client.commands = new Collection();

  // Initialize DisTube
  client.distube = new DisTube(client, {
    emitNewSongOnly: true,
    plugins: [new SpotifyPlugin()]
  });

  client.distube
    .on("playSong", (queue, song) => {
      queue.textChannel?.send(`🎶 Playing **${song.name}**`).catch(() => {});
    })
    .on("addSong", (queue, song) => {
      queue.textChannel?.send(`➕ Added **${song.name}**`).catch(() => {});
    })
    .on("error", (error) => {
      console.error("DISTUBE ERROR:", error);
    });

  const commandsPath = path.join(__dirname, "commands");

  if (fs.existsSync(commandsPath)) {
    const files = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith(".js"));

    for (const file of files) {
      try {
        const command = require(path.join(commandsPath, file));
        if (!command.name) continue;
        client.commands.set(command.name, command);
        console.log(`✅ Loaded ${command.name}`);
      } catch (err) {
        console.error(`❌ ${file}`, err);
      }
    }
  }

  client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.content.startsWith(".")) return;

    const args = message.content.slice(1).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();
    const command = client.commands.get(commandName);

    if (!command?.messageExecute) return;

    try {
      await command.messageExecute(client, message, args);
    } catch (err) {
      console.error(err);
      message.reply("❌ Command failed.").catch(() => {});
    }
  });
};
