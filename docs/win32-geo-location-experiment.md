# Experimento: Escenario UK Native=USA, WiFi=UK

## Contexto
Cliente actualiza al código nuevo. Su situación real es UK (WiFi). Pero por alguna razón, `native` siempre devuelve USA.

---

## PRIMER CICLO (Primera ejecución del agente con nuevo código)

```
Entrada: win32LocationFetch(callback)
  → win32LastFetchTime = null (no hay caché)
  → llama startWin32Fetch()
    → llama getLocationHistory()
      → storage: no existe location_history_win32
      → devuelve: []
    → history.length === 0
    → Evento: [WIN32-START] History empty → routing to BOOTSTRAP
    → llama bootstrapWin32Location()

bootstrapWin32Location():
  → query storage: last_wifi_location
    → CASO A: Primera instalación
       → no existe last_wifi_location
       → Evento: [WIN32-BOOTSTRAP] No last_wifi_location found, fetching fresh
       → llama wifi()
         → devuelve: {lat: UK_LAT, lng: UK_LNG, accuracy: 25m, method: 'wifi'}
       → llama saveToLocationHistory({...UK...})
         → storage.set(location_history_win32, [UK])
         → Evento: [WIN32-HISTORY-SAVE] Created new history record
       → retorna: {UK location}
    
    → CASO B: Upgrade desde versión anterior
       → existe last_wifi_location = {UK_LAT, UK_LNG}
       → Evento: [WIN32-BOOTSTRAP] Found last_wifi_location
       → llama saveToLocationHistory({...UK...})
         → storage.set(location_history_win32, [UK])
       → retorna: {UK location} (sin llamada de red)

Resultado PRIMER CICLO:
  ✓ win32LastFetchTime = Date.now()
  ✓ location_history_win32 = [UK]
  ✓ RETORNA: UK location
  ✓ Bootstrap nunca llama a native()

Logs esperados:
  [WIN32-BOOTSTRAP] Starting bootstrap
  [WIN32-BOOTSTRAP] No last_wifi_location found (o Found, depende)
  [WIN32-BOOTSTRAP] Wifi fetch successful: lat=UK_LAT, lng=UK_LNG
  [WIN32-HISTORY-SAVE] Created new history record
  SUCCESS
```

---

## SEGUNDO CICLO (5 segundos después)

```
Entrada: win32LocationFetch(callback)
  → timeSinceLastFetch = 5000ms
  → cacheValid = true (< 60000)
  → Evento: [WIN32-CACHE] Cache hit (5.0s ago < 60s)
  → llama getLocationHistory()
    → storage: location_history_win32 = [UK]
    → history.length > 0
    → cached = history[-1] = {UK location}
  → Evento: [WIN32-CACHE] Returning cached: lat=UK_LAT
  → RETORNA: UK location

Resultado SEGUNDO CICLO:
  ✓ Sin llamadas de red (WiFi ni Native)
  ✓ Sin operaciones de storage complejas
  ✓ RETORNA: UK location (cached)

Logs esperados:
  [WIN32-CACHE] Cache hit (5.0s ago < 60s)
  [WIN32-CACHE] Returning cached: lat=UK_LAT
```

---

## TERCER CICLO (65 segundos después del primer ciclo)

