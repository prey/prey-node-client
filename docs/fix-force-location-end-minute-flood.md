# Fix: flood de force-location en el minuto de cierre del `tracking_schedule`

**Branch:** `fix/force-location-end-minute-flood`
**Archivo corregido:** [`lib/agent/triggers/location/index.js`](../lib/agent/triggers/location/index.js)
**Test de regresión:** [`test/lib/agent/triggers/location/locationindex.test.js`](../test/lib/agent/triggers/location/locationindex.test.js)

---

## 1. Qué pasó (el síntoma)

En un cliente con la versión nueva apareció en el log la misma línea repetida cientos de
veces, todas con el **mismo segundo** de timestamp:

```
info Wed, 12 Aug 2026 23:13:00 GMT [location] Force location skipped: already sent today
info Wed, 12 Aug 2026 23:13:00 GMT [location] Force location skipped: already sent today
info Wed, 12 Aug 2026 23:13:00 GMT [location] Force location skipped: already sent today
... (cientos de líneas idénticas)
```

Esto **no era** spam cosmético de logs: `forceLocation()` se estaba invocando cientos de
veces por segundo durante un minuto puntual del día. Cada invocación:

- gira el event loop (recursión vía `setTimeout`),
- ejecuta `writeStorage`, que a su vez hace un `storage.do('query', ...)` contra la tabla
  `keys` de SQLite,

por lo que además del log había carga real de CPU y de base de datos.

---

## 2. Por qué pasó (la causa raíz)

El scheduler de force-location trabaja con **granularidad de minutos**, pero dos helpers no
coincidían en el borde del minuto `end_at` de la ventana:

### a) `checkSchedule` — borde `end_at` **inclusivo**

```js
// lib/agent/triggers/location/index.js
const shouldSend = startMinutes <= endMinutes
  ? currentMinutes >= startMinutes && currentMinutes <= endMinutes   // <-- <= inclusivo
  : currentMinutes >= startMinutes || currentMinutes <= endMinutes;
```

Durante **todo** el minuto `end_at`, `checkSchedule` devuelve `shouldSend: true`.

### b) `msUntilWindowEnd` — devuelve **`0`** en ese mismo minuto

```js
return (endMinutes - currentMinutes) * 60 * 1000;   // == 0 cuando currentMinutes === endMinutes
```

### c) `scheduleForceInWindow` — el `setTimeout(0)` que dispara la recursión

```js
forceLocation();                                     // corre el check (skipped: already sent)
forceIntervalId = setInterval(forceLocation, ...);   // intervalo de repetición (>= 2 min)
const msToEnd = msUntilWindowEnd(...);               // == 0 en el minuto end_at
forceTimeoutId = setTimeout(() => {
  clearInterval(forceIntervalId);
  scheduleNextWindow(schedule);                      // vuelve a chequear checkSchedule → sigue true
}, msToEnd);                                          // dispara en el SIGUIENTE tick porque msToEnd == 0
```

### El loop

En el minuto `end_at` se forma una recursión estrecha:

```
scheduleForceInWindow
  → forceLocation()            (log: "Force location skipped: already sent today")
  → setTimeout(0)
  → scheduleNextWindow
  → checkSchedule === true     (mismo minuto, borde inclusivo)
  → scheduleForceInWindow      (vuelve a empezar)
  → ...
```

Se repite en **cada tick** del event loop durante los 60 segundos completos de ese minuto.
Recién se detiene cuando el reloj pasa a `end_at + 1`, momento en que `checkSchedule` por fin
devuelve `false`. El `23:13` del log era exactamente el minuto de cierre (`end_at`) del
`tracking_schedule` de ese equipo.

> **Alcance contenido:** `checkSchedule` y `msUntilWindowEnd` se usan **solo** dentro de este
> módulo (verificado con grep), así que el fix no afecta a otros consumidores.

---

## 3. Cómo se corrigió

