/* eslint-disable indent */
// eslint-disable-next-line import/no-extraneous-dependencies
const WebSocket = require('ws');
// eslint-disable-next-line import/no-extraneous-dependencies
const HttpsProxyAgent = require('https-proxy-agent');
// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('events');
const server = require('./server');
const keys = require('../api/keys');
const statusTrigger = require('../../triggers/status');
const network = require('../../providers/network');
const fileretrieval = require('../../actions/fileretrieval');
const triggers = require('../../actions/triggers');
const storage = require('../../utils/storage');
const errors = require('../api/errors');
const ack = require('../../ack');
const common = require('../../../common');
const config = require('../../../utils/configfile');

const logger = common.logger.prefix('websockets');
const maxCountNotConnectionProxy = 5;
const codeErrorNoConnectionWebSocket = 1006;

let hooks;
let gettingStatus = false;
let lastTime = null;
let lastConnection;
let lastStored;
let ws;
let pingTimeout;
let pingInterval;
let emitter;
let setAliveTimeInterval = null;
let timeOutCancelIntervalHearBeat = null;
let setIntervalWSStatus = null;
let notifyActionInterval = null;
let notifyAckInterval = null;
let getStatusInterval = null;
let workingWithProxy = true;
let countNotConnectionProxy = 0;
let pongReceived = false;
let timerSendLocation;
let lastLocationTime;
let reconnectAttempts = 0;
let reconnectTimerId = null;
const reconnectBaseDelay = 1000; // 1s
const reconnectMaxDelay = 30000; // 30s
let isReconnecting = false;

const startupTimeout = 5000;
const timeLimitForLocation = 7 * 60 * 1000;
const heartbeatTimeout = 120000 + 1000;
const retriesMax = 10;
const retriesMaxAck = 4;
const completionMaxWaitMs = 60 * 1000;
let markedToBePushed = [];
const messageQueue = {}; // Now organized by structure signature
let messageQueueStructureOrder = []; // Track order of structure signatures
let processingQueue = false;
let lastProcessedStructure = null; // Track last structure processed for round-robin
let currentlyProcessing = null; // Track current item being processed
let currentlyProcessingStructure = null; // Track structure of currently processing item

// Worker notifier and control
const workNotifier = new EventEmitter();
let workerRunning = false;
let backoffAttempts = 0;

// Track pending listeners for previous-item completion to avoid duplicate hooks.once registrations
const pendingCompletionListeners = new Set();

const hasQueuedMessages = () => messageQueueStructureOrder.some(
  (sig) => messageQueue[sig] && messageQueue[sig].length > 0,
);

// Wait for work: resolves immediately with metadata if queue has messages,
// otherwise resolves when 'work' is emitted with optional metadata.
const waitForWork = () => {
  if (hasQueuedMessages()) return Promise.resolve({ immediate: true });
  return new Promise((resolve) => {
    workNotifier.once('work', (meta) => resolve(meta || null));
  });
};

// startWorker and stopWorker are defined after `runOnce` to avoid linter 'used before defined'

exports.responses_queue = [];
exports.responsesAck = [];

const propagateError = (message) => {
  hooks.trigger('error', new Error(message));
  logger.debug(message);
};

const getStatusByInterval = () => {
  if (gettingStatus) return;
  gettingStatus = true;
  statusTrigger.get_status((err, status) => {
    gettingStatus = false;
    exports.notify_status(status);
  });
};

const groupByNestedStructure = (arrayOfObjects) => {
  const groups = {};

  const getStructureSignature = (obj) => {
    const allKeys = new Set(); // Use a Set to avoid duplicate keys and maintain uniqueness

    const collectKeys = (currentObj, prefix = '') => {
      // Get all keys of the current object
      const keysObj = Object.keys(currentObj);

      // Sort keys to ensure consistent order for the signature
      keysObj.sort((a, b) => a.localeCompare(b));

      keysObj.forEach((key) => {
        const fullKeyPath = prefix ? `${prefix}.${key}` : key;
        allKeys.add(fullKeyPath);

        // If the value is an object and not null or an array, recurse
        if (typeof currentObj[key] === 'object' && currentObj[key] !== null && !Array.isArray(currentObj[key])) {
          collectKeys(currentObj[key], fullKeyPath);
        }
      });
    };

    collectKeys(obj); // Start collecting keys from the root object

    // Convert the Set of keys to an array, sort it, and join to form the signature
    const sortedAllKeys = Array.from(allKeys).sort((a, b) => a.localeCompare(b));
    return sortedAllKeys.join('-');
  };

  arrayOfObjects.forEach((object) => {
    const signature = getStructureSignature(object);
    if (!groups[signature]) {
      groups[signature] = [];
    }
    groups[signature].push(object);
  });

  return groups;
};

