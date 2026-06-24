# Bug fixes — revisión de código v1.13.36

Revisión recursiva de todos los cambios introducidos entre `v1.13.35` y `v1.13.36`.
Se encontraron y corrigieron 11 bugs en 12 archivos.

---

## 1. `lib/agent/utils/storage.js` — Múltiples fixes

### 1a. Null dereference en `storage_fns.set` (CRÍTICO)

**Problema**  
La condición `if (err || !rows)` entraba cuando SQLite respondía con `(null, null)`.
La siguiente línea leía `err.code`, crasheando con `TypeError: Cannot read properties of null`.

```js
// ANTES
if (err || !rows) {
  if (err.code != 'ENOENT') return cb(err, null);  // crash si err es null
```

**Fix**  
Separar los dos checks en bloques independientes:

```js
// DESPUÉS
if (err) {
  if (err.code != 'ENOENT') return dbComm.close(() => cb(err, null));
  return dbComm.close(() => cb(err, []));
}
if (!rows) return dbComm.close(() => cb(null, []));
```

---

### 1b. Conexiones SQLite no se cerraban en paths de error (ALTO)

**Problema**  
Los métodos `all`, `query`, `set`, `del`, `update` y `clear` abrían una conexión SQLite vía `init()` pero en varios paths de error (como `err.code === 'ENOENT'` o errores de `SQLITE_READONLY`) retornaban el callback **sin llamar a `dbComm.close()`**, dejando la conexión abierta. Bajo carga o repetición podía agotar los file descriptors.

**Fix**  
Todos los paths de retorno en todos los métodos pasan por `dbComm.close(() => cb(...))`.

---

### 1c. `storage_fns.clear` usaba `dbComm.all` en vez de `dbComm.run` y no tenía `init()` (ALTO)

**Problema**  
`clear` ejecutaba `DELETE FROM` con `dbComm.all` (para lecturas), no con `dbComm.run` (para escrituras). Además, si la base de datos no estaba inicializada al momento de llamar `clear`, crasheaba con `TypeError: Cannot read properties of undefined`.

**Fix**  
Reescritura de `clear` para usar `init()` + `dbComm.run()` + `dbComm.close()`.

---

## 2. `lib/agent/providers/geo/strategies.js` — Double-callback y throw no controlado (CRÍTICO)

**Problema 1 — fall-through al handler siguiente**  
El bloque 429 no tenía `return` al final, por lo que la ejecución continuaba hasta `checkResponse(...)`, que llamaba al callback `cb` por segunda vez. Un double-callback corrompe el estado del llamador.

**Problema 2 — `throw` dentro de un callback**  
Dentro del catch del bloque 429 se ejecutaba `throw new Error(...)`. Dentro de un callback asíncrono esto escapa al `try/catch` del caller y se convierte en un `uncaughtException`, potencialmente crasheando el proceso del agente.

```js
// ANTES
if (resp && resp.statusCode === 429) {
  storage.do('query', ..., (errorStorage, storedData) => {
    try { return processResponse(cachedLocation, cb); }
    catch (e) { throw new Error('Couldnt get data in sqlite storage geo'); }  // ← MALO
  });
}  // ← sin return, cae al checkResponse → double-callback
checkResponse(body, ...
```

**Fix**

```js
// DESPUÉS
if (resp && resp.statusCode === 429) {
  storage.do('query', ..., (errorStorage, storedData) => {
    try { return processResponse(cachedLocation, cb); }
    catch (e) { return cb(new Error('Couldnt get data in sqlite storage geo')); }
  });
  return;  // ← detiene el fall-through
}
checkResponse(body, ...
```

---

## 3. `lib/conf/tasks/index.js` — Double-callback en `post_install` en Windows (ALTO)

**Problema**  
En la función `post_install`, el branch de Windows llamaba a `setUpVersion('this', ready)` pero sin `return`, lo que hacía que la siguiente línea `prey_user.create(ready)` también se ejecutara. Ambas funciones invocan el callback `ready`, provocando un double-callback.

