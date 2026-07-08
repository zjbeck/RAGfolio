# Updating your copy

When you generate a repository from this template, you get a **snapshot** — a
full copy with no ongoing link to the template. That's deliberate: your content
and customizations are yours, and nothing upstream can overwrite them. The
trade-off is that improvements to RAGfolio don't reach you automatically. This
guide is how to pull them in when you want them.

## One-time setup

Add the template as a second remote:

```bash
git remote add template https://github.com/zjbeck/RAGfolio.git
git fetch template
```

## Pulling in improvements

Review what changed since you generated your repo, then merge selectively:

```bash
git fetch template
git log --oneline HEAD..template/main        # what's new upstream
git diff HEAD..template/main -- src/lib/graph # inspect a specific area
```

Bring in a whole area you haven't customized:

```bash
git checkout template/main -- src/lib/graph/
```

Or cherry-pick a specific commit:

```bash
git cherry-pick <commit-sha>
```

Then run `npm install` (in case dependencies changed), `npm run ingest`, and
`npm run dev` to confirm everything still works before committing.

## What's yours vs. what's the template's

Merges are cleanest when you know which files you own:

| Yours — expect conflicts if upstream also changed them | The template's — usually safe to take wholesale |
| --- | --- |
| `content/**` | `src/lib/graph/**` (the pipeline) |
| `corpus.config.ts` | `src/lib/corpus/**` (ingest, retrieval) |
| `src/copy.ts` | `src/components/**` (UI) |
| `src/styles/theme.custom.css` | `scripts/**` |
| `src/lib/site.ts`, `.env.local` | `src/app/api/**` (routes) |

If you've edited a component directly rather than through `corpus.config.ts` or
`src/copy.ts`, that's where merge conflicts will land — another reason to keep
customization in the config and copy layers the template sets aside for you.

## Pinned dependencies

Every dependency is pinned to an exact version. When you take an upstream change
that bumps a dependency, the new version comes with it. Re-run `npm install`
after any merge that touches `package.json`.