Se le puso un **piso** al timeout de cierre de ventana para que nunca pueda re-entrar dentro
del mismo minuto. Como `checkSchedule` considera que el minuto `end_at` completo está dentro
de la ventana, lo correcto es esperar hasta el **fin de ese minuto**, no hasta su inicio (que
es lo que representa el `0`).

```js
// lib/agent/triggers/location/index.js — scheduleForceInWindow
let msToEnd = msUntilWindowEnd(schedule, new Date(), timezone);
// checkSchedule trata end_at como inclusivo (todo el minuto end_at está dentro de la ventana),
// pero msUntilWindowEnd devuelve 0 en ese minuto. Un timeout de 0 ms dispara en el siguiente
// tick, scheduleNextWindow ve shouldSend aún true, y re-entra en scheduleForceInWindow —
// floodeando forceLocation en cada tick durante todo el minuto. Esperamos hasta el fin del
// minuto end_at (además protege contra valores negativos por drift de reloj/DST).
if (msToEnd < 60 * 1000) msToEnd = 60 * 1000;
forceTimeoutId = setTimeout(() => {
  clearInterval(forceIntervalId);
  forceIntervalId = null;
  scheduleNextWindow(schedule);
}, msToEnd);
```

**Efecto en el minuto `end_at`:** corre **exactamente una** vez `forceLocation()`, el timeout
de cierre dispara ~60 s después en `end_at + 1`, `checkSchedule` devuelve `false`, y
`scheduleNextWindow` agenda la próxima ventana normalmente. El intervalo de repetición
(mínimo 2 min) no llega a dispararse en ese minuto extra, así que no hay flood ni regresión
para la operación normal a mitad de ventana (donde `msToEnd` ya es ≥ 60 s y el piso es no-op).

### Por qué esta opción y no otras

- **Hacer `checkSchedule` exclusivo** (`< endMinutes`) también rompería el loop, pero cambia la
  semántica de un helper exportado (force cortaría un minuto antes) y arriesga tests de borde
  existentes.
- **Sumar `+60000` dentro de `msUntilWindowEnd`** cambiaría los valores de retorno de ese helper
  exportado y rompería sus tres tests unitarios existentes.
- **El piso en el único call site** es el cambio más contenido: una línea, sin tocar la
  semántica de los helpers ni sus tests.

---

## 4. Cómo nos aseguramos de la corrección

### a) Test de regresión que reproduce el bug

Se agregó un test en el bloque `describe('restartForceInterval - scheduling behavior')`, que ya
usa `sinon` fake timers:

```js
it('does not flood forceLocation on the end_at minute', () => {
  clock.setSystemTime(new Date('2025-01-08T15:00:00').getTime()); // minuto end_at de SCHEDULE (07:00–15:00)
  fakeConfig.getData.withArgs('control-panel.tracking_schedule').returns(SCHEDULE);
  const forceSpy = sinon.spy();
  locationModule.__set__('forceLocation', forceSpy);
  locationModule.__get__('restartForceInterval')();
  clock.tick(1000);
  expect(forceSpy.callCount).to.be.at.most(2); // con el fix: 1 llamada, sin recursión
  expect(locationModule.__get__('forceTimeoutId')).to.not.be.null;
});
```

### b) Verificación de que el test realmente detecta el bug

Se revirtió temporalmente el fix (`git stash`) y se corrió el test:

- **Sin el fix:** `forceLocation` se llamó **1002 veces** (topó el `loopLimit` de los fake timers
  de sinon) → el test falla con `AssertionError: expected 1002 to be at most 2`.
- **Con el fix:** `forceLocation` se llama **1 vez** → el test pasa.

Esto confirma que el test distingue de verdad el comportamiento con y sin corrección (no es un
test que pase por casualidad).

### c) Suite completa y calidad

- `npx mocha test/lib/agent/triggers/location/locationindex.test.js` → **95 tests passing**
  (incluye el nuevo y los `msUntilWindowEnd`/`restartForceInterval` existentes intactos).
