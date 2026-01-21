# WebSocket Modular Refactoring Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the 737-line websockets/index.js into focused, testable modules while maintaining backward compatibility.

**Architecture:** Extract cohesive responsibilities into separate modules, keeping index.js as the public API facade that re-exports from internal modules.

**Tech Stack:** Node.js, ws library, existing test infrastructure (Mocha/Chai/Sinon)

---

## Proposed Module Structure

```
lib/agent/control-panel/websockets/
├── index.js              # Public API facade (re-exports)
├── connection.js         # WebSocket connection management
├── reconnection.js       # Reconnection logic with exponential backoff
├── heartbeat.js          # Ping/pong and heartbeat management
├── queues/
│   ├── index.js          # Queue exports
│   ├── response-queue.js # Response queue management
│   └── ack-queue.js      # ACK queue management
├── handlers.js           # Message and event handlers
├── notifications.js      # notify_status, notify_action
├── constants.js          # All magic numbers and config
└── utils.js              # Shared helpers
```

## Module Responsibilities

### 1. `constants.js` (~40 lines)
All magic numbers extracted with descriptive names:
```javascript
// Timeouts
exports.STARTUP_TIMEOUT = 5000;
exports.HEARTBEAT_TIMEOUT = 121000;
exports.PONG_WAIT_TIMEOUT = 15000;
exports.PING_INTERVAL = 60000;
exports.LOCATION_TIME_LIMIT = 7 * 60 * 1000;

// Reconnection
exports.BASE_RECONNECT_DELAY = 5000;
exports.MAX_RECONNECT_DELAY = 300000;

// Retries
exports.MAX_RETRIES = 10;
exports.MAX_ACK_RETRIES = 4;
exports.MAX_PROXY_FAILURES = 5;

// Intervals
exports.RETRY_QUEUE_INTERVAL = 5000;
exports.RETRY_ACK_INTERVAL = 4000;
exports.STATUS_INTERVAL = 5 * 60 * 1000;
exports.HEARTBEAT_CHECK_INTERVAL = 30000;
exports.COMMAND_DELAY = 7000;

// Error codes
exports.WS_ERROR_NO_CONNECTION = 1006;
```

### 2. `utils.js` (~30 lines)
Shared helper functions:
```javascript
// Replaces repeated: !ws || !ws.readyState || ws.readyState !== 1
exports.isConnectionReady = (ws) => ws && ws.readyState === 1;

// Logging helper
exports.propagateError = (hooks, logger, message) => {
  hooks.trigger('error', new Error(message));
  logger.debug(message);
};

// Delay helper (already exists, just move here)
exports.delay = (ms, cb) => setTimeout(cb, ms);
```

### 3. `reconnection.js` (~60 lines)
Exponential backoff and reconnection state:
```javascript
// State
let reconnectAttempts = 0;
let isReconnecting = false;

// Functions
exports.getReconnectDelay = () => { ... };
exports.resetReconnectDelay = () => { ... };
exports.isReconnecting = () => isReconnecting;
exports.setReconnecting = (value) => { isReconnecting = value; };
```

### 4. `heartbeat.js` (~50 lines)
Ping/pong management:
```javascript
let pingTimeout = null;
let pingInterval = null;
let pongReceived = false;

exports.startPingInterval = (ws, onFailure) => { ... };
exports.stopPingInterval = () => { ... };
exports.heartbeatTimed = (onTimeout) => { ... };
exports.setPongReceived = (value) => { ... };
exports.handlePong = (hooks, callbacks) => { ... };
exports.handlePing = (ws) => { ... };
```

### 5. `queues/response-queue.js` (~80 lines)
Response queue management:
```javascript
let responses_queue = [];
let markedToBePushed = [];

exports.getQueue = () => responses_queue;
exports.addToQueue = (response) => { ... };
exports.removeFromQueue = (id) => { ... };
exports.retryQueuedResponses = (notifyFn) => { ... };
exports.loadFromStorage = (storage, cb) => { ... };
```

### 6. `queues/ack-queue.js` (~70 lines)
ACK queue management:
```javascript
let responsesAck = [];

exports.getQueue = () => responsesAck;
exports.addAck = (ackData) => { ... };
exports.removeAck = (ackId) => { ... };
exports.processAcks = (arr, ackModule, logger) => { ... };
exports.notifyAck = (ackId, type, id, sent, retries, sendFn) => { ... };
exports.sendAckToServer = (ws, sendToWs, logger) => { ... };
exports.retryAckResponses = (notifyFn) => { ... };
```

### 7. `handlers.js` (~80 lines)
Message and command processing:
```javascript
// Rename from Spanish
exports.groupByStructure = (arrayOfObjects) => { ... };  // was: agruparPorEstructuraAnidada
exports.getStructureSignature = (obj) => { ... };        // was: obtenerFirmaEstructura

exports.processCommands = (arr, emitter, logger) => { ... };
exports.handleMessage = (data, queues, storage, logger) => { ... };
```

### 8. `notifications.js` (~120 lines)
Status and action notifications:
```javascript
exports.notifyStatus = (ws, status, logger) => { ... };
exports.notifyAction = (ws, storage, queue, params) => { ... };
```

