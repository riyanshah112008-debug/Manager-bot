# Starry website and Render backend deployment

The website is static content in `public/` and is deployed to Firebase Hosting. The Discord bot, OAuth callback, dashboard API, database access and music controls run on the Render Node.js service.

The browser bridge in `public/firebase-bridge.js` sends backend paths (`/api/`, `/auth/`, `/health`, and related routes) directly to the configured Render service. Firebase Hosting does not need a Cloud Function proxy for this setup.

## Deploy the website

1. Select the correct Firebase project.
2. Deploy the Hosting target with `firebase deploy --only hosting`.
3. Confirm the Firebase default domain and any custom domain both load the same Starry website.

## Render environment

Set these backend environment variables in Render:

- `FRONTEND_URL`: the primary public website origin, for example `https://YOUR_SITE.web.app`.
- `PUBLIC_URL`: the same public website origin (used by links and verification pages).
- `CORS_ORIGINS`: optional comma-separated list of every allowed website origin, including any custom domain.
- `DISCORD_REDIRECT_URI`: the Render backend callback URL, for example `https://YOUR_RENDER_SERVICE.onrender.com/auth/callback`.
- `CLIENT_ID` and `CLIENT_SECRET`: the Discord application's OAuth credentials.
- `DISCORD_TOKEN` and `MONGO_URI`: keep these only in Render's private environment settings.

## Discord Developer Portal

Add the exact value of `DISCORD_REDIRECT_URI` to the Discord application's OAuth2 redirect URI list. The callback belongs to the Render backend, not Firebase Hosting, because the backend performs the code exchange and creates the login session.

## Validation

1. Open the public website and confirm its assets load.
2. Select **Sign in** and complete Discord OAuth.
3. Confirm the callback returns to `FRONTEND_URL` and the profile appears.
4. Open the dashboard, select a server, and confirm its data loads.
5. Test a read-only dashboard API call before trying any server-changing control.

Firebase Hosting serves the website only. Keep the Discord Gateway process running on Render or another persistent Node.js host.
