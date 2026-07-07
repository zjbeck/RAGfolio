---
title: Authentication
description: API keys, scopes, and the rules for rotating credentials without downtime.
doc_type: api-reference
module: hub
---

All API requests are authenticated with a bearer key tied to your account.
Keys are created in the app under **Settings → API keys**, or via the API
itself if you already hold a key with the `keys:write` scope.

## Request format

Send the key in the `Authorization` header on every request:

```bash
curl https://api.verdant.example/v2/zones \
  -H "Authorization: Bearer vd_live_9f2c81d0a4e6"
```

Requests without a valid key receive `401 unauthorized`. Requests with a
valid key but insufficient scope receive `403 insufficient_scope`, and the
response body names the scope you're missing.

## Key types

| Prefix     | Environment | Notes                                    |
| ---------- | ----------- | ---------------------------------------- |
| `vd_live_` | Production  | Acts on your real hubs and devices.      |
| `vd_test_` | Sandbox     | Simulated hub with deterministic sensor data — safe for CI. |

Sandbox keys hit the same endpoints and return the same shapes; only the
underlying devices are simulated.

## Scopes

Scopes are granted per key at creation and cannot be widened later — create a
new key instead.

| Scope            | Grants                                        |
| ---------------- | --------------------------------------------- |
| `readings:read`  | Sensor readings and reading history            |
| `devices:read`   | Device inventory and status                    |
| `watering:write` | Create and modify schedules, trigger runs      |
| `webhooks:write` | Manage webhook subscriptions                   |
| `keys:write`     | Create and revoke API keys                     |

## Rotation

Keys don't expire, but rotation is one call:

```bash
curl -X POST https://api.verdant.example/v2/keys/ky_3f81/rotate \
  -H "Authorization: Bearer vd_live_9f2c81d0a4e6"
```

Rotation returns a replacement key and starts a 24-hour grace window during
which both old and new keys work. Revocation (`DELETE /v2/keys/{id}`) is
immediate and has no grace window.
