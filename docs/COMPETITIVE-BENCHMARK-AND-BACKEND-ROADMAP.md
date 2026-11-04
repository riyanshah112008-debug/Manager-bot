# Starry dashboard competitive benchmark and backend roadmap

**Research snapshot:** 4 November 2026. This is a focused benchmark of major Discord management dashboards and specialist bots, not a claim that every Discord bot website on the internet has been exhaustively inspected. Product features and plan limits change; verify vendor documentation before copying a feature or pricing assumption.

## What leading products are good at

| Product | Strongest product pattern | What Starry should learn |
|---|---|---|
| MEE6 | Broad plugin ecosystem, onboarding and leveling | Organize a large feature set into predictable modules with guided setup |
| Dyno | Dashboard-first moderation, configurable modules and distinct web/moderation/AutoMod logs | Make configuration changes auditable and expose moderation history clearly |
| Carl-bot | Reaction roles, automod, logs, custom commands, embeds and role automation | Build reusable role/message workflows instead of isolated toggles |
| Wick | Dedicated anti-raid / anti-nuke protection and operational status | Treat security as a high-trust system with clear status, event history and recovery controls |
| Sapphire | Broad moderation and extensive logging | Make log coverage discoverable and searchable |
| ProBot | Welcome visuals, embeds, self-assignable roles and leveling | Provide previews and safe configuration for member-facing messages |
| Ticket Tool | Browser-based ticket inbox, staff actions, transcripts and analytics | Tickets should eventually be an operational inbox, not only a settings form |
| Apollo | Event creation, RSVP, reminders, waitlists and role/capacity rules | Scheduled events need lifecycle management and attendance workflows |
| YAGPDB | Custom commands and extensible automation | Advanced automation needs validation, permissions and documentation |

## Cross-product patterns worth adopting

1. **One Discord identity, one server selector.** The same authenticated identity should persist across every page. The UI should show the actual Discord avatar and display name, and clearly distinguish servers where Starry is installed from servers where it is not.
2. **Feature modules, not a wall of settings.** Group moderation and safety, onboarding, roles, logs, tickets, events, engagement, music and integrations into dedicated pages.
3. **Every control must be real.** A visible control must read from a real Discord/MongoDB source and save through a protected backend endpoint. If a feature is not connected, label it honestly rather than rendering fake switches.
4. **Least privilege and live authorization.** Check the user's current Discord membership and permissions when an operation runs; do not trust a month-old OAuth permission snapshot.
5. **Auditability.** Record who changed a dashboard setting, what changed, when it changed, and whether the operation succeeded. Keep this separate from Discord event/moderation logs.
6. **Operational visibility.** Expose bot readiness, database connectivity, module health, last error and deployment health without leaking secrets.
7. **Guided setup and previews.** Explain missing bot permissions, missing channels, incomplete configuration and the exact next action. Preview welcome messages and embeds before sending.
8. **Mobile-first workflows.** Server selection, forms, tables, ticket triage and event management must remain usable on a phone.

## Repository audit: current baseline

The repository already has a useful foundation:

- Discord OAuth authorization-code flow on Render, with MongoDB-backed hashed dashboard sessions (OAuthSession).
- A Firebase-hosted multi-page workspace and a shared request bridge that forwards protected API requests to Render.
- Protected guild APIs and existing endpoints for server settings, welcome configuration, leveling, economy, Discord Scheduled Events, moderation actions, music, embeds and booster roles.
- Existing bot modules and MongoDB models that should be reused rather than duplicated.

The audit also found gaps:

- The public landing page was static: it rendered a Sign in link but never called /auth/user or rendered an authenticated profile.
- The old root-level auth.js describes a second, incompatible client-side login scheme (different local-storage keys and a different callback URL). The current landing page does not load it. The supported flow should be the Render OAuth session only.
- OAuth callback handling previously accepted a code without validating OAuth state, and did not consistently check Discord HTTP status codes before accepting profile/guild payloads.
- Guild-admin authorization relied on permissions captured at login. Those permissions can become stale if a user loses a role or server access.
- Notifications remains an explicitly unconnected placeholder; its intended scope (server announcements/event alerts versus personal notification preferences) needs a product decision before a data model is designed.
- Not every dashboard page has a live API yet. Keep the existing honest unavailable state until each page is wired to the real module.

