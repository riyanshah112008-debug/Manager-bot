# Starry Spotify account linking

## Required backend environment

Set these values on the Render service that runs the Discord bot:

- `SPOTIFY_CLIENT_ID`: Spotify Developer application client ID.
- `SPOTIFY_CLIENT_SECRET`: Spotify Developer application client secret.
- `SPOTIFY_REDIRECT_URI`: exact backend callback URL, for example `https://manager-bot-1-6167.onrender.com/api/spotify/callback`.
- `SPOTIFY_OAUTH_STATE_SECRET`: a dedicated random secret of at least 32 characters.
- `SPOTIFY_TOKEN_ENCRYPTION_KEY`: a separate dedicated random secret of at least 32 characters.
- `FRONTEND_URL`: `https://manager-bot-96c07.web.app`.

Generate the two dedicated secrets independently. Keep them only in the hosting provider's environment settings. Never commit them, put them in browser JavaScript, or share them in chat. Keep the encryption key stable; rotating it requires affected users to reconnect their Spotify accounts.

## Spotify Developer Dashboard

Add the exact value of `SPOTIFY_REDIRECT_URI` to the Spotify application's Redirect URIs. The callback must point to the backend service, not the Firebase website root and not `https://starry.com` unless that domain actually routes to this backend callback.

The frontend begins account linking through an authenticated dashboard POST. Starry signs a short-lived state value, binds it to the Discord user ID and a Secure, HttpOnly, SameSite=Lax cookie, and verifies both on callback. The Discord user ID is never accepted from a query parameter.

## What account linking enables

- Shows whether the signed-in Discord user has linked Spotify.
- Reads that user's Spotify playlists and playlist metadata.
- Keeps playlist metadata separate from the audio provider used by Discord playback.
- Encrypts Spotify access and refresh tokens with AES-256-GCM before database storage; token fields are excluded from default Mongoose query projections.
- Supports disconnecting the linked account.

Spotify account linking does not provide Spotify Premium audio streaming or make Spotify's catalogue a raw Discord audio source. Spotify links are resolved to metadata and matched to a supported playable provider under the existing music policy.

## Dashboard modules

- AutoMod controls change the currently enforced server-wide switch and per-channel link/emoji filters; the API checks the selected server, live administrator permissions and MongoDB persistence.
- Security runs the existing CyberSec read-only permission audit. It does not silently change Discord permissions or claim that automatic anti-nuke response is enabled.
- Giveaways use the existing giveaway engine and its active JSON records. Dashboard creation checks duration, prize, winner count, selected guild channel and bot channel permissions.
- Notifications control the same category switches and channel destinations used by Starry's central logging resolver.
