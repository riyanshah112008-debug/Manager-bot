# Manager Media Activity

The Media Room is a Discord Embedded Activity launched with `/media-room`. It provides a shared YouTube queue and synchronized playback state inside a Discord Activity iframe.

## Current implementation

- Discord Embedded App SDK authentication (`identify` scope).
- OAuth authorization-code exchange on the bot backend.
- Per-Activity-instance room state, shared queue, play, pause, next and seek.
- YouTube IFrame Player for videos that permit embedding.
- The first participant becomes room host; the host publishes playback position.
- Room state is in process memory and expires after two hours. It is suitable for a single backend instance only; use a shared database before running multiple backend replicas.
- This feature does not download, rehost, bypass DRM, remove ads, or bypass provider access restrictions. It cannot guarantee playback of every movie or third-party URL.

## Discord Developer Portal

1. Open the Discord application already used by Manager-bot.
2. Under **Activities**, enable Activities.
3. Add an Activity URL Mapping with prefix `/` pointing to the public HTTPS host serving the `public/` directory.
4. Under OAuth2, add the redirect URI `https://127.0.0.1` (the Embedded App SDK authorization flow uses this placeholder redirect).
5. Enable the Activity on the platforms you intend to support.
6. Keep the existing bot token private. Set the application OAuth client secret only as the backend environment variable `DISCORD_CLIENT_SECRET` (or `CLIENT_SECRET`); never put it in frontend files or GitHub.

The application ID is read from `CLIENT_ID` / `APPLICATION_ID`, with the current Manager-bot application ID as fallback.

## Backend environment

Required:
- `CLIENT_ID`: Discord application ID (already used by the command deployer).
- `DISCORD_CLIENT_SECRET`: Discord OAuth2 client secret, stored only in the backend host's secret/environment settings.

The Node backend must serve the repository's `public/` directory and mount `src/modules/mediaActivityApi.js` at `/api/media`.

## Launch and test

1. Deploy the slash command definitions using the existing command deployment workflow.
2. Invite/authorize the bot with its existing command permissions.
3. Join a voice channel and run `/media-room`.
4. Other members in that voice channel open the Activity and join the same room.
5. Add an embeddable YouTube URL and test play/pause/next/seek from multiple clients.

## Hosting notes

Firebase Hosting can serve the static Activity files. The Node backend must also be reachable over HTTPS for OAuth and shared room state. Firebase Hosting alone does not run the persistent Node process. Configure the Activity's API URL mapping to the backend origin when deploying the Activity separately, or configure an HTTPS API proxy that supports these HTTP routes. Do not expose the OAuth client secret in Firebase Hosting.
