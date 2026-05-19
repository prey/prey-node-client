# Windows Location Orchestrator — Changes Summary

## What Changed

The Windows location orchestrator (`lib/agent/providers/geo/strategies.js`, `normalWin32Location`) was updated to use a finer-grained change verification strategy instead of a broad jump-detection threshold.

---

## Comparison Table

| Aspect | Before | After |
|---|---|---|
| **Detection threshold** | 50 km (jump detection) | 1 km (change detection) |
| **Trigger condition** | native vs trusted >50km → jump suspected | native vs trusted >1km → change detected |
| **WiFi verification** | Compare WiFi vs trusted at 50km | Compare WiFi vs native at 300m |
| **WiFi confirms change** | WiFi also >50km from trusted → pick best accuracy | WiFi within 300m of native → pick best accuracy |
| **WiFi denies change** | WiFi ≤50km from trusted → use WiFi (native spurious) | WiFi >300m from native → use WiFi |
| **Bootstrap (no trusted)** | Uses `last_wifi_location` to seed history without WiFi call | Always calls fresh WiFi, ignores `last_wifi_location` |
| **Bootstrap (trusted exists)** | Same | Uses `last_wifi_location` shortcut (no WiFi call) |
| **Trusted update mechanism** | Every WiFi success + periodic every 3 native-only cycles | Unchanged |

---

## Why

The 50km threshold was too permissive: the device could move 30km without triggering any verification. The new 1km threshold catches real location changes earlier. The 300m WiFi confirmation window is intentionally wider than GPS accuracy to absorb natural variation between sensors.

The bootstrap change ensures that when no trusted baseline exists (first install or DB wipe), the agent always obtains a fresh, authoritative WiFi location rather than recycling a potentially stale cached value.

---

## Flow Diagrams

### Before (jump detection)

```
native ok (accuracy ≤200m)
  └─ distance vs trusted
      ├─ ≤50km → accept native
      │   (counter++ → WiFi validation every 3 native cycles)
      └─ >50km (JUMP DETECTED) → call WiFi
          ├─ WiFi >50km from trusted → confirm jump, pick best accuracy
          ├─ WiFi ≤50km from trusted → native spurious, use WiFi
          └─ WiFi fails → use native anyway
```

### After (change verification)

```
native ok (accuracy ≤200m)
  └─ distance vs trusted
      ├─ ≤1km → accept native
      │   (counter++ → WiFi validation every 3 native cycles)
      └─ >1km (CHANGE DETECTED) → call WiFi to verify
          ├─ WiFi ≤300m from native → change confirmed, pick best accuracy
          ├─ WiFi >300m from native → native uncertain, use WiFi
          └─ WiFi fails → use native anyway
```

### Bootstrap

```
Before:
  check last_wifi_location in DB
    ├─ exists → use it (no WiFi call)
    └─ missing → call WiFi

After:
  check win32LastTrustedLocation (loaded from last_trusted_location in DB)
    ├─ exists → check last_wifi_location
    │             ├─ exists → use it (no WiFi call)
    │             └─ missing → call WiFi
    └─ missing → always call WiFi (ignore last_wifi_location)
```

---

## Constants Added

```js
const changeDetectionThreshold = 1;      // km
const wifiNativeMatchThreshold  = 0.3;   // km (300m)
```

---

## Files Modified

- `lib/agent/providers/geo/strategies.js` — `normalWin32Location`, `bootstrapWin32Location`
- `test/lib/agent/providers/geo/strategies.test.js` — updated 2 tests, added 1 new test
