<h1 align="center">ChatGPT2API</h1>

<p align="center">ChatGPT2API is mainly designed to reverse-engineer and encapsulate ChatGPT Web capabilities, providing an OpenAI-compatible Image API / Proxy for ChatGPT image generation, image editing, and multi-image composition scenarios. It integrates an online painting workspace, account pool management, multiple account import methods, and Docker self-hosting deployment capabilities.</p>

> [!WARNING]
> Disclaimer:
>
> This project involves reverse-engineering and studying endpoints related to ChatGPT text generation, image generation, and image editing. It is intended for personal learning, technical research, and non-commercial technical exchange only.
>
> - It is strictly forbidden to use this project for any commercial purposes, profitable use, batch operations, automated abuse, or scale calls.
> - It is strictly forbidden to use this project to disrupt market order, engage in malicious competition, arbitrage, resell related services, or any behavior that violates OpenAI Terms of Service or local laws and regulations.
> - It is strictly forbidden to use this project to generate, disseminate, or assist in generating illegal, violent, pornographic, minor-related content, or use it for fraud, deception, harassment, or other illegal/inappropriate purposes.
> - Users should bear all risks themselves, including but not limited to accounts being restricted, temporarily banned, or permanently banned, as well as legal liabilities arising from non-compliance.
> - Using this project implies that you fully understand and agree to all contents of this disclaimer. If any consequences occur due to abuse, non-compliance, or illegal use, the user shall bear full responsibility.
> - This project is based on reverse-engineering ChatGPT Web capabilities, so there is a risk of account restriction, temporary ban, or permanent ban. Do not use your own important, commonly used, or high-value accounts for testing.

## Quick Start

### Docker Running

```bash
git clone git@github.com:basketikun/chatgpt2api.git
cd chatgpt2api
docker compose up -d
```

Before starting, please set the `auth-key` in `config.json`, which can also be overridden by `CHATGPT2API_AUTH_KEY` in `docker-compose.yml`.

- Web Panel: `http://localhost:3000`
- API Address: `http://localhost:3000/v1`
- Data Directory: `./data`

### Stable Proxy Deployment via WARP / FlareSolverr

If you frequently encounter Cloudflare blocks on registration or image endpoints, you can enable the bundled WARP + Privoxy + FlareSolverr solution:

```bash
cp .env.example .env
docker compose -f docker-compose.warp.yml up -d --build
```

This compose configuration starts:

- `warp-proxy`: Provides SOCKS5 egress via Cloudflare WARP.
- `privoxy`: Converts SOCKS5 egress from WARP to HTTP proxy.
- `flaresolverr`: Refreshes Cloudflare clearances.
- `init-config`: Idempotently writes default settings to `proxy_runtime`.
- `app`: Starts the ChatGPT2API main service.

By default, only upstream OpenAI / ChatGPT requests are routed through this stable proxy. Auxiliary chains like account email verification and CPA will not be forcibly intercepted. Accounts' own configured proxies have the highest priority, followed by the stable proxy runtime, then explicit proxies, and lastly legacy global proxies.

You can adjust ports and proxy runtime parameters in `.env`, or manually save, test proxies, and test clearances in the "Stable Proxy Runtime" panel on the backend settings page.

### Local Development

Start backend:

```bash
git clone git@github.com:basketikun/chatgpt2api.git
cd chatgpt2api
uv sync
uv run main.py
```

Start frontend:

```bash
cd chatgpt2api/web
bun install
bun run dev
```

Update to the latest version:

```bash
docker pull ghcr.io/basketikun/chatgpt2api:latest
docker-compose down
docker-compose up -d
```

### Storage Backend Configuration

Support switching storage methods via the `STORAGE_BACKEND` environment variable:

- `json` - Local JSON file (default)
- `sqlite` - Local SQLite database
- `postgres` - External PostgreSQL (requires `DATABASE_URL`)
- `git` - Private Git repository (requires `GIT_REPO_URL` and `GIT_TOKEN`)

Example: Using PostgreSQL

```yaml
environment:
  - STORAGE_BACKEND=postgres
  - DATABASE_URL=postgresql://user:password@host:5432/dbname
```

## Features

### API Compatibility