const retryQueuedResponses = () => {
  if (exports.responses_queue.length === 0) return;
  markedToBePushed = [];
  exports.responses_queue.forEach((respQueued) => {
    exports.notify_action(
      respQueued.body.status,
      respQueued.reply_id,
      respQueued.body.target,
      respQueued.opts ? respQueued.opts : null,
      respQueued.error ? respQueued.error : null,
      respQueued.out ? respQueued.out : null,
      respQueued.time ? respQueued.time : null,
      respQueued.id ? respQueued.id : null,
      respQueued.retries ? respQueued.retries : null,
      true,
    );
  });
  exports.responses_queue = [...exports.responses_queue, ...markedToBePushed];
};

const retryAckResponses = () => {
  if (exports.responsesAck.length === 0) return;

  exports.responsesAck.forEach((respoAck) => {
    exports.notifyAck(
      respoAck.ack_id,
      respoAck.type,
      respoAck.id,
      respoAck.send,
      respoAck.retries,
    );
  });
};

const setValueRetriesToJsonInAckArray = (ackId) => {
  const index = exports.responsesAck.findIndex((x) => x.ack_id === ackId);
  if (index >= 0) {
    exports.responsesAck[index].retries += 1;
  }
};

const removeAckFromArray = (ackId) => {
  exports.responsesAck = exports.responsesAck.filter((x) => x.ack_id !== ackId);
};

exports.sendAckToServer = (sendToWs) => {
  try {
    if (!ws || !ws.readyState || ws.readyState !== 1) return;
    const toSend = { ack_id: sendToWs.ack_id, type: sendToWs.type };
    logger.info(`sendAckToServer: sending ack ack_id=${toSend.ack_id} type=${toSend.type}`);
    ws.send(JSON.stringify(toSend));
    removeAckFromArray(sendToWs.ack_id);
  } catch (error) {
    if (error && Object.keys(error).length > 0) logger.error('error to send ack:', JSON.stringify(error));
  }
};

exports.notifyAck = (ackId, type, id, sent, retries = 0) => {
  if (retries >= retriesMaxAck) {
    removeAckFromArray(ackId);
    return;
  }
  if (id && id !== '') {
      const ackResponse = exports.responsesAck.filter((x) => x.id === id
      && x.sent === false);
      if (ackResponse.length > 0) {
        ackResponse[0].retries += 1;
        exports.sendAckToServer(ackResponse[0]);
      }
  } else {
    const ackResponse = exports.responsesAck.filter((x) => x.ack_id === ackId
    && x.sent === false);
    if (ackResponse.length > 0) {
      setValueRetriesToJsonInAckArray(ackId);
      exports.sendAckToServer(ackResponse[0]);
    } else {
      setValueRetriesToJsonInAckArray(ackId);
    }
  }
};

const processAcks = (arr) => {
  if (arr.forEach) {
    arr.forEach((el) => {
      ack.processAck(el, (err, sendToWs) => {
        if (err) {
          logger.error(`Error processing ack: ${err.message}`);
          return;
        }
        try {
          exports.responsesAck.push({
            ack_id: sendToWs.ack_id,
            type: sendToWs.type,
            id: sendToWs.id,
            sent: false,
            retries: 0,
          });
        } catch (error) {
          logger.error(`Error pushing ack message to responsesAck: ${error}`);
        }
      });
    });
  }
};

const processCommands = (arr) => {
  if (arr.forEach) {
    arr.forEach((el) => {
      emitter.emit('command', el);
    });
  } else {
    propagateError('Invalid command object');
  }
};

/**
 * Async function to verify if the previous task has completed its processing.
 * This function should be implemented to include specific business logic.
 *
 * @param {Object} currentItem - The current item being processed
 * @param {Object} previousItem - The previous processed item (null if it's the first one)
 * @returns {Promise<boolean>} - true if the previous task completed and the next
 * one can be processed
 */
