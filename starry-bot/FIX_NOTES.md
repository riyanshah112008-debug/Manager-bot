# Music and slash-command fixes

## Deploy the commands

1. Install dependencies:
   ```bash
   npm install
   ```
2. Deploy slash commands:
   ```bash
   npm run deploy
   ```
3. Restart the bot:
   ```bash
   npm start
   ```

For fast testing in one server, set `GUILD_ID` before running `npm run deploy`. If `GUILD_ID` is omitted, commands are deployed globally.

You can also set `DEPLOY_COMMANDS_ON_STARTUP=true`, but running `npm run deploy` manually is safer because it avoids rewriting global commands on every restart.

## Music sources

Discord Player v7 no longer includes official YouTube playback. The repaired `/play` command accepts:

- A song name, searched through SoundCloud
- A SoundCloud URL
- A Spotify URL, bridged to a playable source when possible

Optional environment variables:

```env
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SOUNDCLOUD_CLIENT_ID=
SOUNDCLOUD_OAUTH_TOKEN=
MUSIC_DEBUG=false
```

SoundCloud can reject copyrighted or non-streamable tracks. Spotify supplies metadata and therefore still requires a playable bridge.

## Main repairs

- Matched `discord-player` and `@discord-player/extractor` at version `7.2.0`.
- Replaced the removed `loadDefault()` call with `loadMulti(DefaultExtractors)`.
- Removed duplicate extractor registration.
- Added `/volume` and all other implemented slash commands to `deploy-commands.js`.
- Removed command registrations that had no matching handler.
- Added `/premiumcheck` and `/ping` handlers.
- Loaded the existing `mediaOnly.js` module.
- Prevented `warnings.js` from replying to every unrelated slash command.
- Removed the duplicate warning system from `advancedMod.js`.
- Added `npm run deploy` and optional guild-only deployment support.
