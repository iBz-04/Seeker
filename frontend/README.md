# Frontend

This folder contains the Next.js UI for Seeker.

## Run locally

```bash
pnpm install
pnpm dev
```

If the backend is deployed separately, set `SEEKER_BACKEND_URL` to the backend research endpoint, for example:

```ini
SEEKER_BACKEND_URL="https://your-render-service.onrender.com/api/research"
```

## What it does

- Sends research requests to the backend API.
- Shows concise answers in chat.
- Shows long reports as a compact document card with download actions.
- Proxies download requests so `.md` and `.docx` files can be fetched from the browser.