// NOTE: completion is signaled via hooks.once('command_processed_or_stored', id)

/**
 * Marks an item as being processed
 * @param {Object} item - The item being processed
 */
const markItemAsProcessing = (item) => {
  currentlyProcessing = item;
  // Capture structure: if array, use special marker; if object, extract signature
  currentlyProcessingStructure = Array.isArray(item) ? '__array__' : Object.keys(groupByNestedStructure([item]))[0];
};

/**
 * Marks an item as completed
 * @param {Object} item - The item that completed
 */
const markItemAsComplete = (item) => {
  if (currentlyProcessing === item) {
    currentlyProcessing = null;
    currentlyProcessingStructure = null;
  }
};

const processOneMessage = async () => {
  if (processingQueue) {
    logger.info('processOneMessage: already processing, skipping');
    return false;
  }

  // Get available structures
  const availableStructures = messageQueueStructureOrder.filter(
    (sig) => messageQueue[sig] && messageQueue[sig].length > 0,
  );
  if (availableStructures.length === 0) {
    logger.info('processOneMessage: no available structures to process');
    return false;
  }

  processingQueue = true;

  // Round-robin logic: pick the next structure that is NOT the last one processed
  let targetStructure;
  if (availableStructures.length === 1) {
    [targetStructure] = availableStructures;
  } else {
    const nextIndex = availableStructures.findIndex((sig) => sig !== lastProcessedStructure);
    targetStructure = nextIndex !== -1 ? availableStructures[nextIndex] : availableStructures[0];
  }

  lastProcessedStructure = targetStructure;
  logger.info(`processOneMessage: selected structure ${targetStructure}`);
  const item = messageQueue[targetStructure].shift();

  // Clean up empty structure
  if (!messageQueue[targetStructure] || messageQueue[targetStructure].length === 0) {
    delete messageQueue[targetStructure];
    messageQueueStructureOrder = messageQueueStructureOrder.filter((sig) => messageQueue[sig]);
  }

  try {
    // If there is a currently processing item, wait for its completion via hooks.once
    // BUT: only if it has the SAME structure. Different structures can be processed in parallel.
    const previous = currentlyProcessing;
    const previousStructure = currentlyProcessingStructure;
    const sameStructure = previousStructure === targetStructure;

    if (previous && previous.id && sameStructure) {
      const prevId = previous.id;
      logger.info(`processOneMessage: previous item ${prevId} has same structure (${targetStructure}), waiting for completion`);
      // register a one-time listener only once per prevId and set a timeout
      if (!pendingCompletionListeners.has(prevId)) {
        pendingCompletionListeners.add(prevId);

        let timer = null;
        // named handler so we can remove it if timeout fires
        const onCompleted = (idItem) => {
          try {
            if (timer) clearTimeout(timer);
            if (previous && previous.id === idItem) {
              markItemAsComplete(previous);
            }
          } finally {
            pendingCompletionListeners.delete(prevId);
            logger.info(`completion event received for ${prevId}`);
            // wake up worker to re-evaluate queued items
            workNotifier.emit('work', { reason: 'completion_event', id: prevId });
          }
        };

        try {
          hooks.once('command_processed_or_stored', onCompleted);
          logger.info(`registered hooks.once for completion of ${prevId}`);
        } catch (e) {
          // If hooks.once is not available for some reason, ensure we still set a timeout
          logger.debug(`hooks.once registration failed: ${e}`);
        }

        // set a timeout to avoid waiting forever; on timeout, clear listener and continue
        timer = setTimeout(() => {
          try {
            logger.info(`Timeout waiting ${completionMaxWaitMs}ms for completion of ${prevId}; continuing.`);
            // attempt to remove registered listener if API allows
            if (typeof hooks.removeListener === 'function') hooks.removeListener('command_processed_or_stored', onCompleted);
            else if (typeof hooks.off === 'function') hooks.off('command_processed_or_stored', onCompleted);
            else if (typeof hooks.remove === 'function') hooks.remove('command_processed_or_stored');

            // Mark previous as complete to avoid blocking further processing
            if (previous && previous.id === prevId) markItemAsComplete(previous);
          } finally {
            pendingCompletionListeners.delete(prevId);
            logger.info(`completion timeout for ${prevId}`);
            workNotifier.emit('work', { reason: 'completion_timeout', id: prevId });
          }
        }, completionMaxWaitMs);
      }

      // Requeue this item and let the worker wait for the hook to fire or timeout
      if (!messageQueue[targetStructure]) {
        messageQueue[targetStructure] = [];
        messageQueueStructureOrder.push(targetStructure);
      }
      messageQueue[targetStructure].unshift(item);
      logger.info(`processOneMessage: requeued item for structure ${targetStructure} because previous ${prevId} is processing`);
      processingQueue = false;
      return false;
    }

    // Mark this item as currently processing
    logger.info(`processOneMessage: marking item as processing id=${item && item.id ? item.id : '[array]'} structure=${targetStructure}`);
    markItemAsProcessing(item);

    // Log if we're processing in parallel (different structure from previous)
    if (previous && previous.id && !sameStructure) {
      logger.info(`processOneMessage: previous item ${previous.id} has different structure, processing in parallel`);
    }

    if (Array.isArray(item)) {
      processCommands(item);
    } else if (item.status && item.status === 'OK') {
      const value = exports.responses_queue.find((x) => x.id === item.id);
      if (value) {
        if (value.type === 'response') {
          storage.do('del', { type: 'responses', id: value.id });
        }
        exports.responses_queue = exports.responses_queue.filter((x) => x.id !== item.id);
      }
    } else {
      processCommands([item]);
    }

    // Note: markItemAsComplete is called via hooks.trigger('command_processed_or_stored', id)
    // DO NOT mark complete here - commands execute asynchronously
  } catch (err) {
    logger.error(`Error processing queued message: ${err}`);
    markItemAsComplete(item);
    processingQueue = false;
    return false;
  }

  processingQueue = false;
  return true;
};