```js
// ANTES
if (process.platform == 'win32') { setUpVersion('this', ready); }
prey_user.create(ready);  // ← también corre en Windows
```

**Fix**

```js
// DESPUÉS
if (process.platform == 'win32') { return setUpVersion('this', ready); }
prey_user.create(ready);
```

---

## 4. `lib/system/windows/winsvc.js` — `version_cache` se cacheaba como `null` permanentemente (ALTO)

**Problema**  
Si el binario `wpxsvc.exe` no existía o fallaba al primer intento (por ejemplo, durante el post-install antes de que el binario fuera copiado), `version_cache` se asignaba a `null`. La guarda `!== undefined` dejaba pasar `null` y el binario nunca se reintentaba durante esa sesión. Esto hacía que las rutas de winsvc (firewall, registry) cayeran siempre al fallback de PowerShell/reg.exe aunque el servicio ya estuviera disponible.

```js
// ANTES
if (version_cache !== undefined) return cb(null, version_cache);  // null pasa la guarda
version_cache = (!err && stdout) ? stdout.split('\n')[0].trim() : null;  // cachea el fallo
```

**Fix**

```js
// DESPUÉS
if (version_cache) return cb(null, version_cache);  // null no pasa la guarda
if (!err && stdout) version_cache = stdout.split('\n')[0].trim();  // solo cachea éxito
return cb(null, version_cache || null);
```

---

## 5. `lib/system/windows/registry.js` — Command injection en fallback de `reg.exe` (ALTO)

**Problema**  
Los parámetros `path`, `key` y `val` se concatenaban sin comillas en los comandos de shell de `exec`. Un valor con espacios o metacaracteres (como `&`, `|`, `>`) podía inyectar comandos adicionales.

```js
// ANTES
exec('reg add ' + path + ' /v ' + key + ' /d ' + val + ' /f', ...)
exec('reg query ' + path + ' /v ' + key, ...)
```

**Fix**  
Todos los parámetros se envuelven entre comillas dobles:

```js
// DESPUÉS
exec(`reg add "${path}" /v "${key}" /d "${val}" /f`, ...)
exec(`reg query "${path}" /v "${key}"`, ...)
```

---

## 6. `lib/agent/utils/utilinformation.js` — `process.kill(NaN)` sin guard (ALTO)

**Problema**  
Si el archivo `prey.pid` estaba vacío o corrupto, `Number.parseInt` devolvía `NaN`. La llamada `process.kill(NaN, 'SIGKILL')` lanzaba `ERR_INVALID_ARG_TYPE`. Había un `try/catch`, pero el mensaje de error era engañoso ("already gone") cuando la causa real era un PID inválido.

**Fix**  
Agregar guard explícito antes del kill:

```js
if (!Number.isInteger(pid) || pid <= 0) {
  edrLog(`deleteNodeService: invalid pid (${pid}) — skip kill`);
  return;
}
```

---

## 7. `lib/conf/tasks/os/windows.js` — `process.kill(NaN)` sin guard en `terminate_if_running` (ALTO)

**Problema**  
Mismo caso que el anterior: `pidfile` con contenido corrupto → `parseInt` devuelve `NaN` → `process.kill(NaN)` con error engañoso en el catch.

**Fix**  
Guard idéntico antes de `process.kill(pidNum)`:

```js
if (!Number.isInteger(pidNum) || pidNum <= 0) {
  edrLog(`terminate_if_running: invalid pid (${pidNum}) — skip kill`);
  delete_node_service();
  return next();
}
```

---

## 8. `lib/conf/panel/index.js` — Tres bugs (ALTO + MEDIO)

### 8a. `kill -9 undefined` en Unix cuando `client_pid` falla (ALTO)

**Problema**  
Si `client_pid` llamaba de vuelta con error, `pid` era `undefined`. La línea siguiente ejecutaba `kill -9 undefined` porque faltaba el `return`:

```js
// ANTES
if (err) log(err);  // sin return
setTimeout(() => exec(`kill -9 ${pid}`, ...), 1000);  // ejecuta con pid=undefined
```

**Fix**

```js
if (err) return log(err);
```

---