```
Entrada: win32LocationFetch(callback)
  → timeSinceLastFetch = 65000ms
  → cacheValid = false (> 60000)
  → Evento: [WIN32-CACHE] Cache expired (65.0s ago > 60s). Starting new fetch
  → llama startWin32Fetch()
    → llama getLocationHistory()
      → storage: location_history_win32 = [UK]
      → history.length === 1
    → Evento: [WIN32-START] History has 1 entries → routing to NORMAL
    → lastValid = history[0] = {UK_LAT, UK_LNG}
    → llama normalWin32Location(lastValid={UK})

normalWin32Location(lastValid={UK}):
  → Evento: [WIN32-NORMAL] Starting normal location fetch. Last valid: lat=UK_LAT
  
  attemptNative():
    → Evento: [WIN32-NORMAL] Attempting native geolocation...
    → llama platform.get_location()
      → devuelve: {lat: USA_LAT, lng: USA_LNG, accuracy: 95m, method: 'native'}
    → accuracyOk: accuracy=95m <= 100m → TRUE
    
    → resultWithMethod = {lat: USA_LAT, lng: USA_LNG, accuracy: 95m, method: 'native'}
    → Evento: [WIN32-NORMAL] Native successful: lat=USA_LAT, accuracy=95m
    
    → llama calcDistanceKm(USA, UK)
      → LatLon.distanceTo() = 5397.42 km
      → Evento: [WIN32-DISTANCE] Calculated: 5397.42km
      → devuelve: 5397.42
    
    → distance = 5397.42
    → Condición: distance (5397.42) <= 50? NO
    
    → JUMP DETECTED!
    → nativeCandidate = {USA location}
    → Evento: [WIN32-NORMAL] Jump detected (5397.42km > 50km). Confirming with wifi...
    
    → llama wifi()
      → devuelve: {lat: UK_LAT, lng: UK_LNG, accuracy: 22m, method: 'wifi'}
    
    → wifiResult = {UK_LAT, UK_LNG, accuracy: 22m}
    → NO ERROR en wifi
    
    → llama calcDistanceKm(UK, UK)
      → LatLon.distanceTo() = 0.00 km
      → Evento: [WIN32-DISTANCE] Calculated: 0.00km
      → devuelve: 0.00
    
    → wifiDistance = 0.00
    → Condición: wifiDistance (0.00) > 50? NO
    
    → WiFi NO CONFIRMA JUMP
    → Evento: [WIN32-NORMAL-JUMP] Wifi does NOT confirm jump (0.00km ≤ 50km)
    → Evento: [WIN32-NORMAL-JUMP] Using wifi result instead (native was probably spurious)
    
    → llama saveToLocationHistory({UK_LAT, UK_LNG, 22m, 'wifi'})
      → getLocationHistory()
        → storage: location_history_win32 = [UK]
      → history = [UK] (ya existe)
      → history.push({UK})
      → history = [UK, UK]
      → Evento: [WIN32-HISTORY-SAVE] Added location. Total entries: 2
      → history.length (2) > 15? NO
      → rows.length > 0? YES
      → storage.update(location_history_win32, [UK, UK])
      → Evento: [WIN32-HISTORY-SAVE] Update successful
    
    → llama drainWin32Callbacks(null, {UK_LAT, UK_LNG, 22m})

Resultado TERCER CICLO:
  ✓ win32LastFetchTime = Date.now()
  ✓ location_history_win32 = [UK, UK]
  ✓ RETORNA: UK location (WiFi ganó)
  ✓ Native fue detectado como spurious → rechazado

Logs esperados:
  [WIN32-CACHE] Cache expired (65.0s ago > 60s)
  [WIN32-START] History has 1 entries → routing to NORMAL
  [WIN32-NORMAL] Starting normal location fetch. Last valid: lat=UK_LAT
  [WIN32-NORMAL] Attempting native geolocation...
  [WIN32-NORMAL] Native successful: lat=USA_LAT, accuracy=95m
  [WIN32-DISTANCE] Calculated: 5397.42km from (USA_LAT,USA_LNG) to (UK_LAT,UK_LNG)
  [WIN32-NORMAL] Jump detected (5397.42km > 50km). Confirming with wifi...
  [WIN32-DISTANCE] Calculated: 0.00km from (UK_LAT,UK_LNG) to (UK_LAT,UK_LNG)
  [WIN32-NORMAL-JUMP] Wifi does NOT confirm jump (0.00km ≤ 50km)
  [WIN32-NORMAL-JUMP] Using wifi result instead (native was probably spurious)
  [WIN32-HISTORY-SAVE] Added location. Total entries: 2
  [WIN32-HISTORY-SAVE] Update successful
```

---

## CUARTO CICLO (5 segundos después del tercer ciclo)

```
Entrada: win32LocationFetch(callback)
  → timeSinceLastFetch = 5000ms
  → cacheValid = true (< 60000)
  → RETORNA: UK location (cached from [UK, UK][-1])

Logs esperados:
  [WIN32-CACHE] Cache hit (5.0s ago < 60s)
  [WIN32-CACHE] Returning cached: lat=UK_LAT
```

---

## QUINTO CICLO (70 segundos después del tercer ciclo = 135s total)

```
Entrada: win32LocationFetch(callback)
  → timeSinceLastFetch = 70000ms
  → cacheValid = false (> 60000)
  → llama startWin32Fetch()
    → getLocationHistory()
      → storage: location_history_win32 = [UK, UK]
      → history.length === 2
    → Evento: [WIN32-START] History has 2 entries → routing to NORMAL
    → lastValid = history[-1] = {UK_LAT, UK_LNG}
    → llama normalWin32Location(lastValid={UK})

normalWin32Location(lastValid={UK}):
  → attemptNative()
    → platform.get_location()
      → devuelve: {USA_LAT, USA_LNG, accuracy: 95m}
    
    → accuracyOk: TRUE (95 ≤ 100)
    → resultWithMethod = {USA}
    → calcDistanceKm(USA, UK) = 5397.42km
    → distance > 50? YES
    
    → JUMP DETECTED AGAIN
    → llama wifi()
      → devuelve: {UK_LAT, UK_LNG, accuracy: 22m}
    
    → wifiDistance = 0.00km
    → wifiDistance > 50? NO
    
    → WiFi NO CONFIRMA JUMP (nuevamente)
    → Usa wifi result
    → saveToLocationHistory({UK})
      → history = [UK, UK, UK]

Resultado QUINTO CICLO:
  ✓ RETORNA: UK location
  ✓ Mismo patrón: Native detectado como spurious → rechazado
  ✓ location_history_win32 = [UK, UK, UK]
```

