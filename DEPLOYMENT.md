# Deployment Guide (Local + Remote)

This project now includes a built-in browser UI at `/` (served by `backend.api`).

## 1) What is required to host the UI

Minimum runtime requirements:

1. Python 3.9+ (3.11 recommended in containers).
2. Dependencies from `requirements.txt`.
3. OCR/system packages (for document workflows):
   - `tesseract-ocr`
   - `poppler-utils`
4. Writable persistent directories:
   - `data/output`
   - `data/api`
   - `data/inbox`
5. LLM/provider connectivity (LM Studio or Hermes) reachable from host.
6. Environment config (`.env`) with provider + inbox paths.
7. Optional security env:
   - `SF_API_KEY`
   - `SF_UI_ORIGINS`

## 2) Local host (same machine)

```bash
./run_backend.sh
```

Open:

- `http://127.0.0.1:8000/`

This is the fastest and most stable setup for day-to-day personal use.

## 3) Remote host on a VM (recommended for current architecture)

Why VM is recommended:

- The current runner writes artifacts/state to local filesystem (`data/*`).
- Runs are executed as background subprocesses from the API process.
- This behavior is straightforward on a VM with persistent disk.

### 3.1 Build and run with Docker

```bash
docker build -t sf-agentic-ai:latest .
docker run -d --name sf-agentic-ai \
  --restart unless-stopped \
  -p 127.0.0.1:8000:8080 \
  --env-file .env \
  -e SF_API_KEY=change-me \
  -e SF_UI_ORIGINS=https://your-domain.example \
  -v "$(pwd)/data:/app/data" \
  sf-agentic-ai:latest
```

### 3.2 Put HTTPS/domain in front

Use Nginx or Caddy as reverse proxy on ports 80/443:

- proxy target: `127.0.0.1:8000`
- force HTTPS
- keep request body size >= 50MB (file uploads)

Set DNS A record of your domain/subdomain to the VM public IP.

## 4) Google Cloud Run option (possible, but needs careful settings)

Cloud Run can host this UI+API, but because this app uses asynchronous background work after HTTP response, use:

1. Instance-based CPU allocation (`--no-cpu-throttling`).
2. `--min-instances=1` to reduce run interruption risk.
3. Persistent state redesign if you need durable multi-instance behavior (move `runs/uploads/artifacts` metadata to managed storage).

Example deploy:

```bash
PROJECT_ID=your-project \
SF_API_KEY=change-me \
SF_UI_ORIGINS=https://your-domain.example \
./scripts/deploy_cloud_run.sh sf-agentic-ai
```

## 5) Domain + access control with Google Workspace

For occasional remote access with your Workspace identities:

1. Use Google Cloud organization linked to your Workspace domain.
2. Put Cloud Run behind a global external Application Load Balancer for production custom domain/TLS control.
3. Configure IAP policy to allow only your Workspace user/group (if you choose IAP route).

If you use VM instead of Cloud Run, equivalent controls are:

1. Restrict source IP in firewall where possible.
2. Keep `SF_API_KEY` enabled.
3. Add SSO at reverse proxy layer later (OAuth2 proxy / Cloudflare Access / IAP via LB).
