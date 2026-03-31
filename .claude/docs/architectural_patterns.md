# Architectural Patterns

## Event-Driven Architecture

The codebase uses a centralized event system based on Node.js EventEmitter.

**Hooks System** ([lib/agent/hooks.js](lib/agent/hooks.js))
- Singleton EventEmitter serving as the central event bus
- Used throughout the agent for decoupled communication
- Events: `data`, `error`, `report`, `action`, `event`, `get_location`, etc.
- See [lib/agent/hooks.js:6-11](lib/agent/hooks.js#L6-L11) for trigger implementation

**Emitter Pattern for Actions/Triggers** ([lib/agent/actions.js:52](lib/agent/actions.js#L52))
- Actions and triggers return EventEmitters in their `start()` callback
- Emitter events watched and re-emitted via hooks system
- See [lib/agent/actions.js:23-27](lib/agent/actions.js#L23-L27) for event watching

## Dynamic Module Loading

Convention-based discovery and loading of extensible components.

**Actions/Triggers/Providers Pattern**
- Actions: [lib/agent/actions.js:10-18](lib/agent/actions.js#L10-L18)
- Triggers: [lib/agent/triggers.js](lib/agent/triggers.js)
- Providers: [lib/agent/providers.js:15-23](lib/agent/providers.js#L15-L23)

**Loading Convention**
```
loadModule(name) => require(join(__dirname, `${type}s`, name))
```

**Provider Discovery** ([lib/agent/providers.js:30-34](lib/agent/providers.js#L30-L34))
- Automatically discovers functions starting with `get_` prefix
- Strips `get_` from name to create getter registry
- Example: `get_location()` → registered as `location`

## Cross-Platform Abstraction

OS-specific behavior isolated into platform directories.

**Platform Normalization** (repeated throughout codebase)
```javascript
process.platform.replace('darwin', 'mac').replace('win32', 'windows')
```
- Examples: [lib/system/index.js:9](lib/system/index.js#L9), [lib/agent/providers/geo/index.js:9](lib/agent/providers/geo/index.js#L9)

**Platform-Specific Modules**
- System operations: [lib/system/{mac,linux,windows}/](lib/system/)
- Action implementations: [lib/agent/actions/alarm/{mac,linux,windows}.js](lib/agent/actions/alarm/)
- Dynamically loaded: `require('./' + os_name)` pattern (see [lib/system/index.js:10](lib/system/index.js#L10))

## Callback-Based Async Control Flow

Heavy use of callbacks and the `async` library; promises/async-await rarely used.

**Standard Callback Signature**
```javascript
function(err, result, metadata, retries) { }
```

**Async Library Usage**
- Queue-based operations: [lib/agent/utils/storage.js:71-75](lib/agent/utils/storage.js#L71-L75)
- Parallel operations: [lib/system/index.js:56-62](lib/system/index.js#L56-L62)

**Error Handling Convention**
- Check `err` first in callbacks
- Emit errors via hooks: [lib/agent/actions.js:39-41](lib/agent/actions.js#L39-L41)

## Plugin/Module Interface Contracts

**Actions Contract** ([lib/agent/actions/alarm/index.js](lib/agent/actions/alarm/index.js))
- Export `start(id, options, callback)` function
- Optional: export `stop(id)` function
- Optional: export `events` array for EventEmitter events
- Callback signature: `cb(err, emitter)`
- Emitter must emit `end` event: [lib/agent/actions.js:48](lib/agent/actions.js#L48)

**Providers Contract** ([lib/agent/providers/geo/index.js](lib/agent/providers/geo/index.js))
- Export functions prefixed with `get_` for auto-discovery
- Example: `exports.get_location = (cb) => { ... }`
- Callback signature: `cb(err, data)`

**Triggers Contract** (similar to actions)
- Export `start(options, callback)` function
- Return EventEmitter for lifecycle events
- See [lib/agent/triggers.js:112-123](lib/agent/triggers.js#L112-L123)

## Configuration Management

Dual-layer configuration: file-based defaults and SQLite runtime storage.

**ConfigFile Module** ([lib/utils/configfile.js](lib/utils/configfile.js))
- Dictionary mapping: [lib/utils/configfile.js:8-27](lib/utils/configfile.js#L8-L27)
- Config keys organized with dot notation (e.g., `control-panel.host`)
- Environment variable override support

**Storage Layer** ([lib/agent/utils/storage.js](lib/agent/utils/storage.js))
- SQLite3 for persistence: commands, responses, files, triggers, keys
- Schema definitions: [lib/agent/utils/storage.js:11-52](lib/agent/utils/storage.js#L11-L52)
- Queue-based operations for serialization: [lib/agent/utils/storage.js:71](lib/agent/utils/storage.js#L71)

## Transport Abstraction

Multiple communication methods with the control panel.

**Available Transports**
- WebSockets: [lib/agent/control-panel/websockets/index.js](lib/agent/control-panel/websockets/index.js)
- Long-Polling: [lib/agent/control-panel/long-polling/index.js](lib/agent/control-panel/long-polling/index.js)
- HTTP: [lib/agent/transports/http/](lib/agent/transports/http/)

**Common Interface**
- All transports integrate via hooks system
- Control panel setup: [lib/agent/control-panel/index.js:31-46](lib/agent/control-panel/index.js#L31-46)
- API abstraction: [lib/agent/control-panel/api/](lib/agent/control-panel/api/)

## Namespace Prefixing

Logger instances use prefix() for component identification.

**Pattern**
```javascript
const logger = common.logger.prefix('component-name');
```
- Examples throughout: [lib/agent/actions.js:4](lib/agent/actions.js#L4), [lib/agent/providers.js:6](lib/agent/providers.js#L6)
- Provides context in logs without additional parameters

## Strategy Pattern

Multiple strategies with fallback chains for resilient operations.

**Location Strategies** ([lib/agent/providers/geo/index.js:11-13](lib/agent/providers/geo/index.js#L11-L13))
- Available: `native`, `wifi`, `geoip`
- Fallback chain: [lib/agent/providers/geo/index.js:35-45](lib/agent/providers/geo/index.js#L35-L45)
- Default strategy configurable at runtime

## Common Module Pattern

Centralized common dependencies/utilities module.

**Common Module** ([lib/common.js](lib/common.js))
- Exports system, paths, config, logger, version info
- Re-exported throughout: `const common = require('./common')`
- Prevents circular dependency issues
- Single source of truth for shared resources