## Work included in the current authentication repair

- Connect the public landing page to the existing Render-backed /auth/user endpoint.
- Show the real Discord avatar and global display name when a valid session exists; otherwise retain Sign in.
- Add a dashboard shortcut and sign-out action to the connected profile.
- Keep the existing Firebase + Render architecture and the registered callback /auth/callback.
- Add one-time OAuth state validation using a short-lived HttpOnly, SameSite=Lax cookie.
- Check token, profile and guild API HTTP status before persisting a session.
- Persist the global Discord display name and return a correctly formatted static or animated avatar URL.
- Re-fetch a member's current Discord permissions before allowing guild-admin operations.
- Add Node syntax checks for the backend and shared dashboard scripts.

## Recommended implementation sequence after authentication is verified

### P0 — Reliability and security
- Add integration tests for OAuth success, denied consent, bad state, token exchange failure, missing MongoDB, expired session, logout and revoked server permissions.
- Move all session-sensitive endpoints behind consistent authorization middleware; use action-specific permission checks where appropriate.
- Add structured audit events for dashboard configuration writes.
- Add a small deployment/health diagnostics endpoint that reports service state without exposing environment variables or tokens.
- Verify Render deployment independently from Firebase Hosting deployment.

### P1 — Finish existing connected modules
- Settings and logging: validate channel types and bot permissions; add preview and audit history.
- Welcome and leveling: add preview, validation and safe rollback.
- Events: add edit/update, RSVP tracking and reminder delivery after create/list/cancel is stable.
- Moderation: expose case history and action outcomes, not just one-off action buttons.
- Music and embeds: surface queue state, permissions and Discord API failures clearly.

### P2 — Build missing modules only against existing bot engines
- Tickets: panels, categories, staff permissions, live inbox, claim/close/reopen, transcript retention and analytics.
- Roles: reaction/button/select-menu role panels, autoroles and role hierarchy checks.
- Notifications: decide whether this is server announcements and scheduled alerts, personal dashboard preferences, or both; keep those concepts separate.
- Automations: validated triggers/actions, rate limits, dry-run/preview and an audit trail.
- Analytics: server growth, moderation trends, ticket response times and leveling activity from real stored events.

### P3 — Product quality
- Guided per-server setup checklist and bot-permission diagnostics.
- Search/filter across servers and large tables.
- Granular dashboard roles (owner, administrator, moderator, support staff) with explicit allow/deny/inherit semantics.
- Accessibility, keyboard support, responsive tables, loading/empty/error states and cache invalidation.

## Research references

- Discord OAuth2 scopes and authorization-code flow: https://discord.com/developers/docs/topics/oauth2
- Discord user object and current-user guild endpoint: https://discord.com/developers/docs/resources/user
- Dyno dashboard and feature modules: https://dyno.gg/bot and https://docs.dyno.gg/en/modules
- Dyno dashboard/moderation/AutoMod audit logs: https://docs.dyno.gg/en/dashboard/logs
- Carl-bot dashboard and module overview: https://carl.gg/about and https://docs.carl.gg/
- Wick security dashboard: https://wickbot.com/
- ProBot welcome, embeds, roles and leveling: https://probot.io/
- Ticket Tool browser dashboard, inbox and transcripts: https://ticket-tool.app/docs/guides/ticket-bot-with-web-dashboard
- Apollo events, RSVPs, reminders and waitlists: https://apollo.fyi/
- MEE6 onboarding and plugin dashboard: https://mee6bot.freshdesk.com/support/solutions/articles/101000385394-getting-started-with-mee6
- Cross-product feature comparison (MEE6, Dyno, Carl-bot, Ticket Tool, YAGPDB, Apollo and others): https://heimdall.gg/compare/
- 2026 moderation/security comparison including Sapphire and Wick: https://toscio.com/guides/discord-moderation-bots/
