# Windows Geo Location Redesign

## Contexto y motivación

El sistema anterior de geolocalización en Windows usaba la misma cadena de estrategias que Linux/macOS: `native → wifi → geoip`. Este modelo tiene varios problemas estructurales en Windows:

1. **Sin historial de ubicaciones**: No existía forma de detectar si un resultado era anómalamente diferente al último conocido. Un salto de 2.000 km podía ser reportado sin validación alguna.

2. **Condición de carrera en `processResponse`**: Al guardar `last_wifi_location`, el código hacía `delete` + `set`. Si dos llamadas concurrentes ejecutaban ambas la operación, la segunda podía hacer un `set` duplicado o el `delete` podía borrar un dato recién insertado por la primera.

3. **Sin control de concurrencia**: Si llegaban dos pedidos de ubicación simultáneos, ambos lanzaban fetchs independientes, duplicando llamadas al sistema operativo y a la API de wifi.

4. **Sin caché de corto plazo**: Cada llamada a `fetch_location` lanzaba una nueva operación, incluso si hacía 10 segundos se había obtenido una ubicación válida.

5. **Umbral de precisión en el lugar equivocado**: `win32/index.js` rechazaba resultados nativos con accuracy > 100m, pero no tenía contexto para decidir si había alternativa disponible. El orchestrator es quien debe decidir si reintentar o caer a wifi.

6. **Sin bootstrapping**: La primera vez que se pedía ubicación en un equipo nuevo, no había referencia para detectar saltos.

---

## Arquitectura nueva

```
fetch_location (index.js)
  └─ windows? → strategies.win32LocationFetch(cb)
                  │
                  ├─ Cache válida (<60s)?
                  │    └─ Leer history → retornar history[last] → cb()
                  │
                  └─ startWin32Fetch(cb)        ← concurrency guard
                       ├─ ¿history vacía?
                       │    └─ bootstrapWin32Location()
                       │         ├─ ¿last_wifi_location existe? → seed history → cb
                       │         └─ wifi() → guardar en history y last_wifi_location → cb
                       │
                       └─ ¿history tiene entradas?
                            └─ normalWin32Location(lastValid)
                                 ├─ native() → accuracy ≤100m?
                                 │    SÍ → distancia desde lastValid ≤50km?
                                 │    │      SÍ → guardar en history → cb
                                 │    │      NO → wifi() para confirmar salto
                                 │    │              SÍ confirma → mejor accuracy entre ambos → cb
                                 │    │              NO confirma → usar wifi → cb
                                 │    │              wifi falla → usar native candidato → cb
                                 │    NO → retry en 30s
                                 │              retry también falla → wifi fallback → cb
                                 └─ native() error → retry en 30s → ...mismo flujo...
```

---

## Cambios por archivo

### `lib/agent/providers/geo/win32/index.js`

#### Qué cambió

Se eliminó la validación de accuracy > 100m que rechazaba el resultado con error. El nuevo código devuelve el resultado tal como viene del servicio de administración, sin filtrar por accuracy.

**Antes:**

```js
const hasAllowedAccuracy = (output) => (
  typeof output?.accuracy !== 'number'
  || !Number.isFinite(output.accuracy)
  || output.accuracy <= 100
);

// ...dentro de get_location:
if (!hasAllowedAccuracy(output)) {
  const errorAccuracy = new Error('Accuracy from admin service exceeds maximum allowed value (100)');
  hooks.trigger('error', errorAccuracy);
  return cb(errorAccuracy);
}
```

**Después:**

La función `hasAllowedAccuracy` fue eliminada. `get_location` simplemente retorna el resultado si las coordenadas son válidas.

También se cambió `accuracy: output.accuracy || null` por `accuracy: output.accuracy ?? null`. El operador `||` convierte `0` en `null` (falsy), mientras que `??` solo aplica el default cuando el valor es `null` o `undefined`. Aunque accuracy=0 es improbable, el cambio elimina un bug latente.

