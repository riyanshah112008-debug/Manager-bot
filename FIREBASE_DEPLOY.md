# Firebase website deployment

The public website is served from `public/`. The Discord bot and its authenticated API remain on the Node.js backend; Firebase Hosting forwards `/api/**` and `/auth/**` to that backend through a small Cloud Function proxy.

## Deploy

1. Install the Firebase CLI and sign in: `npm install -g firebase-tools`, then `firebase login`.
2. Create/select your Firebase project: `firebase use --add`. Do not commit private credentials.
3. Set the proxy target during deployment when prompted, or set the Functions parameter `BOT_BACKEND_URL` to your existing Render service URL (for example, the HTTPS URL shown in the Render service dashboard).
4. Deploy: `firebase deploy --only hosting,functions`.

Firebase Functions deployment requires a Firebase project with billing enabled (Blaze plan). Hosting alone can be deployed separately, but dashboard API routes will not work until the proxy is deployed and configured.

## Backend and Discord OAuth settings

After Firebase assigns your Hosting domain, set these variables in the Render service:

- `PUBLIC_URL`: your Firebase Hosting HTTPS domain.
- `DISCORD_REDIRECT_URI`: `https://YOUR_FIREBASE_DOMAIN/auth/callback`.

Add that exact redirect URI to the Discord Developer Portal OAuth2 redirect list. Keep `DISCORD_TOKEN`, MongoDB credentials, Spotify secrets, and other private values only in the backend environment; never put them in `public/`.

The bot process itself must stay on a persistent Node.js host. Firebase Hosting is for the website, not a long-running Discord Gateway connection.
