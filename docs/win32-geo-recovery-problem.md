# Win32 Geolocalización - Problemática de Recovery

## 📋 Descripción General

El nuevo sistema de geolocalización para Windows (implementado en `win32LocationFetch`) detecta saltos de ubicación mayores a 50km consultando WiFi para validar si el salto es legítimo. Sin embargo, existe una **falla crítica de recovery** cuando WiFi falla durante el proceso de validación de saltos.

---

## 🔴 Problemática Identificada

### Escenario Crítico

1. **Estado inicial**: Cliente en UK (ubicación real y confirmada por WiFi)
   - `location_history_win32 = [UK]`
   - `lastValid = UK`

2. **Ciclo N (después de 60s)**: Native da USA, WiFi FALLA
   ```
   native() → USA (correcto técnicamente, pero spurious en contexto)
   distance(USA, UK) = 5397km > 50km
   → JUMP DETECTED
   → wifi() → ERROR ❌
   → "Wifi confirmation failed. Using native candidate anyway."
   → saveToLocationHistory(USA)
   → location_history_win32 = [UK, USA] ← CORRUPTO
   ```

3. **Ciclo N+1**: El sistema está comprometido
   ```
   lastValid = USA (spurious)
   native() → USA
   distance(USA, USA) = 0km ≤ 50km
   → "Distance OK. Accepting native result."
   → location_history_win32 = [UK, USA, USA]
   ```

4. **Ciclos N+2, N+3, ... ∞**: Stuck en USA
   ```
   lastValid = USA
   native() → USA (siempre)
   distance = 0km (siempre OK)
   → Aceitado indefinidamente
   → STUCK EN USA PARA SIEMPRE ❌
   ```

### El Problema Raíz

El sistema asume que **si WiFi falla durante jump detection, confiar en Native es seguro**. Pero esto crea un feedback loop:

```
┌─────────────────────────────────────┐
│ WiFi falla en ciclo X               │
│ → Native se guarda como lastValid   │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│ Ciclos posteriores:                 │
│ lastValid = Native (spurious)       │
│ distance(Native, lastValid) = 0     │
│ → Native aceptado indefinidamente   │
└──────────────────┬──────────────────┘
                   │
                   ▼
            🔴 SIN RECOVERY
```

### Scénarios donde esto ocurre

- WiFi API intermitente (problemas de conectividad)
- WiFi API rate-limited (respuesta HTTP 429, 503)
- WiFi timeout (respuesta lenta)
- Red pasante instable (pérdida de paquetes)
- Proxy fallo temporal

---

## 📊 Análisis del Impacto

| Aspecto | Impacto | Severidad |
|---------|---------|-----------|
| **Funcionalidad** | Ubicación buena se pierde permanentemente | 🔴 CRÍTICA |
| **Recovery** | Sin mecanismo automático de recuperación | 🔴 CRÍTICA |
| **Duración** | Indefinida hasta reinicio del agente | 🔴 CRÍTICA |
| **Probabilidad** | Media (WiFi API no es 100% confiable) | 🟠 MEDIA |
| **Detectabilidad** | Difícil sin análisis de logs | 🟠 MEDIA |

---

## 💡 Soluciones Propuestas

### OPCIÓN 1: Validación Periódica (Simple + Rápido)

**Concepto**: Cada N ciclos aceptados por native solo, force un llamado a WiFi para validar que `lastValid` siga siendo válido.

**Implementación**:
```javascript
let nativeOnlyCount = 0;

normalWin32Location(lastValid, cb, timeoutFn) {
  platform.get_location((err, result) => {
    // ... accuracy checks ...
    
    if (distanceOk) {
      nativeOnlyCount++;
      logger.debug(`[WIN32-VALIDATE] Native accepted ${nativeOnlyCount} times in a row`);
      
      // Validación periódica cada 3 ciclos
      if (nativeOnlyCount >= 3) {
        logger.info('[WIN32-VALIDATE] Periodic validation with WiFi');
        wifi((wifiErr, wifiResult) => {
          nativeOnlyCount = 0;
          if (!wifiErr) {
            const wifiDist = calcDistanceKm(wifiResult, lastValid);
            if (wifiDist > 50) {
              logger.warn('[WIN32-VALIDATE] ANOMALY: WiFi shows divergence! Resetting lastValid');
              lastValid = wifiResult;  // ← Recovery
            }
          }
        });
      }
    }
  });
}
```

