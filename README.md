# Manager Bot — rewrite branch

A clean, slash-command-first Discord community bot. This rewrite keeps the project’s distinctive community-management ideas—web-assisted role verification, ticket panels, a server bump directory, starboard, reminders, and a lightweight health dashboard—without importing code from Flav’s repositories.

## Requirements

- Node.js 20+
- A Discord application and bot token
- Enable the bot's **Server Members Intent** in the Discord Developer Portal for role verification.

## Run locally

```sh
npm install
cp .env.example .env
# Set DISCORD_TOKEN in .env
npm start
```

The bot registers its slash commands on startup. Invite it with `bot` and `applications.commands` scopes. Grant only the permissions needed for the features you enable (Manage Channels/Roles, Send Messages, Embed Links, and Moderate Members as applicable). Place the bot role above the verified role.

## Commands

- `/help` — command overview.
- `/setup welcome|logs|verification|tickets|starboard` — configure guild features. Requires Manage Server.
- `/verify panel` — post a verification button. The button assigns the configured role; it does not collect credentials or claim to perform CAPTCHA.
- `/ticket panel|close` — publish a support panel or close the current ticket.
- `/remind` — create a reminder in the current channel.
- `/bump` — add or refresh your guild in the local server directory using a `discord.gg` invite.
- `/directory` — view listed communities.
- `/serverinfo` — show basic server information.

The HTTP service exposes `/health` and a read-only `/api/status`; it never accepts bot tokens or writes secrets to disk. Set `PORT` on hosting platforms. Persistent feature data is stored as JSON under `DATA_DIR` (default `./data`). Keep that directory on a persistent volume if reminders and configuration should survive redeployments.

## Configuration and safety

- Store `DISCORD_TOKEN` in your host's secret/environment settings, not in source control.
- Keep role hierarchy and channel permissions least-privileged.
- Verification buttons are single-purpose role assignment and require a configured role.
- Ticket channels are private to the opener, bot, and configured support role.
- Reminders mention no one except their owner.

## Rewrite notes

This version uses the existing Discord.js and Express dependencies. The rewrite replaces the active application entry point and project documentation. Older files are not loaded by the new entry point; they remain in Git history and in the repository tree so they can be removed in a later cleanup commit if desired.
