---
title: Getting started with Verdant
description: Pair your hub, add your first sensors, and run an automation in about fifteen minutes.
doc_type: guide
module: hub
---

Verdant automates the climate inside a terrarium: sensors report conditions,
the hub evaluates rules, and actuators — misters, drip lines, LED bars — do the
work. This guide takes you from an unopened box to a running automation.

## What you need

- A Verdant Hub (second generation or later)
- At least one sensor — the Climate Pod is the best first choice
- The Verdant app, or an API key if you prefer the command line
- A 2.4 GHz Wi-Fi network for the hub's initial handshake

## Pair the hub

1. Plug in the hub and wait for the ring light to pulse amber.
2. In the app, choose **Add device → Hub** and hold your phone within arm's
   reach. Pairing uses Bluetooth for the handoff, then moves to Wi-Fi.
3. When the ring turns solid green, the hub is online and registered to your
   account.

The hub is the only device that talks to the internet. Sensors and actuators
join the hub's local mesh, so they keep working — and keep logging — during an
outage.

## Add a sensor

Place the Climate Pod inside the terrarium, away from the misting nozzle, and
choose **Add device → Sensor** in the app. The hub discovers it within a
minute. Give it a zone name you'll recognize later; every reading, rule, and
API response uses the zone name.

New soil-moisture probes should be calibrated before you rely on their
readings — a dry-air baseline takes two minutes.

## Run your first automation

Create a rule from the **Automations** tab. A good starter:

> When humidity in *canopy* drops below 70%, run the mister for 10 seconds.

Watch the live tile as the mister runs. Once you trust the loop, switch the
watering schedule from fixed to adaptive and let the scheduling engine take
over the timing decisions.

## Where to go next

- Set up automated misting for schedules with more nuance than a single rule.
- Add webhook notifications if you want events pushed to your own systems.
- Skim the API reference — everything the app does is available over REST.