#### Por qué

La decisión de si un accuracy de 150m es aceptable depende del contexto: ¿hay alternativa disponible? ¿es la primera vez? ¿el retry también falló? Ese contexto solo existe en el orchestrator (`strategies.js`), no en el driver de bajo nivel. `win32/index.js` debe reportar los hechos, no tomar decisiones de política.

---

### `lib/agent/providers/geo/strategies.js`

Este archivo concentra todos los cambios nuevos. Se agregaron las siguientes piezas:

#### 1. Estado de módulo para concurrencia y caché

```js
let win32FetchInProgress = false;
let win32PendingCallbacks = [];
let win32LastFetchTime = null;
```

Estas variables viven en el scope del módulo (singleton por proceso). `win32FetchInProgress` indica si hay un fetch activo. `win32PendingCallbacks` es la cola de callbacks que esperan el resultado. `win32LastFetchTime` guarda el timestamp del último fetch exitoso.

#### 2. Corrección de `processResponse` (bug de condición de carrera)

**Antes:**

```js
storage.do('delete', { type: 'keys', id: 'last_wifi_location' }, () => {
  storage.do('set', {
    type: 'keys', id: 'last_wifi_location', data: { value: JSON.stringify(data) },
  }, ...);
});
```

**Después:**

```js
storage.do('query', { type: 'keys', column: 'id', data: 'last_wifi_location' }, (err, rows) => {
  if (err) {
    logger.debug('Unable to read last_wifi_location data');
  } else if (rows && rows.length > 0) {
    storage.do('update', {
      type: 'keys', id: 'last_wifi_location', columns: 'value', values: JSON.stringify(data),
    }, ...);
  } else {
    storage.do('set', {
      type: 'keys', id: 'last_wifi_location', data: { value: JSON.stringify(data) },
    }, ...);
  }
});
```

**Por qué:** El patrón `delete` + `set` es inherentemente no atómico. Si dos llamadas a `wifi()` terminan casi simultáneamente (posible cuando `win32LocationFetch` hacía jump detection consultando wifi), ambas podían llegar al `delete`, luego ambas hacían `set`, resultando en dos rows o en uno borrado. La operación `update`-or-`set` es idempotente y segura.

`processResponse` retorna `cb(null, data)` inmediatamente antes de las operaciones de storage. El guardado es fire-and-forget intencional (patrón existente en el codebase).

#### 3. `calcDistanceKm`

```js
const calcDistanceKm = (loc1, loc2) => {
  const p1 = new LatLon(loc1.lat, loc1.lng);
  const p2 = new LatLon(loc2.lat, loc2.lng);
  return Number.parseFloat(p1.distanceTo(p2));
};
```

Reutiliza `LatLon` de `lib/agent/triggers/location/lib/latlng.js`, que ya existía en el codebase para geofencing. No se introdujo ninguna dependencia nueva. `distanceTo` devuelve kilómetros, convirtiendo a float para comparaciones numéricas.

#### 4. `pickBestAccuracy`

```js
const pickBestAccuracy = (locA, locB) => {
  const accA = typeof locA.accuracy === 'number' ? locA.accuracy : Infinity;
  const accB = typeof locB.accuracy === 'number' ? locB.accuracy : Infinity;
  return accA <= accB ? locA : locB;
};
```

Compara dos ubicaciones y retorna la de menor accuracy (menor valor = más precisa). Si una no tiene accuracy numérica, se trata como Infinity (la peor posible), favoreciendo siempre a la que sí tiene dato válido.

#### 5. `getLocationHistory` y `parseHistory`

```js
const getLocationHistory = (cb) => {
  storage.do('query', { type: 'keys', column: 'id', data: 'location_history_win32' }, cb);
};

const parseHistory = (rows) => {
  if (!rows || rows.length === 0) return [];
  try { return JSON.parse(rows[0].value) || []; } catch (e) {
    logger.debug(`Failed to parse location_history_win32: ${e.message}`);
    return [];
  }
};
```