- Compatible with the `POST /v1/images/generations` image generation API
- Compatible with the `POST /v1/images/edits` image editing API
- Compatible with `POST /v1/chat/completions` tailored for image scenarios
- Compatible with `POST /v1/responses` tailored for image scenarios
- `GET /v1/models` returns `gpt-image-2`, `codex-gpt-image-2`, `auto`, `gpt-5`, `gpt-5-1`, `gpt-5-2`, `gpt-5-3`, `gpt-5-3-mini`, `gpt-5-mini`
- Supports returning multiple generated results via `n`
- Supports generating editable PPT files
- Supports generating editable PSD files
- Reverse-engineered the painting API from Codex, available only for `Plus` / `Team` / `Pro` subscriptions, using the model alias `codex-gpt-image-2`. If needed, you can map it back to `gpt-image-2` in other clients to distinguish it from the official painting. This means the same account will have both official and Codex image generation quotas.

### Online Painting Workspace

- Built-in online painting workspace supporting image generation, image editing, and multi-image composition
- Model selection including `gpt-image-2`, `codex-gpt-image-2`, `auto`, `gpt-5`, `gpt-5-1`, `gpt-5-2`, `gpt-5-3`, `gpt-5-3-mini`, `gpt-5-mini`
- Edit mode supports reference image upload
- Frontend supports multi-image generation interaction
- Local saving of image session history with support for viewing, deleting, and clearing
- Server-side image URL caching support
- Image generation progress tracking with the option to continue waiting after timeouts
- Image lazy-loading and scroll position memory to optimize performance in scenes with massive images

### Account Pool Management

- Auto-refreshes account email, type, quota, and recovery time (async progress tracking)
- Polls available accounts to perform image generation and editing
- Auto-removes invalid tokens upon encountering token expiration/invalid errors
- Periodically checks rate-limited accounts and refreshes them automatically
- Supports password re-login to recover abnormal accounts, with auto-login options after refreshing
- Supports Web UI configuration of global HTTP / HTTPS / SOCKS5 / SOCKS5H proxies
- Supports WARP / FlareSolverr stable proxy runtime
- Supports searching, filtering, batch refreshing, exporting, manually editing, and cleaning accounts
- Supports four import methods: local CPA JSON file import, remote CPA server import, `sub2api` server import, and `access_token` import
- Supports configuring `sub2api` servers on the settings page to filter and batch import OpenAI OAuth accounts from them

### Experimental / Roadmap

- For detailed status descriptions, see [Feature Status List](./docs/feature-status.en.md)

## Demos

<table width="100%">
  <tr>
    <td width="50%"><img src="https://i.ibb.co/Jj8nfwwP/image.png" alt="image" border="0"></td>
    <td width="50%"><img src="https://i.ibb.co/pqf235v/image-edit.png" alt="image edit" border="0"></td>
  </tr>
  <tr>
    <td width="50%"><img src="https://i.ibb.co/tPcqtVfd/chery-studio.png" alt="chery studio" border="0"></td>
    <td width="50%"><img src="https://i.ibb.co/PsT9YHBV/account-pool.png" alt="account pool" border="0"></td>
  </tr>
  <tr>
    <td width="50%"><img src="https://i.ibb.co/rRWLG08q/new-api.png" alt="new api" border="0"></td>
  </tr>
</table>

## API Reference

All AI endpoints require the request header:

```http
Authorization: Bearer <auth-key>
```

<details>
<summary><code>GET /v1/models</code></summary>
<br>

Returns the list of currently exposed image models.

```bash
curl http://localhost:8000/v1/models \
  -H "Authorization: Bearer <auth-key>"
```

<details>
<summary>Description</summary>
<br>

| Field | Description |
|:-----|:-----------------------------------------------------------------------------------------------------------|
| Returned Models | `gpt-image-2`, `codex-gpt-image-2`, `auto`, `gpt-5`, `gpt-5-1`, `gpt-5-2`, `gpt-5-3`, `gpt-5-3-mini`, `gpt-5-mini` |
| Integrations | Can connect to upstream clients like Cherry Studio or New API |

<br>
</details>
</details>

<details>
<summary><code>POST /v1/images/generations</code></summary>
<br>

OpenAI-compatible image generation API for text-to-image.

```bash
curl http://localhost:8000/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <auth-key>" \
  -d '{
    "model": "gpt-image-2",
    "prompt": "a cat floating in space",
    "n": 1,
    "response_format": "b64_json"
  }'
```

