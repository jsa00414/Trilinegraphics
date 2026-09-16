# Triline Graphics

Multi-page site for **Triline Graphics** — a studio focused on client websites, with a portal and admin hosting for private website previews.

## Pages

- `index.html` — Home
- `work.html` — Selected websites
- `craft.html` — Website process
- `portal.html` — Client portal (access-code unlock for websites)
- `admin.html` — Upload & host website zips on local ports (iframe preview)
- `contact.html` — Website project inquiry

## Run locally

```bash
npm install
npm start
```

Then visit `http://localhost:4173`.

Optional env vars:

- `PORT` — main site port (default `4173`)
- `ADMIN_PASSWORD` — admin login (default `triline-admin`)
- `HOST_PORT_START` — first port used for uploaded websites (default `5100`)

## Admin hosting

1. Open `/admin.html` and sign in with the admin password
2. Upload a static website `.zip` that contains `index.html`
3. The server hosts it on `127.0.0.1:<port>`, generates a client access code, and shows an iframe preview
4. Share the access code so the client can open the website at `/portal.html`
5. Use **New code** to regenerate, **Copy code** to share, or **Stop** to shut the host down

Optional: set a custom access code on upload (format `TRI-XXXX`).

## Client portal

Clients enter an access code on `/portal.html` to open their private website preview.

Demo codes:

| Code | Website |
| --- | --- |
| `TRI-NORTH` | Northbound Coffee |
| `TRI-FIELD` | Fieldnote Atlas |
| `TRI-ORBIT` | Orbit Labs |

Uploaded hosts use auto-generated codes like `TRI-A7K2M9` shown in Admin.