`location_history_win32` es un nuevo registro en la tabla `keys` de SQLite. Su `value` es un JSON array de objetos de ubicación, con el más reciente al final (`array[length-1]`). `parseHistory` tiene manejo defensivo: si el JSON está corrupto, retorna array vacío en lugar de propagar el error (el historial se reconstruye en el siguiente ciclo).

#### 6. `saveToLocationHistory`

```js
const saveToLocationHistory = (location, cb) => {
  getLocationHistory((err, rows) => {
    if (err) return cb(err);
    const history = parseHistory(rows);
    history.push(location);
    if (history.length > 20) history.splice(0, history.length - 20);
    const value = JSON.stringify(history);
    if (rows && rows.length > 0) {
      storage.do('update', { type: 'keys', id: 'location_history_win32', columns: 'value', values: value }, cb);
    } else {
      storage.do('set', { type: 'keys', id: 'location_history_win32', data: { id: 'location_history_win32', value } }, cb);
    }
  });
};
```

Agrega una entrada al historial y trunca a máximo 15 entradas, eliminando las más antiguas. Usa el mismo patrón update-or-set que `processResponse` para evitar duplicados. El límite de 15 entradas impide crecimiento indefinido del registro en SQLite.

#### 7. `drainWin32Callbacks`

```js
const drainWin32Callbacks = (err, result) => {
  win32FetchInProgress = false;
  const cbs = win32PendingCallbacks.splice(0);
  cbs.forEach((fn) => fn(err, result));
};
```

Libera el flag de concurrencia y llama a todos los callbacks encolados con el mismo resultado. `splice(0)` vacía el array atómicamente en un solo tick de JS, evitando que nuevas llamadas que lleguen durante el drenado sean llamadas con el resultado viejo.

#### 8. `bootstrapWin32Location`

```js
const bootstrapWin32Location = (cb) => {
  storage.do('query', { type: 'keys', column: 'id', data: 'last_wifi_location' }, (err, rows) => {
    if (!err && rows && rows.length > 0) {
      let existing;
      try { existing = JSON.parse(rows[0].value); } catch (e) { ... }
      if (existing && typeof existing.lat === 'number') {
        return saveToLocationHistory(existing, (saveErr) => cb(saveErr, existing));
      }
    }
    wifi((wifiErr, wifiResult) => {
      if (wifiErr) return cb(wifiErr);
      saveToLocationHistory(wifiResult, (saveErr) => cb(saveErr, wifiResult));
    });
  });
};
```

**Por qué un bootstrap separado:** La primera vez que se ejecuta el nuevo código (historial vacío), no hay referencia para detectar saltos. La fase de bootstrap obtiene un primer punto de referencia de la manera más confiable: si ya existe `last_wifi_location` (guardado por ciclos anteriores del agente), se usa ese dato para no hacer una llamada de red innecesaria. Si no existe, se hace una llamada wifi y el resultado se guarda tanto en el historial como en `last_wifi_location` (vía `processResponse` dentro de `wifi()`).

No se usa native en bootstrap porque en el primer ciclo no tenemos baseline para juzgar si un resultado nativo es legítimo.

#### 9. `normalWin32Location`

Implementa el flujo de ubicación normal (cuando ya hay historial):

- Intenta obtener ubicación nativa
- Acepta el resultado si accuracy ≤ 100m (o si accuracy es null/no-finito, lo que indica que el servicio no reportó accuracy)
- Si no es aceptable: reintenta una vez en 30s; si el retry también falla, cae a wifi
- Si nativa es aceptable: calcula distancia al último punto válido
  - ≤ 50km: guarda y retorna
  - \> 50km (jump detection): consulta wifi para confirmar
    - wifi confirma salto (>50km desde lastValid): selecciona el de mejor accuracy
    - wifi no confirma salto: usa resultado wifi (la nativa era probablemente errónea)
    - wifi falla: usa la nativa candidata (es mejor que nada)

