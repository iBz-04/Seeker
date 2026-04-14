# Seeker

Seeker is a deep research assistant that turns a rough prompt into a structured answer or a long-form report. It uses iterative search, follow-up questions, and document generation to produce work that is meant to be read, downloaded, and reused.

## What it does

- Runs a research loop over web sources and LLM synthesis.
- Asks clarification questions when a report needs more context.
- Produces either a short answer or a detailed report.
- Exports reports as both Markdown and `.docx` files.
- Surfaces report download actions in the frontend instead of dumping the whole document in chat.

## Repository layout

- `src/` - backend research engine, CLI, and API server.
- `frontend/` - Next.js app for the chat UI.
- `render.yaml` - Render deployment blueprint for the backend.
- `docker-compose.yml` - local container setup for the backend.

## Quick start

### Prerequisites

- Node.js 22.x
- pnpm
- API keys for Firecrawl and an LLM provider

### Install

```bash
pnpm install
cd frontend && pnpm install
```

### Configure environment

Create a `.env.local` file at the repo root for the backend. The frontend reads `SEEKER_BACKEND_URL` when it is not running against the local API.

Typical backend variables:

```ini
FIRECRAWL_KEY="your_firecrawl_key"
OPENAI_KEY="your_openai_key"
# or
FIREWORKS_API_KEY="your_fireworks_key"

CONTEXT_SIZE=8000
OPENAI_ENDPOINT="https://api.openai.com/v1"
FIREWORKS_MODEL="your-model-name"
```

## Run locally

### Backend only

```bash
pnpm api:dev
```

### CLI mode

```bash
pnpm cli
```

### Frontend

```bash
cd frontend
pnpm dev
```

If the frontend is deployed separately, point it at the backend with:

```ini
SEEKER_BACKEND_URL="https://your-render-service.onrender.com/api/research"
```

## Output modes

- `answer` - concise response for direct questions.
- `report` - long-form report with sources and download options.

When report mode finishes, the UI shows a compact report card with download actions for the `.md` and `.docx` files.

## Downloadable reports

Report generation saves two files on the backend:

- Markdown source for easy editing and reuse.
- Word document for direct sharing.

The files are returned to the frontend as part of the research response and can be downloaded from the UI. They are not meant to be treated as permanent storage.

## Deployment

### Backend on Render

The repo includes [`render.yaml`](render.yaml) for a Render web service.

Suggested settings if you configure Render manually:

- Runtime: Node
- Build command: `pnpm install --frozen-lockfile`
- Start command: `node index.js`
- Health check path: `/healthz`

Set the required environment variables in Render, then verify:

```bash
curl https://your-render-service.onrender.com/healthz
```

### Frontend hosting

Deploy the frontend separately and set `SEEKER_BACKEND_URL` to the Render backend URL.

## Notes

- Breadth is limited to `1-10`.
- Depth is limited to `1-5`.
- The frontend proxies backend requests so the app can work with a remote Render deployment without exposing backend internals.
