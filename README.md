# Starry — Discord Server Management

Starry is a Discord server-management bot and control center built to bring moderation, safety, community engagement, music integrations and server configuration into one coherent workspace.

The project is developed around a simple principle: **every visible control must correspond to a real, authorized backend capability**. Features should fail clearly when a dependency or permission is missing; the dashboard must never imply that an inactive feature is working.

## Product areas

- **Safety & moderation:** moderation workflows, AutoMod controls, verification and Anti-Nuke safeguards.
- **Community:** tickets, welcome flows, roles, events, birthdays and notifications.
- **Engagement:** giveaways, leveling, economy and booster tools.
- **Music & integrations:** Discord voice features and account integrations, subject to each provider's API and licensing rules.
- **Control Center:** Discord OAuth sign-in, server selection and server-scoped configuration.
- **Operations:** multi-bot management, diagnostics, permissions and configuration visibility.

Availability depends on the deployed bot build, configured environment variables, Discord permissions and external provider restrictions. A feature is not considered production-ready until its API, persistence, runtime behavior and dashboard path have all been tested together.

## Starry Discord profile copy

The recommended short profile text and extended application description are maintained in [docs/BRAND-PROFILE.md](docs/BRAND-PROFILE.md). Update the Discord Developer Portal application description and bot profile manually; this repository cannot change Discord's hosted profile metadata without an authorized application-management credential.

## Development

Requirements:
- Node.js 22.12 or newer
- A Discord application and bot token
- MongoDB connection for the features that use persistent models
- Provider credentials only for integrations that are enabled

Install dependencies and run the repository checks:

```bash
npm ci
npm test
```

Copy `.env.example` to a private environment file and configure only the variables required by the features being deployed. Never commit bot tokens, OAuth secrets, payment secrets, encryption keys or database credentials.

## Deployment and release discipline

1. Run syntax checks and the full test suite.
2. Review authorization, input validation, rate limits and secret handling.
3. Verify database writes and restart persistence.
4. Test Discord permissions and role hierarchy in a staging server.
5. Test the dashboard and bot behavior together against the deployed backend.
6. Verify provider and payment webhooks with provider test environments.
7. Deploy only after required checks pass; monitor logs and retain a rollback path.

A green CI run is necessary, but it is not proof of live Discord, provider, payment or hosting behavior.
