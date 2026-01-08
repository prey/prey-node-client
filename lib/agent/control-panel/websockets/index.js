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
let reconnectTimerId = null;
let isReconnecting = false;

const startupTimeout = 5000;
const timeLimitForLocation = 7 * 60 * 1000;
const heartbeatTimeout = 120000 + 1000;
const retriesMax = 10;
const retriesMaxAck = 4;
const completionMaxWaitMs = 60 * 1000;
let markedToBePushed = [];
// Simple message queue - just an array
const messageQueue = [];
let isProcessingMessage = false;
let processorIntervalId = null;
const MESSAGE_PROCESS_DELAY = 1000; // 1 second between messages
// Track structures currently being processed (to avoid parallel execution of same structure)
const processingStructures = new Set();
// Map to track command IDs to their structures for cleanup
const commandIdToStructure = new Map();
// Map to track timeouts for each structure (safety mechanism)
const structureTimeouts = new Map();

exports.responses_queue = [];
exports.responsesAck = [];

const propagateError = (message) => {
  if (hooks && typeof hooks.trigger === 'function') {
    hooks.trigger('error', new Error(message));
  }
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

// Get structure signature to group similar actions
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

// Simple message processor - runs on interval
const processNextMessage = () => {
  // Don't process if already processing
  if (isProcessingMessage) {
    logger.debug('processNextMessage: already processing, skipping');
    return;
  }

  // Check if queue has messages
  if (messageQueue.length === 0) {
    return;
  }

  // Find first message whose structure is NOT currently being processed
  let messageIndex = -1;
  let itemToProcess = null;
  let itemStructure = null;

  for (let i = 0; i < messageQueue.length; i += 1) {
    const item = messageQueue[i];

    // Calculate structure signature
    let signature;
    if (Array.isArray(item)) {
      // For arrays, use first element's structure (arrays should be decomposed anyway)
      signature = item.length > 0 ? getStructureSignature(item[0]) : '__array__';
    } else if (item.status && item.status === 'OK') {
      // OK messages have their own structure
      signature = '__ok_response__';
    } else {
      signature = getStructureSignature(item);
    }

    // Check if this structure is already being processed
    if (!processingStructures.has(signature)) {
      messageIndex = i;
      itemToProcess = item;
      itemStructure = signature;
      break;
    } else {
      logger.debug(`Skipping message with structure ${signature} (already processing)`);
    }
  }

  // If no processable message found, wait for next interval
  if (messageIndex === -1) {
    logger.debug('No processable messages found (all structures busy)');
    return;
  }

  // Remove item from queue
  messageQueue.splice(messageIndex, 1);

  // Mark structure as being processed
  processingStructures.add(itemStructure);
  isProcessingMessage = true;

  logger.info(`Processing message with structure: ${itemStructure}. Remaining in queue: ${messageQueue.length}`);

  try {
    if (Array.isArray(itemToProcess)) {
      // Array of commands (shouldn't happen but handle it)
      logger.debug(`Processing array with ${itemToProcess.length} commands`);
      itemToProcess.forEach((cmd) => {
        emitter.emit('command', cmd);
      });
      // For arrays, remove structure immediately as we can't track completion
      processingStructures.delete(itemStructure);
    } else if (itemToProcess.status && itemToProcess.status === 'OK') {
      // OK response - process and remove structure immediately
      const value = exports.responses_queue.find((x) => x.id === itemToProcess.id);
      if (value) {
        if (value.type === 'response') {
          storage.do('del', { type: 'responses', id: value.id });
        }
        exports.responses_queue = exports.responses_queue.filter((x) => x.id !== itemToProcess.id);
      }
      processingStructures.delete(itemStructure);
    } else {
      // Single command - track its ID for cleanup when it completes
      const commandId = itemToProcess.id || itemToProcess.body?.id || `no-id-${Date.now()}`;

      if (commandId && !commandId.startsWith('no-id-')) {
        // Map command ID to structure for later cleanup
        commandIdToStructure.set(commandId, itemStructure);
        logger.debug(`Emitting command ${commandId} with structure ${itemStructure}`);

        // Set timeout to release structure if command never completes
        const timeoutId = setTimeout(() => {
          logger.warn(`Timeout: Command ${commandId} did not complete in ${completionMaxWaitMs}ms, releasing structure ${itemStructure}`);
          processingStructures.delete(itemStructure);
          commandIdToStructure.delete(commandId);
          structureTimeouts.delete(itemStructure);
        }, completionMaxWaitMs);

        structureTimeouts.set(itemStructure, timeoutId);
      } else {
        // No ID, remove structure after a delay
        logger.warn('Command has no ID, will remove structure after delay');
        const timeoutId = setTimeout(() => {
          processingStructures.delete(itemStructure);
          structureTimeouts.delete(itemStructure);
        }, 5000);
        structureTimeouts.set(itemStructure, timeoutId);
      }

      emitter.emit('command', itemToProcess);
    }
  } catch (err) {
    logger.error(`Error processing message: ${err}`);
    // On error, remove structure to unblock queue
    processingStructures.delete(itemStructure);
  } finally {
    // Mark as done after delay to allow next message
    setTimeout(() => {
      isProcessingMessage = false;
    }, MESSAGE_PROCESS_DELAY);
  }
};

const commandProcessedStoredFn = (commandId) => {
    if (commandIdToStructure.has(commandId)) {
      const structure = commandIdToStructure.get(commandId);
      logger.debug(`Command ${commandId} completed, releasing structure: ${structure}`);

      // Clear the timeout since command completed successfully
      if (structureTimeouts.has(structure)) {
        clearTimeout(structureTimeouts.get(structure));
        structureTimeouts.delete(structure);
      }

      processingStructures.delete(structure);
      commandIdToStructure.delete(commandId);
    }
};

// Start the message processor
const startMessageProcessor = () => {
  if (processorIntervalId) {
    logger.debug('Message processor already running');
    return;
  }
  logger.debug('Starting message processor');

  // Listen to command completion events to unblock structures
  if (hooks) {
    hooks.on('command_processed_or_stored', commandProcessedStoredFn);
  }

  processorIntervalId = setInterval(processNextMessage, MESSAGE_PROCESS_DELAY);
};

// Stop the message processor
const stopMessageProcessor = () => {
  if (processorIntervalId) {
    logger.debug('Stopping message processor');
    clearInterval(processorIntervalId);
    processorIntervalId = null;
  }

  // Clean up event listener
  if (hooks && typeof hooks.removeListener === 'function') {
    hooks.removeListener('command_processed_or_stored', commandProcessedStoredFn);
  }

  // Clear all pending timeouts
  structureTimeouts.forEach((timeoutId) => {
    clearTimeout(timeoutId);
  });

  isProcessingMessage = false;
  processingStructures.clear();
  commandIdToStructure.clear();
  structureTimeouts.clear();
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
    logger.debug(`sendAckToServer: sending ack ack_id=${toSend.ack_id} type=${toSend.type}`);
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
  const jitter = Math.floor(Math.random() * 4000);
  return jitter;
};

const scheduleReconnect = (reason, immediate = false) => {
  logger.info(`trying to reconnect with ${reason} and immediate=${immediate}`);
  if (isReconnecting) return;
  isReconnecting = true;
  clearAndResetIntervals();
  validationConnectionsProxy();

  // Stop message processor to prevent processing messages while disconnected
  stopMessageProcessor();

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
  logger.debug(`Scheduling websocket reconnect in ${delay}ms${reason ? ` (${reason})` : ''}`);
  reconnectTimerId = setTimeout(() => {
    isReconnecting = false;
    exports.startWebsocket();
  }, delay);

  // Safety timeout: reset isReconnecting after max delay + buffer
  setTimeout(() => {
    if (isReconnecting) {
      logger.warn('isReconnecting stuck true, resetting');
      isReconnecting = false;
    }
  }, 5000);
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

/**
 * Handles incoming WebSocket messages
 * Exported for testing purposes
 * @param {string|Buffer} data - Raw message data from WebSocket
 * @returns {number} 0 on success
 */
exports.handleWebSocketMessage = (data) => {
  let parsedData;
  try {
    parsedData = JSON.parse(data);
    if (Object.keys(parsedData).length) logger.info(`message received from backend: ${JSON.stringify(parsedData)}`);
  } catch (e) {
    return propagateError('Invalid command object');
  }

  // Simply enqueue - processing happens separately with delay
  try {
    if (Array.isArray(parsedData)) {
      processAcks(parsedData);
      // Decompose array into individual messages
      parsedData.forEach((msg) => {
        messageQueue.push(msg);
      });
      logger.debug(`Enqueued ${parsedData.length} messages. Queue size: ${messageQueue.length}`);
    } else {
      // Single message
      messageQueue.push(parsedData);
      logger.debug(`Enqueued 1 message. Queue size: ${messageQueue.length}`);
    }
  } catch (e) {
    logger.error(`Error enqueuing message: ${e}`);
  }

  return 0;
};

const webSocketSettings = () => {
  notifyActionInterval = setInterval(retryQueuedResponses, 5000); // <-review the time
  notifyAckInterval = setInterval(retryAckResponses, 4 * 1000);
  getStatusInterval = setInterval(getStatusByInterval, 5 * 60 * 1000);
  timeOutCancelIntervalHearBeat = setTimeout(() => {
    setIntervalWSStatus = setInterval(exports.heartbeat, 10 * 1000);
  }, 60 * 1000);
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
  if (!(!ws || !ws.readyState || ws.readyState !== 1)) {
    ws.terminate();
  }
  statusTrigger.get_status((_err, status) => {
    gettingStatus = false;
    // Create websocket
    ws = new WebSocket(`${protocol}://${url}`, options);
    ws.on('open', () => {
      logger.debug('ws.open: connection established');
      // successful connect: reset reconnect attempts
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
          logger.debug('sendPing: sending ping');
          ws.ping();
          if (pingTimeout) clearTimeout(pingTimeout);
          pingTimeout = setTimeout(() => {
            if (!pongReceived) {
              logger.debug('Pong not received in time, scheduling reconnect');
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

      // Start message processor with delay between messages
      startMessageProcessor();

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
            logger.debug('Sending location single');
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
      exports.handleWebSocketMessage(data);
    });

    ws.on('error', (eError) => {
      logger.debug(`websockets error: ${eError && eError.message ? eError.message : eError}`);
      // Errors often are followed by close; make sure we attempt reconnect if socket is unusable
      if (!ws || !ws.readyState || ws.readyState !== 1) scheduleReconnect('error', false);
    });

    ws.on('pong', () => {
      logger.debug('ws.on.pong: received pong');
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
      logger.debug('ws.on.ping: received ping, replying pong');
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
  logger.debug(`notify_action: prepared response for action=${action} reply_id=${id} status=${status}`);
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
  logger.debug('exports.load: initializing websocket module');
  // eslint-disable-next-line global-require
  hooks = require('../../hooks');
  if (!emitter) {
    emitter = new EventEmitter();
  }
  loadServer();
  loadHooks();
  // Note: Worker will be started when WebSocket connection is established
  exports.startWebsocket();
  return cb(null, emitter);
};

exports.unload = (cb) => {
  logger.debug('exports.unload: shutting down websocket module');
  clearAndResetIntervals(true);
  if (ws) ws.terminate();
  clearTimeout(pingTimeout);
  hooks.remove('connected');
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
  // stop message processor
  stopMessageProcessor();
  return cb();
};
