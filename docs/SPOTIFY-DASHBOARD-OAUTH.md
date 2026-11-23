# Starry Spotify dashboard account linking

## Spotify Developer Dashboard configuration

1. Create or select the Starry Spotify application.
2. Register the exact backend callback URL in the application's Redirect URIs:
   `https://YOUR-BACKEND-HOST/api/spotify/callback`
3. Set the same URL as `SPOTIFY_REDIRECT_URI` in the backend environment.
4. Set `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` as private backend environment variables.
5. Generate a 32-byte encryption key, for example with `openssl rand -hex 32`, and set it as `SPOTIFY_TOKEN_ENCRYPTION_KEY`.

The redirect URI in Spotify, the authorization request and the code exchange must match exactly. Do not register the Firebase frontend URL when OAuth callbacks are served by the bot backend.

## Environment variables

- `SPOTIFY_CLIENT_ID`: Spotify application client ID.
- `SPOTIFY_CLIENT_SECRET`: Spotify application client secret. Never expose it to browser code.
- `SPOTIFY_REDIRECT_URI`: Exact HTTPS callback URI ending in `/api/spotify/callback`.
- `SPOTIFY_TOKEN_ENCRYPTION_KEY`: 32 random bytes, encoded as 64 hexadecimal characters or base64. Used for AES-256-GCM encrypted Spotify credentials and short-lived PKCE verifiers.

Do not commit real credentials. Do not reuse `SESSION_ENCRYPTION_KEY` as the Spotify token key.

## OAuth security model

Dashboard linking uses the current authenticated Discord session to identify the user. The browser cannot choose a Discord user ID. Starry stores only a hash of a cryptographically random, ten-minute OAuth state value and an encrypted PKCE verifier. The callback consumes that state once before exchanging the authorization code. State is rejected when missing, expired or already consumed.

Spotify access and refresh tokens are encrypted server-side with AES-256-GCM. The dashboard APIs return profile and playlist metadata only; tokens and verifier material are never returned. Legacy plaintext tokens can be read for compatibility and are encrypted the first time that user visits the account status or playlist endpoints.

Disconnecting removes the user's Spotify record, including account credentials and saved playlist metadata.

## Key rotation and recovery

Keep the encryption key stable and backed up in the hosting provider's secret store. Rotating it without first decrypting and re-encrypting stored tokens will make existing Spotify connections unreadable; users would need to reconnect. Temporary OAuth requests also become invalid after a key change. Never print the key in logs or support messages.

## Playback boundary

This dashboard feature links a Spotify account and displays account/playlist metadata. It does not stream Spotify audio. Existing legacy Spotify-to-other-provider search/playback paths are separate code and must be reviewed against the current Spotify Developer Terms before being offered commercially; this change does not expand those paths.
