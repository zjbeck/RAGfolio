---
title: Watering API
description: Create fixed and adaptive schedules, trigger manual runs, and read run history.
doc_type: api-reference
module: watering
---

Endpoints for misters, drip lines, and their schedules. Writing requires the
`watering:write` scope; reading run history requires `readings:read`.

## Create a schedule

```
POST /v2/zones/{zone}/schedule
```

A zone has exactly one schedule. Creating a schedule for a zone that already
has one replaces it atomically — there is no partial update.

Fixed mode:

```json
{
  "mode": "fixed",
  "runs": [{ "at": "08:00", "seconds": 12 }]
}
```

Adaptive mode:

```json
{
  "mode": "adaptive",
  "target_humidity": 78,
  "max_runs_per_day": 6,
  "min_gap_minutes": 90
}
```

Adaptive parameters are guardrails, not commands: the scheduling engine
chooses run times within them. `max_runs_per_day` accepts 1–12;
`min_gap_minutes` accepts 30–720.

## Read a schedule

```
GET /v2/zones/{zone}/schedule
```

For adaptive schedules the response includes `next_planned_run`, the engine's
current intention. It's a forecast, not a promise — conditions between now and
then can move or cancel it.

## Trigger a manual run

```
POST /v2/zones/{zone}/runs
```

Body: `{ "seconds": 10 }`, capped at 60. Manual runs respect the reservoir-low
override but ignore `min_gap_minutes` — the gap constraint exists to stop the
engine from oscillating, not to stop you.

## Run history

```
GET /v2/zones/{zone}/runs?from=...&to=...
```

Every run — engine-planned, manual, or skipped — appears with a `reason`
field. Skips are first-class records, not gaps: `"reason":
"skipped:humidity_above_target"` tells you the engine looked and declined.