**Pros:**
- ✅ Simple de implementar
- ✅ Recovery en máximo 3 ciclos (~3 minutos)
- ✅ Bajo overhead (WiFi solo cada 3 ciclos)
- ✅ Compatible con código actual

**Contras:**
- ❌ Tarda varios ciclos en detectar divergencia
- ❌ Magic number (¿por qué 3 y no 5?)
- ❌ No retroactivo (necesita ciclos futuros)

**Recomendación:** ⭐ **BUENA OPCIÓN para implementar primero**

---

### OPCIÓN 2: Trusted Location Separado (Robusto)

**Concepto**: Mantener TWO locations:
- `lastValid`: último en historial (puede ser spurious)
- `lastTrustedLocation`: confirmado por WiFi (siempre válido)

**Implementación**:
```javascript
// Estado módulo
let win32LastTrustedLocation = null;

// Cuando WiFi exitoso:
processResponse(coords, cb) {
  const data = { /* ... */ };
  win32LastTrustedLocation = data;  // ← Always set when WiFi succeeds
  // ... storage operations ...
  return cb(null, data);
}

// Evaluar native contra trusted:
normalWin32Location(lastValid, cb, timeoutFn) {
  platform.get_location((err, result) => {
    if (accuracyOk) {
      const distance = calcDistanceKm(result, win32LastTrustedLocation);
      
      if (distance <= 50) {
        // Native OK respecto a trusted
        saveToLocationHistory(result, cb);
      } else {
        // Jump detection contra trusted
        wifi((wifiErr, wifiResult) => {
          if (!wifiErr) {
            win32LastTrustedLocation = wifiResult;  // ← Update trusted
            // ... rest ...
          }
        });
      }
    }
  });
}

// Bootstrap también setea trusted:
bootstrapWin32Location(cb) {
  wifi((wifiErr, wifiResult) => {
    win32LastTrustedLocation = wifiResult;  // ← Init trusted desde bootstrap
    saveToLocationHistory(wifiResult, cb);
  });
}
```

**Persistencia en Storage**:
```javascript
// Agregar `last_trusted_location` en SQLite
storage.do('set', {
  type: 'keys',
  id: 'last_trusted_location',
  data: { value: JSON.stringify(win32LastTrustedLocation) }
}, cb);
```

**Pros:**
- ✅ Baseline siempre válido (confirmado por WiFi)
- ✅ Recovery automático en siguiente WiFi exitoso
- ✅ Conceptualmente claro (dos roles diferentes)
- ✅ Detecta divergencias immediatamente

**Contras:**
- ❌ Requiere persistencia en storage
- ❌ Más estado que mantener
- ❌ Migración de datos (upgrade de clientes)
- ❌ Overhead de storage en cada WiFi exitoso

**Recomendación:** ⭐⭐ **SOLUCIÓN MÁS ROBUSTA**

---

### OPCIÓN 3: Historial con Metadata (Auditable)

**Concepto**: Cada entrada del historial marca si fue verificada por WiFi o solo aceptada por native.

**Estructura de datos**:
```javascript
// Antes:
[
  { lat: 51.5, lng: -0.1, accuracy: 95, method: 'native' },
  { lat: 40.7, lng: -74.0, accuracy: 22, method: 'wifi' }
]

// Después:
[
  { lat: 51.5, lng: -0.1, accuracy: 95, method: 'native', verified: false },
  { lat: 40.7, lng: -74.0, accuracy: 22, method: 'wifi', verified: true }
]
```

**Implementación**:
```javascript
saveToLocationHistory(location, isVerified, cb) {
  const entry = { ...location, verified: isVerified };
  getLocationHistory((err, rows) => {
    const history = parseHistory(rows);
    history.push(entry);
    // ... persist ...
  });
}

// Al guardar:
if (wifiErr) {
  // WiFi falló → native se guarda como unverified
  saveToLocationHistory(native, false, cb);
} else {
  // WiFi exitoso → guardado como verified
  saveToLocationHistory(wifiResult, true, cb);
}

// Para detectar degradación:
function detectDegradation(history) {
  const last5 = history.slice(-5);
  const allUnverified = last5.every(e => !e.verified);
  if (allUnverified) {
    logger.warn('DEGRADATION: Last 5 locations are unverified!');
  }
}
```

**Pros:**
- ✅ Audit trail explícito
- ✅ Fácil detectar degradación
- ✅ Base para alertas inteligentes
- ✅ Debugging facilitado

