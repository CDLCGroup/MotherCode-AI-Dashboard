# Connecting Google (Calendar + Gmail) to MotherCode

The Calendar and Email agents work **keyless** out of the box — they reply with a
"connect your Google account" message until you finish the steps below. Once
connected, the same voice commands create real events, read real mail, and draft
real replies. **No code change needed** — just credentials + a one-time consent.

## 1. Create the Google Cloud project + enable the APIs

1. Go to <https://console.cloud.google.com/> and create (or pick) a project.
2. **Enable both APIs** (APIs & Services → Library → search → Enable):
   - **Google Calendar API**
   - **Gmail API**
   > Skipping this is the #1 cause of a `403` at command time.

## 2. Configure the OAuth consent screen

1. APIs & Services → **OAuth consent screen** → User type **External** → Create.
2. Fill the app name + your email. Save.
3. **Test users** → add your own Google account.
   (While the app is in "Testing", only listed test users can authorize — that's fine
   for a personal assistant.)

## 3. Create the OAuth client (this gives you the ID + secret)

1. APIs & Services → **Credentials** → Create Credentials → **OAuth client ID**.
2. Application type: **Web application**.
3. Under **Authorized redirect URIs**, add this **exactly** (copy/paste — a single
   character off causes `redirect_uri_mismatch`):

   ```
   http://localhost:3001/auth/google/callback
   ```

4. Create → copy the **Client ID** and **Client secret**.

## 4. Put the credentials in `.env`

Edit `backend/.env`:

```
GOOGLE_CLIENT_ID=<your client id>
GOOGLE_CLIENT_SECRET=<your client secret>
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
```

(The redirect URI is already set correctly in the template — leave it byte-identical
to what you pasted into the Console.)

## 5. Authorize (one time)

1. Restart the backend: `npm run dev` (from `backend/`).
2. Open <http://localhost:3001/auth/google> in your browser.
3. Pick your account → approve Calendar + Gmail access.
4. You'll land on a "✅ Google account connected" page. Done.

This writes `backend/.google-tokens.json` (gitignored). The agents auto-refresh the
access token from here, so you won't need to re-authorize unless you revoke access
or delete that file.

## 6. Verify

- `GET http://localhost:3001/auth/google/status` → `{ "configured": true, "authorized": true, ... }`
- Voice/text commands now go live:
  - *"Schedule a planning call tomorrow at 2pm"* → creates a real Calendar event.
  - *"Read my urgent email"* → summarizes recent unread mail.
  - *"Draft a reply"* → creates a Gmail **draft** (never auto-sent — you review and send).

## Scopes requested

| Scope | Why |
|-------|-----|
| `calendar.events` | create + list events |
| `gmail.readonly` | read unread/urgent mail |
| `gmail.compose` | create draft replies (no send permission) |

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `redirect_uri_mismatch` | The Console redirect URI isn't byte-identical to `GOOGLE_REDIRECT_URI`. Re-copy `http://localhost:3001/auth/google/callback`. |
| `403` on a command | Calendar or Gmail API not enabled (step 1), or wrong scopes — delete `.google-tokens.json` and re-authorize. |
| `access_denied` at consent | Your account isn't a listed **test user** (step 2.3). |
| Agents still say "connect your Google account" | Token file missing — complete step 5, confirm `/auth/google/status` shows `authorized: true`. |
