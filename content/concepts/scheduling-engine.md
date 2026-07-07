---
title: The scheduling engine
description: How adaptive mode decides when to water — and when not to.
doc_type: concept
module: watering
cross_links:
  - to: api-reference/watering-api
    label: the guardrail parameters it obeys
---

Fixed schedules execute your decisions; adaptive schedules make decisions
inside your guardrails. This page explains the engine's decision loop, in the
same order the engine runs it.

## The decision loop

Every five minutes, for every zone in adaptive mode, the engine asks four
questions in order:

1. **Is a run even allowed?** Reservoir level, the `min_gap_minutes` distance
   from the previous run, and the `max_runs_per_day` budget are checked
   first. Any failure ends the evaluation — this is why gap and budget
   violations never appear as skip reasons; they're filtered before skipping
   is possible.
2. **Is the zone's score trustworthy?** A zone with no fresh microclimate
   score pauses adaptive runs entirely. The engine does not water on stale
   data.
3. **Is the zone below target?** Current humidity and soil moisture are
   compared against the schedule's targets, with a tolerance band to prevent
   oscillation around the boundary.
4. **Is now a good time?** The engine prefers runs during the zone's lit
   hours, when evaporation distributes moisture — a below-target zone at
   2 a.m. usually waits for morning unless it's far below target.

A run that clears all four gates is executed and logged with reason
`engine:below_target`. A run that fails gate 3 or 4 is logged as a skip with
the specific reason.

## Skips are records, not absences

The engine writes a run-history entry when it evaluates and declines, with
reasons like `skipped:humidity_above_target` or `skipped:deferred_to_lit_hours`.
This makes "why didn't it water?" an answerable question — check the history
before assuming a fault.

## Learning, narrowly

The engine tunes exactly one thing over time: each zone's evaporation curve —
how fast conditions decay after a run. That curve shifts run timing earlier
or later within your guardrails. It never adjusts the guardrails themselves,
never changes targets, and its state is visible as `next_planned_run` in the
schedule API. There is no opaque model making unbounded decisions about
your enclosure.

## Manual runs and the engine

A manual run resets the gap timer and consumes one unit of the daily budget,
and the engine re-plans around it. If you find yourself running manual waterings
daily, your targets or guardrails are wrong — tighten those instead.
