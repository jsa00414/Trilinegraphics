# Triline Graphics

Multi-page marketing site for **Triline Graphics** — a brand and visual identity studio — with a client portal and admin hosting.

## Pages

- `index.html` — Home
- `work.html` — Selected work
- `craft.html` — Process / craft
- `portal.html` — Client portal (access-code unlock)
- `admin.html` — Upload & host websites on local ports (iframe preview)
- `contact.html` — Project inquiry

## Run locally

```bash
npm install
npm start
```

Then visit `http://localhost:4173`.

Optional env vars:

- `PORT` — main site port (default `4173`)
- `ADMIN_PASSWORD` — admin login (default `triline-admin`)
- `HOST_PORT_START` — first port used for uploaded sites (default `5100`)

## Admin hosting

1. Open `/admin.html` and sign in with the admin password
2. Upload a static website `.zip` that contains `index.html`
3. The server hosts it on `127.0.0.1:<port>`, generates a client access code, and shows an iframe preview
4. Share the access code so the client can open the site at `/portal.html`
5. Use **New code** to regenerate, **Copy code** to share, or **Stop** to shut the host down

Optional: set a custom access code on upload (format `TRI-XXXX`).

## Client portal

Clients enter an access code on `/portal.html` to open their private website preview.

Demo codes:

| Code | Client site |
| --- | --- |
| `TRI-NORTH` | Northbound Coffee |
| `TRI-FIELD` | Fieldnote Atlas |
| `TRI-ORBIT` | Orbit Labs |

Uploaded hosts use auto-generated codes like `TRI-A7K2M9` shown in Admin.