---

## RESUMEN DE COMPORTAMIENTO

### Patrón Emergente

```
CICLOS POSTERIORES (n ≥ 5):

Cada 60 segundos:
  1. lastValid = UK (siempre UK en el historial)
  2. native() → USA
  3. distance(USA, UK) = 5397.42km > 50km
  4. wifi() → UK
  5. distance(UK, UK) = 0km ≤ 50km
  6. "Wifi does NOT confirm jump"
  7. Guarda UK en historia
  8. RETORNA: UK

Entre ciclos: Cache retorna UK
```

### Estado del Historial

```
Time      | location_history_win32         | Retorna | Método
----------|--------------------------------|---------|--------
t=0       | [UK]                           | UK      | Bootstrap
t=5s      | [UK]                           | UK      | Cache
t=65s     | [UK, UK]                       | UK      | Normal+WiFi
t=70s     | [UK, UK]                       | UK      | Cache
t=135s    | [UK, UK, UK]                   | UK      | Normal+WiFi
t=140s    | [UK, UK, UK]                   | UK      | Cache
...continúa semejante...
t=195s    | [UK, UK, UK, UK, UK, ...]      | UK      | Normal+WiFi
```

### ¿Qué pasaría si WiFi FALLA en el ciclo #3?

```
CICLO 3 ALTERNATIVO - WiFi falla:
  → lastValid = UK
  → native() = USA
  → distance = 5397.42km > 50km
  → JUMP DETECTED
  → wifi() → ERROR ❌
  → "Wifi confirmation failed. Using native candidate anyway."
  → saveToLocationHistory({USA})
  → location_history_win32 = [UK, USA]
  → RETORNA: USA
  
CICLO 4:
  → Cache hit
  → RETORNA: USA (cached)
  
CICLO 5 (70s después):
  → lastValid = USA ← CAMBIÓ!
  → native() = USA
  → distance(USA, USA) = 0km ≤ 50km ✓
  → "Distance OK. Accepting native result."
  → saveToLocationHistory({USA})
  → location_history_win32 = [UK, USA, USA]
  → RETORNA: USA
  
CICLOS POSTERIORES:
  → lastValid = USA (stuck!)
  → native() = USA
  → distance = 0km (siempre OK)
  → native es aceptado → USA persiste
  → PROBLEMA: Se quedó en USA ❌
```

---

## CONCLUSIÓN

### Con WiFi funcionando siempre (escenario original):
✅ **SEGURO**: Siempre retorna UK
- Bootstrap: WiFi → UK
- Normal path: Native detectado como spurious (5397km > 50km), WiFi confirma no-jump (0km), USA rechazado
- Persiste en UK indefinidamente

### Con WiFi fallando SIN AVISO:
⚠️ **PROBLEMA DETECTADO**: Sistema queda enganchado en USA
- WiFi falla en un ciclo → Native (USA) se guarda como lastValid
- Ciclos posteriores: lastValid=USA, native=USA, distance=0 → USA aceptado
- **No hay mecanismo de recuperación**

---

## ¿Cómo podría solucionarse?

### Opción 1: Jump detection bidireccional
```javascript
// Periodicamente (ej: cada 10 ciclos), validar lastValid con wifi
// sin esperar jump
if (shouldPeriodicValidation) {
  wifi((wifiErr, wifiResult) => {
    const distanceFromWifi = calcDistanceKm(lastValid, wifiResult);
    if (distanceFromWifi > 50) {
      logger.warn('Periodic validation: lastValid is stale, resetting to WiFi');
      lastValid = wifiResult;
    }
  });
}
```

### Opción 2: Fallback a WiFi si native diverge por mucho tiempo
```javascript
// Si native ha divergido de wifi por más de N ciclos consecutivos,
// force reset a wifi
```

### Opción 3: Mantener última ubicación WiFi conocida y compararla
```javascript
// En lugar de solo last_wifi_location, mantener:
// last_trusted_location = última ubicación confirmada por wifi
// Si native diverge mucho de last_trusted_location, rechazar
```

