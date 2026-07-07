---
title: Automated misting
description: Configure fixed and adaptive misting schedules, and understand when the engine overrides you.
doc_type: guide
module: watering
cross_links:
  - to: api-reference/watering-api
    label: schedule endpoints
  - to: concepts/scheduling-engine
    label: how adaptive timing decides
---

Misting is the highest-impact automation in most terrariums and the easiest to
get wrong by hand. Verdant supports two scheduling modes; this guide covers
both and explains how to move between them safely.

## Fixed schedules

A fixed schedule runs the mister at explicit times for explicit durations:

```json
{
  "zone": "canopy",
  "mode": "fixed",
  "runs": [
    { "at": "08:00", "seconds": 12 },
    { "at": "19:30", "seconds": 8 }
  ]
}
```

Fixed mode is predictable and a good starting point while you learn how your
enclosure holds humidity. Its weakness is that it ignores conditions: it will
mist a terrarium that is already saturated.

## Adaptive schedules

Adaptive mode hands timing decisions to the scheduling engine. You set
guardrails; the engine chooses run times within them based on the zone's
microclimate score.

```json
{
  "zone": "canopy",
  "mode": "adaptive",
  "target_humidity": 78,
  "max_runs_per_day": 6,
  "min_gap_minutes": 90
}
```

Start adaptive mode with generous guardrails and tighten them once you've
watched a few days of history. The engine logs a reason for every run — and
for every run it decides to skip.

## Switching modes

Switching from fixed to adaptive keeps your run history, so the engine starts
with real data instead of a cold start. Switching back to fixed discards
nothing, but the engine stops making decisions immediately.

## Safety overrides

Two conditions override any schedule, in either mode:

- **Reservoir low** — runs are suspended until the reservoir is refilled.
- **Sensor stale** — if a zone's sensors haven't reported for 15 minutes,
  adaptive runs pause; fixed runs continue, since they never depended on
  readings.

Both overrides emit webhook events, so you can hear about them without opening
the app.