**Por qué 30s de retry:** Es tiempo suficiente para que el servicio de Windows Location Platform actualice su caché interna si estaba procesando.

**Por qué 50km:** Umbral que cubre movimientos de transporte terrestre en un ciclo normal (aviones son outliers que la lógica maneja con jump detection). Un umbral más bajo generaría falsos positivos en ciudades grandes; uno más alto permitiría errores obvios.

**Por qué wifi confirma en lugar de rechazar:** El jump puede ser legítimo (viaje en avión). Wifi determina si el salto es real o un artefacto del servicio nativo.

**Por qué `timeoutFn` es inyectable:** Permite a los tests verificar el comportamiento del retry sin esperar 30 segundos reales. Los tests pasan una función que ejecuta el callback inmediatamente.

#### 10. `startWin32Fetch` (concurrency guard)

```js
const startWin32Fetch = (cb, timeoutFn) => {
  win32PendingCallbacks.push(cb);
  if (win32FetchInProgress) return;
  win32FetchInProgress = true;
  // ...lanza bootstrap o normal...
};
```

Si ya hay un fetch activo, el callback se encola y la función retorna sin hacer nada más. Cuando el fetch activo termine, `drainWin32Callbacks` llamará a todos los callbacks encolados con el mismo resultado. Esto garantiza que nunca haya más de una operación de geolocalización activa simultáneamente.

#### 11. `win32LocationFetch` (entry point principal)

```js
const win32LocationFetch = (cb, timeoutFn = setTimeout) => {
  if (win32LastFetchTime && (Date.now() - win32LastFetchTime) < 60000) {
    return getLocationHistory((err, rows) => {
      if (!err) {
        const history = parseHistory(rows);
        if (history.length > 0) {
          return cb(null, history[history.length - 1]);
        }
      }
      startWin32Fetch(cb, timeoutFn);
    });
  }
  startWin32Fetch(cb, timeoutFn);
};
```

Verifica si el último fetch fue hace menos de 60 segundos. Si sí, lee el historial y retorna la última entrada sin lanzar ninguna operación de red. La caché se verifica **antes** del concurrency guard, por lo que una llamada con caché válida no toca `win32FetchInProgress` ni `win32PendingCallbacks`.

Si la caché expiró o el historial está vacío (edge case: guardado falló), cae a `startWin32Fetch`.

---

### `lib/agent/providers/geo/index.js`

#### Qué cambió

El bloque `if (osName === 'windows')` dejó de manipular `defaultStrategy` y de entrar a la cadena `strategyCallback`. Ahora delega directamente a `strategies.win32LocationFetch(cb)`.

**Antes:**

```js
if (osName === 'windows') {
  defaultStrategy = 'native';
  setTimeout(() => { getLocationPermission(); }, 8000);
}
current = defaultStrategy;
strategies[defaultStrategy]((err, res) => strategyCallback(err, res, cb));
```

**Después:**

```js
if (osName === 'windows') {
  setTimeout(() => { getLocationPermission(); }, 8000);
  return strategies.win32LocationFetch(cb);
}
current = defaultStrategy;
strategies[defaultStrategy]((err, res) => strategyCallback(err, res, cb));
```

#### Por qué

La cadena `native → wifi → geoip` de `strategyCallback` no tiene el contexto de Windows (jump detection, historial, retry con delay). Toda esa lógica vive en `win32LocationFetch`. Hacer que `index.js` delegue completamente evita que la lógica de Windows quede repartida entre dos archivos.

El `setTimeout` para `getLocationPermission` se mantiene: sigue siendo necesario para el flujo de permisos de Windows, independientemente de cómo se obtenga la ubicación.

---