**Contras:**
- ❌ Cambio de esquema de datos
- ❌ Migración de historial antiguo
- ❌ No es prevention, es detección

**Recomendación:** 🟡 **COMPLEMENTA OPCIÓN 1 O 2**

---

### OPCIÓN 4: Timeout + Reset (Drástico)

**Concepto**: Si `lastTrustedLocation` envejece más de X horas sin actualizar, force bootstrap.

**Implementación**:
```javascript
let lastWifiVerificationTime = null;

normalWin32Location(lastValid, cb, timeoutFn) {
  wifi((wifiErr, wifiResult) => {
    if (!wifiErr) {
      const wifiDist = calcDistanceKm(wifiResult, lastValid);
      if (wifiDist > 50) {
        // WiFi confirma jump
        lastWifiVerificationTime = Date.now();  // ← Update verification
      }
    }
  });
}

startWin32Fetch(cb, timeoutFn) {
  const hoursSinceVerification = lastWifiVerificationTime
    ? (Date.now() - lastWifiVerificationTime) / 3600000
    : Infinity;
    
  if (hoursSinceVerification > 24) {  // Más de 24 horas
    logger.error('RESET: No WiFi verification in 24h. Resetting history.');
    storage.do('delete', { type: 'keys', id: 'location_history_win32' }, () => {
      bootstrapWin32Location(cb);  // ← Force restart
    });
    return;
  }
  
  // ... rest of normal flow ...
}
```

**Pros:**
- ✅ Garantizado recovery (aunque tarde)
- ✅ Detecta problemas sistémicos
- ✅ Simple de entender

**Contras:**
- ❌ Recovery muy lento (24 horas)
- ❌ Pérdida de datos históricos
- ❌ Impacto en user (reinicio desde bootstrap)

**Recomendación:** 🟡 **COMO ÚLTIMO RECURSO**

---

### OPCIÓN 5: Anomaly Detection Bidireccional (Inteligente)

**Concepto**: Si native y WiFi divergen consistentemente, flag como "environment unstable" y trigger manual review.

**Implementación**:
```javascript
let divergenceCount = 0;

normalWin32Location(lastValid, cb, timeoutFn) {
  if (jumpDetected) {
    wifi((wifiErr, wifiResult) => {
      if (!wifiErr) {
        const nativeDist = calcDistanceKm(native, wifiResult);
        
        if (nativeDist > 100) {  // Native y WiFi están +100km apart
          divergenceCount++;
          logger.warn(`[ANOMALY] Native/WiFi diverge: ${divergenceCount}/5`);
          
          if (divergenceCount >= 5) {
            logger.error('[ANOMALY-CRITICAL] Activating WiFi-only mode');
            // - Detener native geolocation
            // - Solo confiar en WiFi
            // - Enviar alert al servidor
          }
        } else {
          divergenceCount = 0;  // Reset si convergen
        }
      }
    });
  }
}
```

**Pros:**
- ✅ Detecta problems sistémicos reales
- ✅ Base para escalar a manual review
- ✅ No asume recovery, reporta problema

**Contras:**
- ❌ Complejo de calibrar
- ❌ No previene el problema
- ❌ Requiere integración con alertas

**Recomendación:** ⭐⭐⭐ **COMPLEMENTA OTRAS OPCIONES**

---

### OPCIÓN 6: Hybrid (RECOMENDADO) - Combinación 1 + 2

**Concepto**: Implementar BOTH:
1. `lastTrustedLocation` separado (baseline siempre válido)
2. Validación periódica (detección rápida de divergencia)

**Implementación Integrada**:
```javascript
// Estado
let win32LastTrustedLocation = null;
let nativeOnlyCount = 0;

bootstrapWin32Location(cb) {
  wifi((wifiErr, wifiResult) => {
    win32LastTrustedLocation = wifiResult;  // ← Init trusted
    saveToLocationHistory(wifiResult, cb);
  });
}

normalWin32Location(lastValid, cb, timeoutFn) {
  platform.get_location((err, result) => {
    if (accuracyOk) {
      const distance = calcDistanceKm(result, win32LastTrustedLocation);
      
      if (distance <= 50) {
        nativeOnlyCount++;
        logger.debug(`[WIN32-VALIDATE] Native-only count: ${nativeOnlyCount}/3`);
        
        saveToLocationHistory(result, cb);
        
        // Validación periódica cada 3 ciclos
        if (nativeOnlyCount >= 3) {
          wifi((wifiErr, wifiResult) => {
            nativeOnlyCount = 0;
            if (!wifiErr) {
              win32LastTrustedLocation = wifiResult;  // ← Update trusted
              logger.debug('[WIN32-VALIDATE] Trusted location updated');
            }
          });
        }
      } else {
        // Jump detection contra trusted
        wifi((wifiErr, wifiResult) => {
          nativeOnlyCount = 0;  // Reset counter
          if (!wifiErr) {
            win32LastTrustedLocation = wifiResult;  // ← Update trusted
            // ... handle jump ...
          }
        });
      }
    }
  });
}

processResponse(coords, cb) {
  const data = { /* ... */ };
  win32LastTrustedLocation = data;  // ← Update on every WiFi success
  // ... storage ...
  return cb(null, data);
}
```