### 9. `connection.js` (~150 lines)
WebSocket connection lifecycle:
```javascript
let ws = null;
let websocketConnected = false;

exports.create = (url, options, handlers) => { ... };
exports.terminate = () => { ... };
exports.isConnected = () => websocketConnected;
exports.getWebSocket = () => ws;
exports.send = (data) => { ... };
```

### 10. `index.js` (~150 lines)
Public API facade - orchestrates modules:
```javascript
const connection = require('./connection');
const reconnection = require('./reconnection');
const heartbeat = require('./heartbeat');
const responseQueue = require('./queues/response-queue');
const ackQueue = require('./queues/ack-queue');
const handlers = require('./handlers');
const notifications = require('./notifications');
const constants = require('./constants');
const utils = require('./utils');

// Re-export public API
exports.load = (cb) => { ... };
exports.unload = (cb) => { ... };
exports.notify_action = notifications.notifyAction;
exports.notify_status = notifications.notifyStatus;
exports.check_timestamp = () => { ... };
exports.lastConnection = () => { ... };

// For backward compatibility with tests
exports.re_schedule = true;
exports.responses_queue = responseQueue.getQueue();
exports.responsesAck = ackQueue.getQueue();
exports.isReconnecting = reconnection.isReconnecting();
exports.getReconnectDelay = reconnection.getReconnectDelay;
exports.resetReconnectDelay = reconnection.resetReconnectDelay;
```

---

## Tasks

### Task 1: Create constants.js
**Files:**
- Create: `lib/agent/control-panel/websockets/constants.js`

Extract all magic numbers from index.js into named constants.

### Task 2: Create utils.js
**Files:**
- Create: `lib/agent/control-panel/websockets/utils.js`

Create shared helper functions: `isConnectionReady`, `propagateError`, `delay`.

### Task 3: Create reconnection.js
**Files:**
- Create: `lib/agent/control-panel/websockets/reconnection.js`

Move reconnection logic: `getReconnectDelay`, `resetReconnectDelay`, `isReconnecting` state.

### Task 4: Create heartbeat.js
**Files:**
- Create: `lib/agent/control-panel/websockets/heartbeat.js`

Move ping/pong logic: `heartbeat`, `heartbeatTimed`, ping interval management.

### Task 5: Create queues directory and response-queue.js
**Files:**
- Create: `lib/agent/control-panel/websockets/queues/response-queue.js`
- Create: `lib/agent/control-panel/websockets/queues/index.js`

Move response queue management: `responses_queue`, `retryQueuedResponses`, related functions.

### Task 6: Create ack-queue.js
**Files:**
- Create: `lib/agent/control-panel/websockets/queues/ack-queue.js`

Move ACK queue management: `responsesAck`, `notifyAck`, `sendAckToServer`, `processAcks`.

### Task 7: Create handlers.js
**Files:**
- Create: `lib/agent/control-panel/websockets/handlers.js`

Move message handlers. Rename Spanish functions to English:
- `agruparPorEstructuraAnidada` → `groupByStructure`
- `obtenerFirmaEstructura` → `getStructureSignature`

### Task 8: Create notifications.js
**Files:**
- Create: `lib/agent/control-panel/websockets/notifications.js`

Move `notify_status` and `notify_action` functions.

### Task 9: Create connection.js
**Files:**
- Create: `lib/agent/control-panel/websockets/connection.js`

Move WebSocket connection management: create, terminate, event setup.

### Task 10: Refactor index.js as facade
**Files:**
- Modify: `lib/agent/control-panel/websockets/index.js`

Rewrite as orchestrator that imports from modules and re-exports public API.
Maintain backward compatibility for existing tests.

### Task 11: Update existing tests
**Files:**
- Modify: `test/lib/agent/control-panel/websockets/reconnection_test.js`

Ensure tests still pass with new module structure.

### Task 12: Run full test suite
Verify all 288 tests still pass.

---

## Backward Compatibility

The public API must remain identical:
- `exports.load(cb)`
- `exports.unload(cb)`
- `exports.notify_action(...)`
- `exports.notify_status(status)`
- `exports.check_timestamp()`
- `exports.lastConnection()`
- `exports.re_schedule`
- `exports.responses_queue`
- `exports.responsesAck`
- `exports.isReconnecting`
- `exports.getReconnectDelay()`
- `exports.resetReconnectDelay()`
- `exports.heartbeat()`
- `exports.heartbeatTimed()`
- `exports.sendAckToServer()`
- `exports.notifyAck()`

---

## Risk Mitigation

1. **Run tests after each task** - Catch regressions immediately
2. **Keep original file as backup** - Can revert if needed
3. **No logic changes** - Only reorganization
4. **Incremental commits** - Easy to bisect if issues arise

---

## Expected Outcome

| Before | After |
|--------|-------|
| 1 file, 737 lines | 10 files, ~60-150 lines each |
| ~30 global variables | State encapsulated per module |
| Magic numbers everywhere | Named constants |
| Spanish function names | English throughout |
| Hard to test | Each module independently testable |