## Cambios en tests

### `test/lib/agent/providers/geo/win32.test.js`

El test `"should return error when accuracy is greater than 100"` fue reemplazado por `"should return result (no error) when accuracy is greater than 100"`. El test ahora verifica que `get_location` retorna el resultado exitosamente cuando accuracy es 200m, en lugar de esperar un error. Refleja el cambio de responsabilidad: `win32/index.js` ya no filtra por accuracy.

### `test/lib/agent/providers/geo/strategies.test.js`

- `stubStorageSuccessFlow` actualizado para usar `update` en lugar de `del`, reflejando la corrección de `processResponse`.
- Test de regresión agregado: `"processResponse should not call del on last_wifi_location"` verifica que nunca se llame `del` en ese key.
- Bloque `describe('Geo Strategies - win32LocationFetch')` con 12 tests cubriendo:
  - Cache hit: segunda llamada dentro de 60s retorna último historial sin llamadas de plataforma
  - Bootstrap con `last_wifi_location` existente: semilla el historial desde el dato guardado
  - Bootstrap sin `last_wifi_location`: llama wifi y guarda el resultado
  - Bootstrap propaga error de wifi si falla
  - Normal: native ≤100m, distancia ≤50km → guardado y retornado
  - Normal: native ≤100m, jump >50km, wifi confirma → mejor accuracy
  - Normal: native ≤100m, jump >50km, wifi no confirma → resultado wifi
  - Normal: native ≤100m, jump >50km, wifi falla → candidato nativo
  - Normal: native falla ambos intentos → wifi fallback exitoso
  - Normal: native falla ambos intentos, wifi también falla → error propagado
  - Concurrencia: segunda llamada durante fetch activo es encolada, ambas reciben mismo resultado
  - Límite de historial: entrada 21 desplaza la más antigua (máx 20)

### `test/lib/agent/providers/geo/geo.test.js`

- `strategiesStub` incluye `win32LocationFetch: sinon.stub()`.
- El `describe('fetch_location on Windows')` fue reescrito de 6 tests (que verificaban la cadena native/wifi/geoip) a 3 tests que verifican que:
  1. Windows delega a `win32LocationFetch` y retorna su resultado
  2. Windows propaga el error de `win32LocationFetch`
  3. `getLocationPermission` no es llamado inmediatamente (usa `setTimeout`)

---

## Invariantes del sistema nuevo

| Invariante | Garantía |
|---|---|
| Solo un fetch activo a la vez | `win32FetchInProgress` flag + callback queue |
| Resultado de fetch compartido entre llamadas concurrentes | `drainWin32Callbacks` llama a todos los pending con el mismo resultado |
| Caché de 60s previene fetches redundantes | `win32LastFetchTime` verificado antes del concurrency guard |
| Historial máximo 15 entradas | `splice(0, history.length - 15)` en `saveToLocationHistory` |
| No duplicados en SQLite para location keys | Patrón update-or-set en `processResponse` y `saveToLocationHistory` |
| Accuracy > 100m tiene segunda oportunidad | Retry en 30s antes de caer a wifi |
| Saltos > 50km son validados, no aceptados ni rechazados | Wifi confirma o desmiente antes de decidir |
| Bootstrap no usa native | Primera entrada siempre proviene de wifi o de `last_wifi_location` existente |

---

## Compatibilidad hacia atrás

- `last_wifi_location`: sigue existiendo y siendo actualizado por `processResponse`. Código existente que lo lee no se rompe.
- `location_history_win32`: nuevo registro. En equipos sin él, `parseHistory` retorna `[]`, lo que activa bootstrap. Transparente.
- `win32/index.js` sigue exportando `get_location` y `askLocationNativePermission` con la misma firma. Solo cambió el comportamiento del filtro de accuracy.
- Linux/macOS no son afectados: el bloque de código nuevo solo se alcanza cuando `osName === 'windows'`.