// runOnce processes a single item and re-schedules itself. Declared as function
// declaration so it's hoisted and startWorker can call it earlier.
async function runOnce() {
  if (!workerRunning) return;
  logger.info('runOnce: waiting for work');
  // Wait until there's work (returns immediately if already queued)
  const meta = await waitForWork();
  logger.info(`runOnce: woke with meta ${meta ? JSON.stringify(meta) : 'null'}`);
  // If metadata requests resetting backoff, do it
  if (meta && (meta.resetBackoff || meta.forceImmediate)) backoffAttempts = 0;
  if (!workerRunning) return;

  // Process a single message
  try {
    const processed = await processOneMessage();
    if (!workerRunning) return;
    if (processed) {
      logger.info('runOnce: processed one item, continuing immediately');
      // If processed, schedule next run immediately to keep consuming
      backoffAttempts = 0;
      setImmediate(runOnce);
    } else {
      logger.info('runOnce: no progress, backing off');
      // Exponential backoff if no progress. compute backoff based on attempts.
      backoffAttempts += 1;
      const base = 500; // ms
      const jitter = Math.floor(Math.random() * 500);
      const maxBackoff = 30000;
      const delay = Math.min(base * (2 ** (backoffAttempts - 1)) + jitter, maxBackoff);
      logger.info(`runOnce: scheduling retry in ${delay}ms (attempt ${backoffAttempts})`);
      setTimeout(runOnce, delay);
    }
  } catch (e) {
    logger.error(`runOnce error: ${e?.message ?? e}`);
    // Small retry after error
    setTimeout(runOnce, 500);
  }
}

// start/stop worker (defined after runOnce to avoid linter warnings)
const startWorker = () => {
  if (workerRunning) return;
  workerRunning = true;
  logger.info('startWorker: worker started');
  setImmediate(runOnce);
};

const stopWorker = () => {
  workerRunning = false;
  logger.info('stopWorker: worker stopped');
  workNotifier.emit('work');
};

const clearAndResetIntervals = (aliveTimeReset = false) => {
  if (timeOutCancelIntervalHearBeat) clearTimeout(timeOutCancelIntervalHearBeat);
  if (notifyAckInterval) clearInterval(notifyAckInterval);
  if (notifyActionInterval) clearInterval(notifyActionInterval);
  if (getStatusInterval) clearInterval(getStatusInterval);
  if (setIntervalWSStatus) clearInterval(setIntervalWSStatus);
  if (pingTimeout) clearInterval(pingTimeout);
  if (pingInterval) clearInterval(pingInterval);
  if (setAliveTimeInterval && aliveTimeReset) clearInterval(setAliveTimeInterval);
};

