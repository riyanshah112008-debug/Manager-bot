const fs = require("fs");
const path = require("path");
const config = require("./config.json");

module.exports = (client) => {
  // ---------------- PREMIUM CACHE ----------------
  let premiumData = { servers: [] };
  const premiumFilePath = path.join(__dirname, "premium.json");

  function loadPremium() {
    if (fs.existsSync(premiumFilePath)) {
      premiumData = JSON.parse(fs.readFileSync(premiumFilePath, "utf8"));
    } else {
      fs.writeFileSync(premiumFilePath, JSON.stringify(premiumData, null, 2));
    }
  }

  function savePremium() {
    fs.writeFileSync(premiumFilePath, JSON.stringify(premiumData, null, 2));
  }

  loadPremium();

  // ---------------- ANTI-RAID BASIC ----------------
  const raidTracker = new Map();

  function antiRaid(message) {
    if (!message.guild) return;

    const key = message.guild.id + message.author.id;
    const now = Date.now();

    if (!raidTracker.has(key)) {
      raidTracker.set(key, []);
    }

    const timestamps = raidTracker.get(key);
    timestamps.push(now);

    const recent = timestamps.filter((t) => now - t < 5000);
    raidTracker.set(key, recent);

    if (recent.length > 5) {
      message.member.kick("Anti-raid trigger").catch(() => {});
    }
  }

  // ---------------- COMMAND HANDLER ----------------
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    const guildId = message.guild?.id;
    const isPremium = guildId && premiumData.servers.includes(guildId);

    // Anti-raid only in premium servers
    if (isPremium) antiRaid(message);

    // ---------------- BASIC ----------------
    if (message.content === ".ping") {
      return message.reply("🏓 Pong!");
    }

    if (message.content === ".myid") {
      return message.reply(message.author.id);
    }

    // ---------------- PREMIUM CHECK ----------------
    if (message.content === ".premiumcheck") {
      if (!message.guild) return message.reply("Use in server.");
      return message.reply(isPremium ? "⭐ Premium ACTIVE" : "❌ Premium NOT active");
    }

    // ---------------- PREMIUM INFO ----------------
    if (message.content === ".premium") {
      return message.reply(`
⭐ PREMIUM FEATURES

🎵 24/7 Music (coming module)
🛡️ Anti-Raid Protection
⚡ Faster Processing
📊 Analytics
🎨 Custom Features
`);
    }

    // ---------------- OWNER CHECK ----------------
    const isOwner = message.author.id === config.ownerId;

    // ---------------- ACTIVATE PREMIUM ----------------
    if (message.content.startsWith(".activatepremium")) {
      if (!isOwner) return message.reply("❌ Owner only");

      const serverId = message.content.split(" ")[1];
      if (!serverId) return message.reply("Usage: .activatepremium <serverid>");

      if (!premiumData.servers.includes(serverId)) {
        premiumData.servers.push(serverId);
        savePremium();
      }

      return message.reply(`✅ Premium enabled for ${serverId}`);
    }

    // ---------------- REMOVE PREMIUM ----------------
    if (message.content.startsWith(".removepremium")) {
      if (!isOwner) return message.reply("❌ Owner only");

      const serverId = message.content.split(" ")[1];
      if (!serverId) return message.reply("Usage: .removepremium <serverid>");

      premiumData.servers = premiumData.servers.filter((id) => id !== serverId);
      savePremium();

      return message.reply(`❌ Premium removed for ${serverId}`);
    }
  });
};
      