**Timeline de Recovery**:
```
t=0s:      WiFi falla durante jump
           → Native spurious guardado
           → nativeOnlyCount = 1

t=60s+δ:   Cache expira, native llamado
           → distance(native, trusted) OK
           → nativeOnlyCount = 2

t=120s+δ:  Cache expira, native llamado
           → distance(native, trusted) OK
           → nativeOnlyCount = 3
           → TRIGGER PERIODIC VALIDATION
           → wifi() → SUCCESS ✅
           → win32LastTrustedLocation updateado
           → nativeOnlyCount reset = 0
           
t=180s+δ:  Siguiente ciclo ya usa trusted actualizado
           → Sistema recuperado ✅
```

**Duración máxima de recovery: ~3 minutos** (vs indefinido sin solución)

**Pros:**
- ✅ Recovery rápido (máximo 3 minutos)
- ✅ Baseline siempre válido
- ✅ Bajo overhead (WiFi solo cada 3 ciclos)
- ✅ Compatible con código actual
- ✅ Fácil de testear y verificar

**Contras:**
- ❌ Requiere persistencia de `lastTrusted`
- ❌ Dos estados que mantener

**Recomendación:** 🏆 **IMPLEMENTAR ESTA**

---

## 🎯 Comparativa Rápida

| Solución | Velocidad | Complejidad | Overhead | Integridad |
|----------|-----------|-------------|----------|-----------|
| Opción 1 | ⭐⭐⭐ 3-5min | ⭐ Baja | ⭐⭐ Medio | ⭐⭐ Media |
| Opción 2 | ⭐⭐⭐⭐ Inmediato | ⭐⭐ Media | ⭐ Bajo | ⭐⭐⭐⭐ Alta |
| Opción 3 | ⭐⭐ Detección | ⭐⭐⭐ Alta | ⭐⭐ Medio | ⭐⭐⭐ Buena |
| Opción 4 | ❌ 24h | ⭐ Baja | ⭐ Bajo | ⭐⭐⭐ Buena |
| Opción 5 | ⭐⭐ Escalable | ⭐⭐⭐ Alta | ⭐⭐️ Medio | ⭐⭐⭐⭐ Excelente |
| **Opción 6** | **⭐⭐⭐⭐ 3min** | **⭐⭐ Media** | **⭐⭐ Medio** | **⭐⭐⭐⭐ Excelente** |

---

## 📝 Próximos Pasos Recomendados

1. **Implementar Opción 6 (Hybrid)**
   - Agregar `win32LastTrustedLocation` en estado del módulo
   - Agregar persistencia en SQLite con clave `last_trusted_location`
   - Implementar validación periódica cada 3 ciclos
   - Actualizar loggers para visibilizar cambios de trusted

2. **Tests**
   - Test: WiFi falla en ciclo X → trusted sigue siendo válido
   - Test: Después de 3 ciclos native-only → validación dispara
   - Test: Validación periódica → trusted updateado correctamente
   - Test: Upgrade de versión anterior → trusted inicializado desde historial

3. **Monitoring**
   - Logger explícito cuando trusted se actualiza
   - Logger de anomalía si trusted diverge mucho de native
   - Métrica: tiempo promedio de recovery

4. **Documentación**
   - Actualizar [win32-geo-location-redesign.md](win32-geo-location-redesign.md) con recovery mechanism
   - Explicar el flujo en arquitectura

---

## 🔗 Referencias

- Documento original: [win32-geo-location-redesign.md](win32-geo-location-redesign.md)
- Experimento de escenarios: [win32-geo-location-experiment.md](win32-geo-location-experiment.md)
- Código: [lib/agent/providers/geo/strategies.js](../../lib/agent/providers/geo/strategies.js)

