# Setup: Slack + Buffer (social-media phase)

Both integrations are **keyless-first**: the backend runs fine with no tokens —
the Slack "subagent chat" hook is a silent no-op and the SocialAgent speaks a
"connect Buffer" message. Add the tokens below and the live paths activate with
**no code change**. Verify offline anytime with:

```bash
cd backend
node scripts/social-selftest.mjs
```

---

## Slack — outbound "subagent chat" (5 min)

The voice loop posts one parent message per command to a channel, then one
threaded reply per agent that ran (🟢 success / 🔴 failure) — so the channel
reads like the specialized agents talking back. This is **outbound only**;
inbound control (slash commands / Events API) is a later phase.

1. **Create the app** → https://api.slack.com/apps → *Create New App* →
   *From scratch*. Name it (e.g. `MotherCode`), pick your workspace.
2. **Add a bot scope** → *OAuth & Permissions* → *Scopes* → *Bot Token Scopes* →
   add **`chat:write`**. (That's all the hook needs. `auth.test`, used by the
   status endpoint, requires no extra scope.)
3. **Install** → *Install to Workspace* → *Allow*. Copy the **Bot User OAuth
   Token** — it starts with `xoxb-`.
4. **Add it to `backend/.env`:**
   ```ini
   SLACK_BOT_TOKEN=xoxb-your-real-token
   SLACK_CHANNEL=#mothercode-notifications
   ```
5. **Invite the bot to the channel** so it can post:
   in Slack, open the channel and type `/invite @MotherCode` (or your app name).

**Verify live:** restart the backend, run a voice command, and watch the channel
— a `🎙` parent message appears with a threaded reply per invoked agent.
Check the connection with `GET http://localhost:3001/api/slack/status` →
`{ "connected": true, "team": "…" }`.

> `channelCount` is intentionally absent from the status response — counting
> channels needs the `channels:read` scope, which this minimal setup skips.
> `SLACK_SIGNING_SECRET` in `.env.example` is reserved for the future inbound
> (Events API) phase and is unused today.

---

## Buffer — social scheduling (SocialAgent)

> ⚠️ **Heads-up:** Buffer's public REST API is gated behind their app-approval
> process. The client (`src/integrations/bufferClient.js`) is built and gated
> against the documented API shape, but live posting only works once you have an
> **approved** Buffer access token. Until then `BUFFER_API_KEY` stays a
> placeholder and the SocialAgent cleanly speaks the "connect Buffer" message.

1. Get an access token from your approved Buffer app
   (https://buffer.com/developers/api).
2. Find your channel/profile IDs (the `GET /1/profiles.json` response, or the
   Buffer dashboard).
3. **Add to `backend/.env`:**
   ```ini
   BUFFER_API_KEY=your-approved-token
   BUFFER_CHANNEL_TIKTOK=your-tiktok-profile-id
   BUFFER_CHANNEL_INSTAGRAM=your-instagram-profile-id
   ```

**Verify live:** restart the backend, then either say *"schedule a TikTok about
our launch tomorrow at 5pm"* through the voice loop, or call
`GET http://localhost:3001/api/buffer/posts/scheduled` — the scheduled post
appears in Buffer and in that response.

The SocialAgent picks target platforms from the transcript ("tiktok",
"instagram", …); when none are named it falls back to whichever
`BUFFER_CHANNEL_*` IDs are configured.
