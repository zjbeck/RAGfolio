# Environment variables

Copy `.env.example` to `.env.local` for local development; set the same
variables in your Vercel project settings for deployment. Only one is required.

| Variable | Required | Enables |
| --- | --- | --- |
| `GEMINI_API_KEY` | **Yes** | Chat (`gemini-3.5-flash`) and embeddings (`gemini-embedding-2`). Needed at build time too. |
| `SITE_PASSWORD_HASH` | No | The password gate (with `SESSION_SECRET`). |
| `SESSION_SECRET` | No | Signs the session cookie. Required if `SITE_PASSWORD_HASH` is set. |
| `LANGSMITH_API_KEY` | No | LangSmith tracing of pipeline runs. |
| `LANGSMITH_TRACING` | No | Set to `true` alongside the key to enable tracing. |
| `UPSTASH_REDIS_REST_URL` | No | Rate limiting (with the token). |
| `UPSTASH_REDIS_REST_TOKEN` | No | Rate limiting (with the URL). |

There is intentionally **no GitHub token** anywhere — your content lives in your
repo, and Vercel's GitHub integration handles access.

## `GEMINI_API_KEY` (required)

Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
It's used at **build time** (ingest embeds your corpus during `npm run build`)
and at **runtime** (the chat pipeline). On Vercel, one project-level variable
covers both.

Free-tier note: `gemini-3.5-flash` allows roughly **5 requests/minute** and
**20/day**. Each question costs 2–3 chat calls. That's fine for a personal
portfolio; for anything busier, or to run the full eval suite, use a paid tier.

## The password gate (optional)

Set **both** variables to enable it. The gate protects every route (static
assets excepted); unset, the site is public and the gate is dormant.

```bash
# Generate the hash — it is printed base64-encoded, paste it as-is:
npm run hash-password -- "your site password"
# → SITE_PASSWORD_HASH=JDJiJDEyJ...

# Generate a session secret:
openssl rand -base64 32
```

> **Why base64?** Next's env loader expands `$` sequences in `.env` values,
> which silently corrupts a raw bcrypt hash. `hash-password` emits the hash
> base64-encoded so there are no `$` characters to mangle; the auth route
> decodes it.

**Fail-closed:** if `SITE_PASSWORD_HASH` is set but `SESSION_SECRET` is missing,
every route returns an explicit configuration error. The site never goes
silently public because of a half-configured gate.

## Rate limiting (optional, recommended for public sites)

Set both Upstash variables (from an
[Upstash Redis](https://upstash.com/) database) to rate-limit the chat endpoint
(LLM-quota protection) and `/api/auth` (~5 attempts/min/IP, to slow password
guessing). Absent, there is **no rate limiting** — an ungated, unlimited public
chat endpoint spends your Gemini quota for anyone who finds it. Configure this
before sharing a public URL.

## Tracing (optional)

Set `LANGSMITH_API_KEY` and `LANGSMITH_TRACING=true` to trace every pipeline run
to [LangSmith](https://smith.langchain.com/). Absent, tracing is a silent
no-op. The eval harness labels its runs so they group into an experiment — see
[evals.md](./evals.md).
