# Environment variables

Copy `.env.example` to `.env.local` for local development; set the same
variables in your Vercel project settings for deployment.

| Variable | Required | Enables |
| --- | --- | --- |
| `LLM_PROVIDER` | **Yes** | `gemini` or `groq` — selects the chat model. Fails at boot if unset or invalid; no silent default. |
| `GEMINI_CHAT_API_KEY` | If `LLM_PROVIDER=gemini` | Chat via `gemini-3.5-flash`. |
| `GROQ_API_KEY` | If `LLM_PROVIDER=groq` | Chat via Groq (`openai/gpt-oss-120b`). |
| `GEMINI_EMBEDDING_API_KEY` | **Yes** | Embeddings (`gemini-embedding-2`) — independent of `LLM_PROVIDER`. Needed at build time too. |
| `SITE_PASSWORD_HASH` | No | The password gate (with `SESSION_SECRET`). |
| `SESSION_SECRET` | No | Signs the session cookie. Required if `SITE_PASSWORD_HASH` is set. |
| `LANGSMITH_API_KEY` | No | LangSmith tracing of pipeline runs. |
| `LANGSMITH_TRACING` | No | Set to `true` alongside the key to enable tracing. |
| `UPSTASH_REDIS_REST_URL` | No | Rate limiting (with the token). |
| `UPSTASH_REDIS_REST_TOKEN` | No | Rate limiting (with the URL). |

There is intentionally **no GitHub token** anywhere — your content lives in your
repo, and Vercel's GitHub integration handles access.

## Chat provider: `LLM_PROVIDER` (required)

Chat and embeddings are independent decisions — see
[architecture.md](./architecture.md) for the adapter seam. Set `LLM_PROVIDER`
to `gemini` (documented default) or `groq` (tested alternative), then supply
that provider's key:

- `gemini` → `GEMINI_CHAT_API_KEY`, free key at
  [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Free-tier
  note: `gemini-3.5-flash` allows roughly **5 requests/minute** and **20/day**.
  Each question costs 2–3 chat calls.
- `groq` → `GROQ_API_KEY`, free key at
  [console.groq.com/keys](https://console.groq.com/keys).

## Embeddings: `GEMINI_EMBEDDING_API_KEY` (required)

Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
— can be the same Gemini project as your chat key, or a different one; the two
are configured independently. Used at **build time** (ingest embeds your corpus
during `npm run build`) and at **runtime** (the Retrieve node embeds each
question). Only Gemini is implemented today, regardless of `LLM_PROVIDER`.

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