const validationConnectionsProxy = () => {
  if (config.getData('try_proxy')) {
    if (countNotConnectionProxy >= maxCountNotConnectionProxy) {
      logger.info('connecting without proxy');
      workingWithProxy = !workingWithProxy;
      countNotConnectionProxy = 0;
    }
  }
};

const computeReconnectDelay = () => {
  const jitter = Math.floor(Math.random() * 1000);
  const delay = Math.min(reconnectBaseDelay * (2 ** reconnectAttempts) + jitter, reconnectMaxDelay);
  return delay;
};

const scheduleReconnect = (reason, immediate = false) => {
  if (!exports.re_schedule) return;
  if (isReconnecting) return;
  isReconnecting = true;
  reconnectAttempts += 1;
  clearAndResetIntervals();
  validationConnectionsProxy();
  if (ws) {
    try {
      ws.removeAllListeners();
      ws.terminate();
    } catch (e) {
      logger.info(`Error terminating ws during reconnect: ${e.message}`);
    }
    ws = null;
  }
  if (reconnectTimerId) clearTimeout(reconnectTimerId);
  const delay = immediate ? 0 : computeReconnectDelay();
  logger.info(`Scheduling websocket reconnect in ${delay}ms${reason ? ` (${reason})` : ''}`);
  reconnectTimerId = setTimeout(() => {
    isReconnecting = false;
    exports.startWebsocket();
  }, delay);
};

const restartWebsocketCall = () => {
  // legacy wrapper kept for compatibility — schedule reconnect with backoff
  scheduleReconnect();
};

exports.heartbeat = () => {
  if (!ws || !ws.readyState || ws.readyState !== 1) {
    hooks.trigger('device_unseen');
    validationConnectionsProxy();
    restartWebsocketCall();
  }
};

exports.heartbeatTimed = () => {
  if (pingTimeout) clearTimeout(pingTimeout);
  pingTimeout = setTimeout(() => {
    restartWebsocketCall();
  }, heartbeatTimeout);
};
const updateStoredConnection = (newStoredTime) => {
  storage.do('update', {
    type: 'keys', id: 'last_connection', columns: 'value', values: newStoredTime,
  }, (err) => {
    if (err) logger.info('Unable to update the local last connection value');
  });
};
const updateTimestamp = () => {
  lastTime = Date.now();
};
exports.lastConnection = () => lastConnection;

const setLastConnection = () => {
  storage.do('query', { type: 'keys', column: 'id', data: 'last_connection' }, (err, stored) => {
    if (err) logger.error('Error getting the last connection data');
    if (stored && stored.length > 0) {
      // eslint-disable-next-line prefer-destructuring
      lastStored = parseInt(stored[0].value, 10);
      lastConnection = parseInt(lastStored, 10);
    } else {
      // Just the first time the client starts
      lastConnection = Math.round(Date.now() / 1000);
      storage.do('set', { type: 'keys', id: 'last_connection', data: { value: lastConnection } }, (errSet) => {
        if (errSet) logger.error('Error storing the last connection time');
        logger.info('Stored referential first connection time');
      });
    }
  });
};

const loadHooks = () => {
  setLastConnection();
  triggers.start();
  setTimeout(() => {
    hooks.trigger('device_unseen');
  }, 15000);
  hooks.on('connected', () => {
    fileretrieval.check_pending_files();
  });
};

const loadServer = () => {
  setTimeout(() => {
    server.create_server((err) => {
      if (err) logger.debug(err.message);
      setAliveTimeInterval = setInterval(updateTimestamp, startupTimeout);
    });
  }, startupTimeout);
};

const queryTriggers = () => {
  storage.do(
    'all',
    { type: 'triggers' },
    (err, stored) => {
      if (err || !stored) return;
      if (stored && stored.length > 0) {
        // eslint-disable-next-line max-len
        const storedFiltered = stored.filter((storedElement) => !!(storedElement.automation_events && JSON.parse(storedElement.automation_events).filter(
              (event) => event.type.localeCompare('device_unseen') === 0
              && typeof event.type === 'string',
              ).length > 0));

        const lookup = {};
        triggers.currentTriggers.forEach((element) => {
          lookup[element.id] = element;
        });
        storedFiltered.forEach((current) => {
          if (lookup[current.id]) {
            lookup[current.id].last_exec = null;
          }
          storage.do(
            'update',
            {
              type: 'triggers',
              id: current.id,
              columns: 'last_exec',
              values: null,
            },
            (errUpdate) => {
              if (errUpdate) logger.error(`Unable to update the execution time of the trigger: ${errUpdate}`);
            },
          );
        });
      }
    },
  );
};