<details>
<summary>Field Description</summary>
<br>

| Field | Description |
|:------------------|:---------------------------------------------------|
| `model` | Image model, current values based on the `/v1/models` return, recommended to use `gpt-image-2` |
| `prompt` | Prompt for image generation |
| `n` | Number of images to generate, currently limited to `1-4` by the backend |
| `response_format` | Included in requests, defaults to `b64_json` |

<br>
</details>
</details>

<details>
<summary><code>POST /v1/images/edits</code></summary>
<br>

OpenAI-compatible image editing API. Supports uploading image files directly, or passing image URLs according to the official JSON format to generate edited results.

```bash
curl http://localhost:8000/v1/images/edits \
  -H "Authorization: Bearer <auth-key>" \
  -F "model=gpt-image-2" \
  -F "prompt=change this image to cyberpunk night street style" \
  -F "n=1" \
  -F "image=@./input.png"
```

You can also pass image URLs directly:

```bash
curl http://localhost:8000/v1/images/edits \
  -H "Authorization: Bearer <auth-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-2",
    "prompt": "change this image to cyberpunk night street style",
    "images": [
      {"image_url": "https://example.com/input.png"}
    ]
  }'
```

<details>
<summary>Field Description</summary>
<br>

| Field | Description |
|:------------|:----------------------------------------------|
| `model` | Image model, `gpt-image-2` |
| `prompt` | Prompt for image editing |
| `n` | Number of images, currently limited to `1-4` by the backend |
| `image` | Image file to edit, upload via multipart/form-data |
| `images` | Array of JSON image references, supporting `{"image_url": "https://..."}` |
| `image_url` | In form mode, you can directly pass image links, supporting duplicate fields to pass multiple images |

<br>
</details>
</details>

<details>
<summary><code>POST /v1/chat/completions</code></summary>
<br>

Chat Completions compatible API for text, web search, and image scenarios (not a full general chat proxy).

```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <auth-key>" \
  -d '{
    "model": "gpt-image-2",
    "messages": [
      {
        "role": "user",
        "content": "generate a cyberpunk cat in space on a rainy night"
      }
    ],
    "n": 1
  }'
```

<details>
<summary>Field Description</summary>
<br>

| Field | Description |
|:---------------------|:-----------------------------------------------------------------------------|
| `model` | Text, search, or image model; search model triggers web search compatibility logic |
| `messages` | Array of messages, supporting text, search, and image request contents |
| `n` | Number of images to generate, parsed as image count in the current implementation |
| `stream` | Supported for text, search, and image scenarios (currently in testing) |
| `tools` | Text scenarios support `web_search` / `web_search_preview` / `web_search_preview_2025_03_11` |
| `web_search_options` | Triggers web search compatibility logic when provided |

<br>
</details>
</details>

<details>
<summary><code>POST /v1/responses</code></summary>
<br>

Responses API compatible API for text, web search, and image generation tool calls (not a full general Responses API proxy).

```bash
curl http://localhost:8000/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <auth-key>" \
  -d '{
    "model": "gpt-5",
    "input": "generate a futuristic city skyline image",
    "tools": [
      {
        "type": "image_generation"
      }
    ]
  }'
```

<details>
<summary>Field Description</summary>
<br>

| Field | Description |
|:---------|:----------------------------------------------------------------------------------------|
| `model` | Echoed back in the response; search and image generation trigger corresponding compatibility logic |
| `input` | Input content; search uses the last user message, image generation extracts the prompt |
| `tools` | Supports `image_generation`, `web_search`, `web_search_preview`, `web_search_preview_2025_03_11` |
| `stream` | Implemented, currently in testing |

<br>
</details>
</details>

## Community Support

Learn AI, visit: [LinuxDO](https://linux.do)

## Contributors

Thanks to all developers who contributed to this project:

<a href="https://github.com/basketikun/chatgpt2api/graphs/contributors">
  <img alt="Contributors" src="https://contrib.rocks/image?repo=basketikun/chatgpt2api" />
</a>

## Star History

[![Star History Chart](https://api.star-history.com/chart?repos=basketikun/chatgpt2api&type=date&legend=top-left)](https://www.star-history.com/?repos=basketikun%2Fchatgpt2api&type=date&legend=top-left)
