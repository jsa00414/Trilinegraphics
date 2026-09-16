# Triline Graphics

Multi-page marketing site for **Triline Graphics** — a brand and visual identity studio.

## Pages

- `index.html` — Home
- `work.html` — Selected work
- `craft.html` — Process / craft
- `portal.html` — Client portal (access-code unlock)
- `contact.html` — Project inquiry

## Client portal

Clients enter an access code on `/portal.html` to open their private website preview.

Demo codes:

| Code | Client site |
| --- | --- |
| `TRI-NORTH` | Northbound Coffee |
| `TRI-FIELD` | Fieldnote Atlas |
| `TRI-ORBIT` | Orbit Labs |

Unlocked sessions are stored in `sessionStorage` and cleared via **Exit & lock** on the client bar.

## Run locally

```bash
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.
