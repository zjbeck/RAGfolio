---
title: Example guide — replace me
description: One sentence summarizing what this guide walks through.
doc_type: guide
cross_links:
  - to: concepts/example-concept
    label: background concept
---

[PLACEHOLDER] This file demonstrates the expected shape for a doc in this
collection. Delete it (and the other `example-*` files across `content/`)
once you've added your own content — each collection just needs at least one
real `.md` file besides `_index.md`.

## Frontmatter

- `title` and `description` are required on every doc.
- `doc_type` here is a facet — one of the keys declared in
  `corpus.config.ts`'s `facets`. Facets are entirely your choice: rename,
  remove, or add more. None are mandatory unless you list them in
  `requiredFacets`.
- `cross_links` is optional: a list of `{ to, label }` pairs pointing at
  other docs (`collection/docSlug`), rendered as claim → evidence lines in
  the RAG Panel's forest view. Every target must exist, or ingest fails.

## Chunking

Ingest splits a doc into one chunk per heading (this section and the one
above are each their own chunk), preserving the full heading path so
citations can deep-link to the exact section. A doc whose body is shorter
than `corpus.config.ts`'s `wholeDocChunkThreshold` (1200 characters by
default) is ingested as a single whole-doc chunk instead — useful for very
short docs where per-heading splitting would be finer-grained than useful.

## Writing real content

Replace this file's frontmatter and body with your own. Run `npm run ingest`
after any change — it validates frontmatter, chunks the body, and embeds
anything new or changed.
