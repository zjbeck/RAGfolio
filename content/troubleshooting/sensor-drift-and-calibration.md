---
title: Sensor drift and calibration
description: Diagnose soil-moisture readings that slowly stop matching reality.
doc_type: troubleshooting
module: sensors
cross_links:
  - to: api-reference/sensors-api
    label: the calibrate endpoint this procedure uses
  - to: concepts/microclimate-model
    label: how drift distorts the zone score
---

Soil-moisture probes drift: mineral deposits accumulate on the probe surface
and readings creep away from reality over months. Drift is gradual, which
makes it easy to miss and easy to fix.

## Symptoms

- Readings look plausible but the medium feels obviously wetter or drier than
  reported.
- Adaptive watering slowly trends toward over- or under-watering with no
  configuration change.
- Two probes in the same medium disagree by more than 0.1 volumetric.

Drift distorts everything downstream — the zone's microclimate score inherits
the error, and the scheduling engine waters against it. If watering behavior
changed and your schedule didn't, suspect the probe before the engine.

## Confirm it's drift

1. Pull the probe's 90-day history at `1h` resolution and look for a slow
   one-directional trend that doesn't track watering events.
2. Compare against a second probe placed in the same medium for an hour.
3. Rule out the cheap causes: battery below 20% (low-voltage readings skew
   high) and a probe repositioned near a drip point.

Sudden jumps are not drift — a step change usually means the probe was moved
or its cable damaged. Drift is measured in weeks.

## Recalibrate

Run the two-point calibration: clean the probe, run it in dry air, then in
fully saturated medium. Trigger it from the app or via
`POST /v2/sensors/{id}/calibrate` — physical confirmation on the probe is
required either way. Calibration rewrites the probe's stored curve; history
recorded before recalibration is not retroactively corrected.

If a probe needs recalibration more than twice a year, the medium is likely
high in dissolved minerals; switching to distilled water for misting slows
deposit buildup considerably.

## Prevention

Calibration is due every six months; the `sensor.calibration.due` webhook and
an app notification both fire two weeks early. Clean probes when you
recalibrate — a soft brush is enough. Don't calibrate immediately after
watering; saturated pockets make the "dry" point unreliable.