const webSocketSettings = () => {
  notifyActionInterval = setInterval(retryQueuedResponses, 5000); // <-review the time
  notifyAckInterval = setInterval(retryAckResponses, 4 * 1000);
  getStatusInterval = setInterval(getStatusByInterval, 5 * 60 * 1000);
  timeOutCancelIntervalHearBeat = setTimeout(() => {
    setIntervalWSStatus = setInterval(exports.heartbeat, 30 * 1000);
  }, 90 * 1000);
  const proxy = config.getData('try_proxy');
  let protocol = config.getData('control-panel.protocol');
  const host = config.getData('control-panel.host');
  const deviceKey = keys.get().device;
  const apiKey = keys.get().api;

  protocol = protocol === 'https' ? 'wss' : 'ws';

  if (!keys.get().device) {
    propagateError(errors.get('NO_DEVICE_KEY'));
    exports.unload();
  }
  const url = `${host}/api/v2/devices/${deviceKey}.ws`;
  const str = [apiKey, 'x'].join(':');
  const Authorization = `Basic ${Buffer.from(str).toString('base64')}`;

  const options = {
    headers: {
      Authorization,
      'User-Agent': common.system.user_agent,
      'Content-Type': 'application/json',
    },
  };

  if (proxy && workingWithProxy) {
    const agent = new HttpsProxyAgent(proxy);
    options.agent = agent;
    logger.info('Setting up proxy');
  }
  gettingStatus = true;
  if (!(!ws || !ws.readyState || ws.readyState !== 1)) ws.terminate();
  statusTrigger.get_status((_err, status) => {
    gettingStatus = false;
    // Create websocket
    ws = new WebSocket(`${protocol}://${url}`, options);
    ws.on('open', () => {
      logger.info('ws.open: connection established');
      // successful connect: reset reconnect attempts
      reconnectAttempts = 0;
      if (reconnectTimerId) {
        clearTimeout(reconnectTimerId);
        reconnectTimerId = null;
      }
      clearInterval(setIntervalWSStatus);

      // ping/pong setup
      const pingIntervalMs = 60000;
      const pongWaitMs = 5000;

      const sendPing = () => {
        if (!ws || !ws.readyState || ws.readyState !== 1) return;
        pongReceived = false;
        try {
          logger.info('sendPing: sending ping');
          ws.ping();
          if (pingTimeout) clearTimeout(pingTimeout);
          pingTimeout = setTimeout(() => {
            if (!pongReceived) {
              logger.info('Pong not received in time, scheduling reconnect');
              scheduleReconnect('pong_timeout', false);
            }
          }, pongWaitMs);
        } catch (errorPing) {
          logger.error(`Error sending ping: ${errorPing}`);
          scheduleReconnect('ping_error', false);
        }
      };

      // start periodic pinging
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = setInterval(sendPing, pingIntervalMs);
      // send one immediately on open
      sendPing();

      exports.notify_status(status);

      // Initialize message processing (will be triggered on incoming messages)
      if (messageQueueStructureOrder.length > 0) {
        workNotifier.emit('work', {
          reason: 'startup',
          ts: Date.now(),
          forceImmediate: true,
          resetBackoff: true,
        });
      }

      storage.do('all', { type: 'responses' }, (errs, actions) => {
        if (!actions || typeof actions === 'undefined') return;

        if (actions.length === 0 || errs) return;

        if (Array.isArray(actions)) {
          exports.responses_queue = actions.map((element) => ({
            reply_id: `${element.action_id}`,
            type: 'response',
            out: element.out,
            error: element.error,
            opts: element.opts,
            body: { command: element.status, target: element.action, status: element.status },
            id: element.id,
            time: element.time,
            retries: element.retries,
          }));
        } else {
          exports.responses_queue.push({
            reply_id: `${actions.action_id}`,
            type: 'response',
            out: actions.out,
            error: actions.error,
            opts: actions.opts,
            body: { command: actions.status, target: actions.action, status: actions.status },
            id: actions.id,
            time: actions.time,
            retries: actions.retries,
          });
        }
      });
      if (timerSendLocation) clearTimeout(timerSendLocation);
      if (config.getData('control-panel.send_location_on_connect').toString().toLowerCase().localeCompare('true') === 0) {
        timerSendLocation = setTimeout(() => {
          if (!lastLocationTime || (Date.now() - lastLocationTime > timeLimitForLocation)) {
            lastLocationTime = Date.now();
            hooks.trigger('get_location', 'single');
            logger.info('Sending location single');
          }
        }, 1000 * 10);
      }
    });

    ws.on('close', (code) => {
      logger.info(`ws.close: code=${code}`);
      if (code === codeErrorNoConnectionWebSocket && proxy) {
        countNotConnectionProxy += 1;
      }
      if (timerSendLocation) clearTimeout(timerSendLocation);
      scheduleReconnect(`close_${code}`, false);
    });

    ws.on('message', (data) => {
      let parsedData;
      try {
        parsedData = JSON.parse(data);
        if (Object.keys(parsedData).length) logger.info(`message received from backend: ${JSON.stringify(parsedData)}`);
      } catch (e) {
        return propagateError('Invalid command object');
      }
      logger.info('ws.on.message: enqueuing parsedData');
      // Enqueue the message grouped by structure
      try {
        if (Array.isArray(parsedData)) {
          processAcks(parsedData);
          // Handle array of messages: group them by structure
          const grouped = groupByNestedStructure(parsedData);
          Object.keys(grouped).forEach((signature) => {
            if (!messageQueue[signature]) {
              messageQueue[signature] = [];
              messageQueueStructureOrder.push(signature);
            }
            messageQueue[signature].push(...grouped[signature]);
          });
        } else {
          // Handle single message
          const groupedSingle = groupByNestedStructure([parsedData]);
          const signature = Object.keys(groupedSingle)[0];
          if (!messageQueue[signature]) {
            messageQueue[signature] = [];
            messageQueueStructureOrder.push(signature);
          }
          messageQueue[signature].push(parsedData);
        }
        // Notify worker that there is work
        logger.info('ws.on.message: notifying worker about new work');
        workNotifier.emit('work');
        logger.info('ws.on.message: worker notified');
      } catch (e) {
        logger.error(`Error enqueuing message: ${e}`);
      }

      return 0;
    });

    ws.on('error', (eError) => {
      logger.info(`websockets error: ${eError && eError.message ? eError.message : eError}`);
      // Errors often are followed by close; make sure we attempt reconnect if socket is unusable
      if (!ws || !ws.readyState || ws.readyState !== 1) scheduleReconnect('error', false);
    });

    ws.on('pong', () => {
      logger.info('ws.on.pong: received pong');
      // received pong, consider connection healthy
      if (pingTimeout) {
        clearTimeout(pingTimeout);
        pingTimeout = null;
      }
      queryTriggers();
      hooks.trigger('device_unseen');
      pongReceived = true;
      const lastLastConnection = lastConnection;
      const newLastConnection = Math.round(Date.now() / 1000);
      network.get_connection_status((statusConnection) => {
        const diffInMinutes = ((new Date(newLastConnection * 1000)).getTime()
        - (new Date(lastLastConnection * 1000)).getTime()) / 1000 / 60;
        if (typeof statusConnection === 'string' && statusConnection.localeCompare('connected') === 0
        && diffInMinutes >= 30) hooks.trigger('disconnected');
      });
      lastConnection = newLastConnection;
      updateStoredConnection(lastConnection);
    });

    ws.on('ping', () => {
      logger.info('ws.on.ping: received ping, replying pong');
      exports.heartbeatTimed();
      if (!ws || !ws.readyState || ws.readyState !== 1) return;
      ws.pong();
    });
  }, 'websocket');
};