### 8b. NaN guard en Windows antes de `taskkill` (ALTO)

**Problema**  
Si el `prey.pid` estaba corrupto, `parseInt` devolvía `NaN` y se ejecutaba `taskkill /F /PID NaN`, que fallaba silenciosamente sin indicación clara.

**Fix**

```js
const pid = Number.parseInt(data.toString().trim(), 10);
if (!Number.isInteger(pid) || pid <= 0) { return log(`Error forcing new config: invalid PID in pidfile`); }
```

---

### 8c. PID con trailing whitespace en Unix (MEDIO)

**Problema**  
El resultado de `ps | grep | awk` en Unix termina con `\n`. El código hacía `.split('\r\n')[0]` pero no `.trim()`, por lo que `pid` podía ser `'1234\n'`, haciendo que `kill -9 1234\n` fallara en el shell.

**Fix**

```js
// ANTES
cb(null, pid.toString().split('\r\n')[0]);

// DESPUÉS
cb(null, pid.toString().split('\r\n')[0].trim());
```

---

## 9. `lib/system/windows/edr_log.js` — Escritura síncrona en disco en producción (MEDIO)

**Problema**  
El módulo usaba `fs.appendFileSync` (bloqueante) en paths calientes del agente de producción. El propio archivo incluía el comentario "Remove before final release." Cada llamada bloqueaba el event loop brevemente y escribía en `%TEMP%/prey_edr_paths.log` en cada dispositivo administrado.

**Fix**  
Convertir a no-op para eliminar las escrituras sin romper los 4 archivos que importan el módulo:

```js
module.exports = () => {};
```

---

## 10. `lib/agent/triggers/hostname/index.js` — Guard de hostname no resistente a whitespace (MEDIO)

**Problema**  
El check que detecta datos JSON corruptos en el campo hostname evaluaba `stored_name[0]`, pero si el valor tenía un espacio al inicio (ej. `  {"lat":1}`), el primer carácter era un espacio y el check lo dejaba pasar como hostname válido. Esto podría disparar eventos de `device_renamed` con datos de localización como nombre de host.

```js
// ANTES — solo el primer carácter, sin trim
if (!stored_name || stored_name[0] === '[' || stored_name[0] === '{' || stored_name[0] === '"') {
```

**Fix**

```js
// DESPUÉS — trim antes del check
const trimmed = stored_name ? stored_name.trim() : '';
if (!trimmed || trimmed[0] === '[' || trimmed[0] === '{' || trimmed[0] === '"') {
```

---

## Resumen

| # | Archivo | Severidad | Descripción |
|---|---------|-----------|-------------|
| 1a | `storage.js` | CRÍTICO | Null dereference en `set` con `(null, null)` |
| 1b | `storage.js` | ALTO | Conexiones DB sin cerrar en paths de error |
| 1c | `storage.js` | ALTO | `clear` usaba `dbComm.all` y no tenía `init()` |
| 2 | `geo/strategies.js` | CRÍTICO | Double-callback y `throw` no controlado en handler 429 |
| 3 | `conf/tasks/index.js` | ALTO | Double-callback en `post_install` en Windows |
| 4 | `winsvc.js` | ALTO | `version_cache = null` cacheado permanentemente |
| 5 | `registry.js` | ALTO | Command injection por parámetros de shell sin comillas |
| 6 | `utilinformation.js` | ALTO | `process.kill(NaN)` sin guard |
| 7 | `tasks/os/windows.js` | ALTO | `process.kill(NaN)` sin guard en `terminate_if_running` |
| 8a | `conf/panel/index.js` | ALTO | `kill -9 undefined` por falta de `return` |
| 8b | `conf/panel/index.js` | ALTO | `taskkill /F /PID NaN` sin guard |
| 8c | `conf/panel/index.js` | MEDIO | PID con `\n` trailing causaba fallo en Unix |
| 9 | `edr_log.js` | MEDIO | Escritura síncrona bloqueante en producción |
| 10 | `hostname/index.js` | MEDIO | Guard de JSON bypaseable con whitespace al inicio |

**Tests**: 1019 passing tras todos los fixes.