- `npm run typecheck` → limpio (el archivo ya tenía `// @ts-check`).
- El hook `pre-commit` corrió typecheck + la suite completa del repo y pasó antes de crear el commit.

> Nota: `npm run lint` no pudo ejecutarse por un problema ambiental preexistente del
> `eslint-plugin-import` (`TypeError: ... expand is not a function`) que falla igual en archivos
> que no se tocaron — no es un hallazgo del código de este fix.

---

## 5. Endurecimiento adicional (defense-in-depth)

Además del fix puntual, se agregaron guardas generales para que un caso borde así no vuelva a
degenerar en un flood, venga de donde venga (bug de scheduling, tormenta de `onDataChange`,
listeners duplicados):

### a) Guarda de frecuencia + throttle de log en `forceLocation`

```js
// lib/agent/triggers/location/index.js
const MIN_FORCE_SPACING_MS = 1000;              // nunca más de 1x/segundo
const FORCE_THROTTLE_WARN_INTERVAL_MS = 60000;  // avisa a lo sumo 1x/minuto

const forceLocation = () => {
  const now = Date.now();
  if (now - lastForceRun < MIN_FORCE_SPACING_MS) {
    if (now - lastForceThrottleWarn >= FORCE_THROTTLE_WARN_INTERVAL_MS) {
      logger.warn('forceLocation throttled: invoked more than once per second');
      lastForceThrottleWarn = now;
    }
    return;
  }
  lastForceRun = now;
  // ...
};
```

Convierte cualquier runaway futuro en **una** línea de warning accionable por minuto, en vez de
miles de líneas idénticas + carga de SQLite.

### b) Tests nuevos

- **`throttles a second call fired within one second`** — verifica la guarda directamente (dos
  llamadas seguidas → el check corre 1 vez, se emite el warning). Falla si se quita la guarda.
- **`stays bounded over a simulated 48h (marathon)`** — simula 48 h de reloj con fake timers y
  afirma que `forceLocation` se llama un número acotado de veces (`> 0` y `< 200`). Un runaway
  de re-scheduling excedería el `loopLimit` de sinon y lanzaría antes de las aserciones.

> Suite tras el endurecimiento: **97 tests passing** + `npm run typecheck` limpio.

---

## 6. Cómo evitar esta clase de bug a futuro

Checklist para cualquier código con timers / ventanas / lógica que se re-agenda:

1. **Piso a todo delay calculado** — ningún `setTimeout`/`setInterval` con delay `0` o negativo
   si el callback se re-agenda.
2. **Guarda de re-entrada / frecuencia** en la función caliente (`lastRun = Date.now()`).
3. **Throttle del log** dentro de esa guarda (un warning por minuto, no por tick).
4. **Una sola fuente de verdad para los bordes** — derivar "está dentro de la ventana" y "cuánto
   falta para el fin" de los **mismos** números, para que no puedan divergir.
5. **Tests de borde + maratón** — `start_at`, `end_at`, `end_at+1`, `start==end`, overnight, y una
   simulación de 24–48 h que acote el número de invocaciones.

Preguntas de code review que hubieran cazado esto:
- ¿Este delay puede dar 0 o negativo?
- ¿Esta función se re-agenda a sí misma? ¿Qué le impide re-entrar en el mismo tick?
- ¿Estas dos funciones interpretan el mismo concepto de dominio por separado?

---

## 7. Resumen

| | |
|---|---|
| **Síntoma** | Cientos de `Force location skipped: already sent today` en el mismo segundo |
| **Causa** | Borde `end_at` inclusivo en `checkSchedule` vs. `msUntilWindowEnd === 0` → `setTimeout(0)` recursivo en `scheduleForceInWindow` |
| **Fix** | Piso de 60 s al timeout de cierre de ventana (esperar al fin del minuto `end_at`) |
| **Garantía** | Test de regresión que da 1002 llamadas sin el fix y 1 con el fix; suite de 95 tests + typecheck en verde |
