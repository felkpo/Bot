# Deploy & Ollama Integration Guide

This document explains how to run Ollama locally, expose it via a public HTTPS URL (ngrok / cloudflared), set environment variables for Railway, and deploy the `royal-prussian-bot` that now uses Ollama as the LLM backend.

## 1. Install Ollama on Windows
1. Visit https://ollama.com and follow the Windows installation instructions.
2. After install, open PowerShell and verify:

```powershell
ollama --version
```

3. Pull the model (example):

```powershell
ollama pull qwen3:8b
```

## 2. Start Ollama locally
By default Ollama listens on port `11434`. Start it according to its docs (if using a service, ensure it's running):

```powershell
ollama serve
```

## 3. Expose Ollama via a public HTTPS tunnel
You must provide a public HTTPS URL to Railway so the bot (running on Railway) can reach your local Ollama instance.

### Option A — Ngrok
1. Install ngrok and authenticate.
2. Run:

```powershell
ngrok http 11434
```

3. Copy the HTTPS URL from ngrok (e.g. `https://abcd-11434.ngrok.io`).

### Option B — Cloudflare Tunnel
1. Install `cloudflared`.
2. Run:

```powershell
cloudflared tunnel --url http://localhost:11434
```

3. Copy the HTTPS URL provided by Cloudflare.

> Important: Use the HTTPS public URL provided by the tunnel as `OLLAMA_URL`. Do not hardcode `localhost`.

## 4. Railway configuration
1. In your Railway project, open the Environment variables settings.
2. Set:
   - `OLLAMA_URL` = `https://your-tunnel-url` (the ngrok/cloudflared URL)
   - `OLLAMA_MODEL` = `qwen3:8b` (or another supported model)
   - Keep other vars (`DISCORD_TOKEN`, `CLIENT_ID`, etc.) as before.
3. Ensure Railway runtime Node version is >= 18.

## 5. Verify from local machine
Test the Ollama endpoint from your local machine:

```powershell
curl -X POST https://your-tunnel-url/api/generate -H "Content-Type: application/json" -d "{ \"model\": \"qwen3:8b\", \"prompt\": \"Olá\", \"max_tokens\": 16 }"
```

Expected: JSON output or text response indicating the model generated a short reply.

## 6. Deploy to Railway
From the project root (if using Railway CLI):

```powershell
railway up --detach
```

Or push your commits to the repository connected to Railway — Railway will start builds automatically.

## 7. Bot runtime behavior
- The bot uses `OLLAMA_URL` and `OLLAMA_MODEL` to connect.
- If Ollama is offline the bot continues to run and replies "Minha IA está temporariamente indisponível." when invoked.
- The system keeps all features: memory (SQLite), tool-calling, embeds, moderation, confirmations, logs and cooldowns.

## 8. Troubleshooting
- If Railway cannot reach your tunnel URL, make sure the tunnel is up and listening and that your machine is online.
- If the model isn't found, check logs from Ollama and confirm the model was pulled.

## 9. Optional: Automate tunnel
You can create a small script on your local machine to start Ollama and ngrok/cloudflared, then print the OLLAMA_URL to paste into Railway.

---
If you want, I can commit this `README_DEPLOY.md` and monitor Railway logs until the build finishes. Let me know to proceed.