exports.startWebsocket = () => {
  clearAndResetIntervals();
  webSocketSettings();
};

exports.notify_action = (
  status,
  id,
  action,
  opts,
  err,
  out,
  time,
  respId,
  retries = 0,
  fromWithin = false,
) => {
  if (!id || id === 'report' || action === 'triggers' || (action === 'factoryreset' && status === 'stopped')) return;
  if (retries >= retriesMax) {
    storage.do('del', { type: 'responses', id: respId });
    exports.responses_queue = exports.responses_queue.filter((x) => x.id !== respId);
    return;
  }
  // eslint-disable-next-line prefer-const
  let toSend = {
    reply_id: `${id}`,
    type: 'response',
    body: { command: status, target: action, status },
    retries: retries + 1,
  };
  logger.info(`notify_action: prepared response for action=${action} reply_id=${id} status=${status}`);
  toSend.time = time || new Date().toISOString();
  if (toSend.time === 'NULL') toSend.time = new Date().toISOString();
  toSend.id = (respId && typeof respId !== 'undefined' && respId !== 'undefined') ? respId : uuidv4();
  ///
  if (out) {
    if (action === 'diskencryption') toSend.body.reason = { encryption: out };
    else if (action === 'factoryreset') toSend.body.reason = { status_code: out.data, status_msg: out.message };
    else if (action === 'fullwipe') toSend.body.reason = { status_code: out.data, status_msg: out.message };
  }
  if (err) {
    if (action === 'factoryreset') {
      toSend.body.reason = {
        status_code: (err.code) ? err.code : 1,
        status_msg: err.message,
      };
      toSend.body.status = 'stopped';
    } else if (action === 'diskencryption') {
      toSend.body.reason = { encryption: err };
    } else toSend.body.reason = err.message;
  }
  if (action === 'fullwipe' || action === 'fullwipewindows') {
    if (err) {
      toSend.body = {
        command: toSend.body.command,
        status: 'stopped',
        reason: {
          status_code: (err.code) ? err.code : 1,
          status_msg: err.message,
        },
      };
    }
    if (opts) toSend.body.target = opts.target;
  }
  ///
  const queuedResponse = exports.responses_queue.filter((queue) => queue.id === toSend.id)[0];
  if (!queuedResponse) {
    let optsTarget = opts ? opts.target : null;
    optsTarget = optsTarget || null;
    storage.do('set', {
      type: 'responses',
      id: toSend.id,
      data: {
        status: toSend.body.status,
        error: err ? JSON.stringify(err) : null,
        reason: toSend.body.reason ? JSON.stringify(toSend.body.reason) : null,
        out: out ? JSON.stringify(out) : null,
        opts: optsTarget,
        action,
        time: toSend.time,
        retries: toSend.retries,
        action_id: toSend.reply_id,
      },
    }, (errSet) => {
      if (errSet && Object.keys(errSet).length > 0) logger.error(`Error storing the response: ${errSet}`);
    });
    if (fromWithin) markedToBePushed.push(toSend);
    else exports.responses_queue.push(toSend);
  } else {
    storage.do('update', {
      type: 'responses',
      id: toSend.id,
      columns: ['retries'],
      values: [toSend.retries + 1],
    }, (errUpdate) => {
      if (errUpdate && Object.keys(errUpdate).length > 0) logger.error(`Error updating the response: ${errUpdate}`);
    });
    queuedResponse.retries = toSend.retries + 1;
  }
  if (!ws || !ws.readyState || ws.readyState !== 1) return;
  try {
    ws.send(JSON.stringify(toSend));
  } catch (ex) {
    logger.error(`error at notify_action: ${ex}`);
  }
};

