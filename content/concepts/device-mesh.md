---
title: The device mesh
description: How sensors and actuators stay coordinated with and without the internet.
doc_type: concept
module: hub
---

Verdant's reliability story rests on one architectural decision: the cloud is
a convenience layer, not a dependency. This page explains what runs where.

## Hub-local by default

Sensors and actuators never talk to the internet. They join a low-power mesh
rooted at the hub, and everything an automation needs — readings, scores,
schedules, rules — lives and executes on the hub itself. The round trip from
"humidity dropped" to "mister running" never leaves the enclosure's room.

The cloud receives a mirror of readings and events for the app, the API, and
webhooks. When the mirror is unreachable, the hub queues locally and
backfills later.

## What an outage costs you

During an internet outage:

- **Keeps working:** every automation, fixed and adaptive schedules,
  microclimate scoring, safety overrides, local logging.
- **Degrades:** the app shows the last mirrored state; API reads go stale;
  webhook deliveries queue.
- **Stops:** remote manual runs, configuration changes, firmware updates.

After reconnection the hub backfills queued history in order. Webhook events
are delivered late rather than dropped, with their original `occurred_at`
timestamps — consumers should order by `occurred_at`, not arrival time.

## Mesh capacity and placement

A single hub coordinates up to 32 devices across 8 zones. Mesh range is
roughly a large room; sensors relay for each other, so a distant sensor works
if any powered device sits between it and the hub. Battery-only sensors don't
relay — if your layout depends on relaying, the relay point needs wall power.

## Firmware

The hub staggers device firmware updates so that at most one device per zone
is offline at a time, and actuators mid-run are never interrupted. A failed
update rolls back automatically; the device rejoins on its previous version
and reports the failure as a `hub` event.
