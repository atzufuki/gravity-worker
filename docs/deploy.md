# Deno Deploy Deployment Guide 🚀

This guide walks you through deploying the **Herkules** web application, Keyless Token Relay, and WebSocket execution tunnel server to [Deno Deploy](https://deno.com/deploy).

---

## 🌟 Overview

When deployed to Deno Deploy, Herkules acts as a high-availability, low-latency edge application:
- **`/health/`**: Health check & status endpoint.
- **`/api/token`**: Keyless Token Relay for GitHub Actions CI runners.
- **`/ws/owner/repo/`**: Zero-auth WebSocket execution tunnel for local workstation daemons.

---

## ⚡ Option 1: Automatic Deployment via GitHub Integration (Recommended)

1. Open [dash.deno.com](https://dash.deno.com/) and sign in with your GitHub account.
2. Click **New Project** → Select **Import from GitHub repository**.
3. Choose repository **`atzufuki/herkules`** and target branch **`main`**.
4. Configure Deployment settings (**Edit app configuration**):
   - **Framework Preset**: `No Preset`
   - **Entrypoint**: `project/http.ts`
   - **Project Name**: `herkules`
5. Click **Deploy Project**.

---

## 🛠️ Option 2: Deploy via CLI (`deno task deploy`)

You can also deploy manually or from local command line using `deployctl`:

```bash
# Deploy to Deno Deploy
deno task deploy
```

*(Note: Requires `DENO_DEPLOY_TOKEN` environment variable or logging in via `deno run -A jsr:@deno/deployctl login`).*

---

## 🔑 Required Environment Variables on Deno Deploy

Configure the following environment variables under **Project Settings** → **Environment Variables** in the Deno Deploy dashboard:

| Variable | Required | Description |
| :--- | :---: | :--- |
| `HERKULES_APP_ID` | Yes | GitHub App ID for dedicated `@herkules[bot]` identity (default: `4375516`) |
| `HERKULES_PRIVATE_KEY` | Yes | Private RSA Key (`.pem` format) for signing RS256 JWT tokens |
| `SECRET_KEY` | Recommended | Random secret string for session signing |
| `DEBUG` | No | Set `false` in production (default: `false`) |

---

## 🤖 Connecting GitHub Actions CI Runners to Deno Deploy Relay

Once your project is live on Deno Deploy (`https://herkules.atzufuki.deno.net`), set `HERKULES_RELAY_URL` secret in your target GitHub repositories (handled automatically by `./herkules install`):

```bash
gh secret set HERKULES_RELAY_URL -b "https://herkules.atzufuki.deno.net" --repo owner/repo
```

GitHub Actions runners will automatically query your Deno Deploy instance for keyless installation access tokens!
