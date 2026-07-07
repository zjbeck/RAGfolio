---
title: The microclimate model
description: How raw sensor readings become a per-zone microclimate score.
doc_type: concept
module: sensors
cross_links:
  - to: api-reference/sensors-api
    label: the reading fields the model consumes
---

Every automation decision in Verdant starts from the same input: the
microclimate score, a per-zone number from 0 to 100 describing how far current
conditions sit from the zone's targets. This page explains how the score is
built and what its failure modes are.

## From readings to a score

Each zone aggregates its sensors' most recent readings — humidity,
temperature, soil moisture, and light. Each dimension is compared against the
zone's target range and scored individually; the zone score is a weighted
combination, with weights set by the zone's profile (a fern profile weights
humidity heavily; a succulent profile barely considers it).

Two properties of this design matter downstream:

- **The score is computed on the hub**, not in the cloud. Scores keep updating
  during an internet outage.
- **The score only uses fresh readings.** A sensor that hasn't reported for 15
  minutes is stale, and its dimension is dropped from the combination rather
  than reused.

## Staleness beats wrongness

Dropping a stale dimension may look aggressive — the last humidity reading is
probably still roughly right. The alternative is worse: a frozen reading
looks exactly like a stable zone, and automations will happily act on it for
hours. Verdant prefers a score that honestly says "I know less right now"
over one that quietly lies.

When every dimension of a zone is stale, the zone has no score, and anything
that depends on it — adaptive watering above all — pauses rather than guesses.

## Synthetic readings

Some inputs are synthesized rather than sensed. The LED bar reports its own
output as a light reading, which is correct for the zone the bar covers and
wrong for a shaded corner of the same enclosure. A physical light sensor in
the zone always overrides the synthetic value.

## What the score is not

The score is deliberately not a health metric. It measures distance from
configured targets, and the targets are yours. A perfectly scored zone with
the wrong targets is a well-automated mistake — check targets against a care
sheet for the species you keep.
