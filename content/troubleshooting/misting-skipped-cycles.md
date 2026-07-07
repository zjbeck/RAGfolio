---
title: Misting runs are being skipped
description: Read the skip reasons and fix the four common causes of missing misting cycles.
doc_type: troubleshooting
module: watering
cross_links:
  - to: concepts/scheduling-engine
    label: the decision loop that produces these skips
---

"The mister didn't run" is the most-reported watering issue and it almost
always has a recorded answer. The engine logs a reason for every skipped
cycle — start there, not with the hardware.

## Read the skip reasons first

Open the zone's run history in the app, or fetch
`GET /v2/zones/{zone}/runs`. Skipped evaluations appear alongside completed
runs with a `reason` field. The reason determines the fix; guessing without
it wastes time.

## `skipped:humidity_above_target`

Not a fault — the engine looked and conditions were already at target. If you
believe the zone is genuinely dry, the humidity reading is the suspect:
check for a stale or drifting sensor before touching the schedule.

## `skipped:deferred_to_lit_hours`

The zone was mildly below target overnight and the engine chose to wait for
the lit period. If your species needs overnight misting, widen the target
tolerance or add an explicit fixed run at night — deferral only applies to
adaptive decisions.

## Paused: no fresh score

If the zone's sensors are stale, adaptive runs pause entirely and the history
shows a gap rather than skips. Fix the sensor (battery, range, placement) and
adaptive scheduling resumes on the next evaluation — within five minutes of
fresh readings arriving.

## Suspended: reservoir low

Below 15% reservoir, all runs are suspended and a `reservoir.low` event
fires. Refill ends the suspension immediately. If refills are frequent, the
reservoir is undersized for your `max_runs_per_day` — either is adjustable.

## When it's actually the pump

If history shows runs *completing* but no mist appears, the engine believes
the pump ran: check tubing for kinks, the nozzle for mineral clogging (soak in
descaler), and the pump's prime. A run that completes in under a second with
zero flow raises a `watering` hardware alert in release 2.5 and later.
