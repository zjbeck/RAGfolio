---
title: Lighting cycles
description: Program day/night cycles on the LED bar, including sunrise ramps and seasonal drift.
doc_type: guide
module: lighting
---

The Verdant LED bar does more than switch on and off. This guide sets up a
natural-feeling light cycle and covers the two features people usually miss:
ramps and seasonal drift.

## A basic day cycle

Every lighting program is built from segments. The simplest useful program has
three:

| Segment | Time          | Intensity | Spectrum    |
| ------- | ------------- | --------- | ----------- |
| Morning | 07:00 – 10:00 | 60%       | Cool white  |
| Midday  | 10:00 – 17:00 | 100%      | Full        |
| Evening | 17:00 – 20:00 | 35%       | Warm white  |

Outside all segments the bar is off. Segments may not overlap; the app will
refuse to save a program with conflicting times.

## Sunrise and sunset ramps

Hard on/off transitions stress light-sensitive species. Add a ramp to any
segment boundary and the bar interpolates intensity over the ramp window:

```json
{ "segment": "morning", "ramp_in_minutes": 20 }
```

Ramps longer than 45 minutes are clamped, since anything slower is
indistinguishable from ambient light change.

## Seasonal drift

With drift enabled, Verdant shifts your program's start and end times a few
minutes each week to mimic the photoperiod change at a latitude you choose.
Over a year, a program drifts up to ±90 minutes from its configured times.
Drift never changes intensity or spectrum — only timing.

## Lighting and the microclimate

The LED bar reports its own output as a synthetic light reading, which feeds
the same pipeline as sensor data. A zone in deep shade with the bar at full
intensity will still score as well-lit — if that's not what you want, place a
physical light sensor in the shaded zone and the physical reading wins.
