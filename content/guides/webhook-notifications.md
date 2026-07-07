---
title: Webhook notifications
description: Push Verdant events to your own endpoint and verify signatures correctly.
doc_type: guide
module: hub
cross_links:
  - to: api-reference/webhooks-api
    label: subscription endpoints and event schema
---

Polling the API tells you what already happened; webhooks tell you as it
happens. This guide subscribes an endpoint to Verdant events and gets
signature verification right the first time.

## Create a subscription

You need an HTTPS endpoint that responds to POST requests with a 2xx within
five seconds. Register it:

```bash
curl -X POST https://api.verdant.example/v2/webhooks \
  -H "Authorization: Bearer $VERDANT_API_KEY" \
  -d '{ "url": "https://ops.example.com/hooks/verdant",
        "events": ["watering.run.completed", "sensor.offline"] }'
```

The response includes a `signing_secret`. Store it like a password — it's
shown once.

## Verify signatures

Every delivery carries an `X-Verdant-Signature` header: an HMAC-SHA256 of the
raw request body, keyed with your signing secret. Verify before you parse:

1. Read the raw body bytes — before any JSON parsing or middleware touches it.
2. Compute `HMAC-SHA256(signing_secret, raw_body)` and hex-encode it.
3. Compare against the header with a constant-time comparison.

The most common integration bug is verifying a re-serialized body instead of
the raw bytes; key order changes and the signature never matches.

## Choose events deliberately

Subscribing to everything sounds convenient and floods your endpoint —
`sensor.reading` alone can fire every 30 seconds per sensor. A calmer
starting set:

- `watering.run.completed` and `watering.run.skipped`
- `sensor.offline` and `sensor.calibration.due`
- `reservoir.low`

## Retries

Failed deliveries are retried with exponential backoff for up to 24 hours. A
subscription that fails continuously for 7 days is disabled and you're
notified by email. Deliveries carry an `X-Verdant-Delivery` ID — dedupe on it;
retries reuse the ID.