exports.check_timestamp = () => {
  if (!lastTime || (Date.now() - lastTime > 1000 * 60 * 5)) return false;
  return true;
};

exports.notify_status = (status) => {
  const data = {
    id: uuidv4(), // create id
    type: 'device_status',
    time: new Date().toISOString(),
    body: status,
  };
  if (!ws || !ws.readyState || ws.readyState !== 1) return;
  logger.info("Sending device's status information");
  try {
    ws.send(JSON.stringify(data));
  } catch (ex) {
    logger.error(`error at notify_status: ${ex}`);
  }
};

exports.load = (cb) => {
  logger.info('exports.load: initializing websocket module');
  // eslint-disable-next-line global-require
  hooks = require('../../hooks');
  loadServer();
  loadHooks();
  exports.startWebsocket();
  if (emitter) {
    startWorker();
    return cb(null, emitter);
  }
  emitter = new EventEmitter();
  startWorker();
  return cb(null, emitter);
};

exports.unload = (cb) => {
  logger.info('exports.unload: shutting down websocket module');
  clearAndResetIntervals(true);
  exports.re_schedule = false;
  if (ws) ws.terminate();
  clearTimeout(pingTimeout);
  hooks.remove('connected');
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
  // stop background worker
  stopWorker();
  return cb();
};
