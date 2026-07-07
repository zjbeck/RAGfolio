---
title: Sensors API
description: List sensors, read current and historical values, and calibrate probes over REST.
doc_type: api-reference
module: sensors
---

Endpoints for the physical sensors attached to a hub: Climate Pods
(humidity + temperature), soil-moisture probes, and light sensors. All routes
require the `readings:read` scope unless noted.

## List sensors

```
GET /v2/sensors
```

Returns every sensor registered to your hubs, with its zone, type, battery
level, and the timestamp of its last report.

```json
{
  "sensors": [
    {
      "id": "sn_a41f",
      "type": "soil_moisture",
      "zone": "understory",
      "battery": 0.82,
      "last_reported_at": "2026-05-14T08:21:04Z"
    }
  ]
}
```

A sensor that hasn't reported for 15 minutes is considered **stale**; stale
sensors are flagged with `"stale": true` and excluded from microclimate
scoring until they report again.

## Current reading

```
GET /v2/sensors/{id}/reading
```

Returns the most recent value with its unit and a quality flag. Soil-moisture
values are reported as volumetric water content (0–1), humidity as relative
percent, temperature in °C.

## Reading history

```
GET /v2/sensors/{id}/readings?from=...&to=...&resolution=5m
```

History is retained for 90 days. Resolutions of `30s`, `5m`, and `1h` are
available; values are averaged within each bucket, and each bucket reports the
count of raw samples it covers.

## Calibrate a probe

```
POST /v2/sensors/{id}/calibrate
```

Requires `devices:read` plus physical confirmation — the probe's LED blinks
and you press its button within 60 seconds. Calibration runs a two-point
sequence (dry air, then saturated medium) and stores the resulting curve on
the probe itself, so it survives hub resets. The response includes
`calibration_due_at`, six months out; a `sensor.calibration.due` webhook fires
two weeks before that date.
