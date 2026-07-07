---
title: Webhooks API
description: Subscription management, the event catalog, delivery signatures, and retry behavior.
doc_type: api-reference
module: hub
---

Programmatic access to webhook subscriptions. All routes require the
`webhooks:write` scope.

## Create a subscription

```
POST /v2/webhooks
```

```json
{
  "url": "https://ops.example.com/hooks/verdant",
  "events": ["watering.run.completed", "sensor.offline"]
}
```

The response includes the subscription ID and a `signing_secret`, returned
exactly once. The URL must be HTTPS; plain HTTP is rejected at creation.

## Event catalog

| Event                     | Fires when                                          |
| ------------------------- | --------------------------------------------------- |
| `sensor.reading`          | A sensor reports (up to every 30 s per sensor)      |
| `sensor.offline`          | A sensor misses reports for 15 minutes              |
| `sensor.calibration.due`  | A probe is two weeks from its calibration due date  |
| `watering.run.completed`  | Any run finishes, engine-planned or manual          |
| `watering.run.skipped`    | The engine evaluates a run and declines             |
| `reservoir.low`           | Reservoir drops below 15% and runs are suspended    |
| `hub.offline`             | A hub misses its heartbeat for 5 minutes            |

## Delivery format

Deliveries are POST requests with a JSON body:

```json
{
  "id": "dl_7c20e9",
  "event": "watering.run.skipped",
  "occurred_at": "2026-05-14T11:00:00Z",
  "data": { "zone": "canopy", "reason": "humidity_above_target" }
}
```

Headers: `X-Verdant-Signature` (HMAC-SHA256 of the raw body, hex-encoded,
keyed with the signing secret — v2 signatures as of platform release 2.5) and
`X-Verdant-Delivery` (stable across retries; dedupe on it).

## Retries and disabling

A delivery succeeds on any 2xx within five seconds. Failures retry on
exponential backoff — 1 min, 5 min, 30 min, then hourly — for 24 hours.
Subscriptions failing continuously for 7 days are disabled; re-enable with
`POST /v2/webhooks/{id}/enable` after fixing your endpoint.

## List and delete

`GET /v2/webhooks` lists subscriptions with their recent delivery success
rate. `DELETE /v2/webhooks/{id}` removes one immediately; in-flight retries
are abandoned.
