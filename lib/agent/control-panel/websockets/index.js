/**
 * WebSocket Module - Public API Facade
 * Orchestrates all WebSocket submodules and maintains backward compatibility.
 */

/* eslint-disable indent */
const { EventEmitter } = require('events');

// Internal modules
const constants = require('./constants');
const utils = require('./utils');
const reconnection = require('./reconnection');
const heartbeat = require('./heartbeat');
const connection = require('./connection');
const handlers = require('./handlers');
const notifications = require('./notifications');
const { responseQueue, ackQueue } = require('./queues');
const commandQueue = require('./command-queue');

// External dependencies
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

// State
let hooks;
let gettingStatus = false;
let statusData = null;
let lastTime = null;
let lastConnection;
let lastStored;
let emitter;
let setAliveTimeInterval = null;
let timeOutCancelIntervalHearBeat = null;
let setIntervalWSStatus = null;
let notifyActionInterval = null;
let notifyAckInterval = null;
let getStatusInterval = null;
let idTimeoutToCancel;
let timerSendLocation;
let lastLocationTime;

// Public exports for backward compatibility
exports.re_schedule = true;
exports.responses_queue = responseQueue.getQueue();
exports.responsesAck = ackQueue.getQueue();
exports.isReconnecting = false;

// Re-export reconnection functions
exports.getReconnectDelay = reconnection.getReconnectDelay;
exports.resetReconnectDelay = reconnection.resetReconnectDelay;

/**
 * Get status by interval (prevents concurrent calls).
 */
const getStatusByInterval = () => {
  if (gettingStatus) return;
  gettingStatus = true;
  statusTrigger.get_status((err, status) => {
    gettingStatus = false;
    exports.notify_status(status);
  });
};

/**
 * Clear and reset all intervals.
 * @param {boolean} aliveTimeReset - Whether to also clear alive time interval
 */
const clearAndResetIntervals = (aliveTimeReset = false) => {
  if (timeOutCancelIntervalHearBeat) clearTimeout(timeOutCancelIntervalHearBeat);
  if (notifyAckInterval) clearInterval(notifyAckInterval);
  if (notifyActionInterval) clearInterval(notifyActionInterval);
  if (getStatusInterval) clearInterval(getStatusInterval);
  if (setIntervalWSStatus) clearInterval(setIntervalWSStatus);
  heartbeat.clearAll();
  if (setAliveTimeInterval && aliveTimeReset) clearInterval(setAliveTimeInterval);
};

/**
 * Restart WebSocket connection with exponential backoff.
 */
const restartWebsocketCall = () => {
  if (reconnection.getIsReconnecting()) {
    logger.debug('Reconnection already in progress, skipping');
    return;
  }
  reconnection.setIsReconnecting(true);
  exports.isReconnecting = true;

  clearAndResetIntervals();
  connection.validateProxyConnection(config.getData('try_proxy'));
  connection.terminate();

  const delay = reconnection.getReconnectDelay();
  logger.info(`Scheduling reconnection in ${delay}ms (attempt ${reconnection.getReconnectAttempts()})`);

  if (idTimeoutToCancel) clearTimeout(idTimeoutToCancel);
  idTimeoutToCancel = setTimeout(() => {
    reconnection.setIsReconnecting(false);
    exports.isReconnecting = false;
    exports.startWebsocket();
  }, delay);
};

/**
 * Heartbeat check - triggers reconnection if connection is not ready.
 */
exports.heartbeat = () => {
  if (!connection.isReady()) {
    hooks.trigger('device_unseen');
    connection.validateProxyConnection(config.getData('try_proxy'));
    restartWebsocketCall();
  }
};

/**
 * Start heartbeat timed timeout.
 */
exports.heartbeatTimed = () => {
  heartbeat.heartbeatTimed(restartWebsocketCall);
};

/**
 * Update timestamp for alive check.
 */
const updateTimestamp = () => {
  lastTime = Date.now();
};

/**
 * Get last connection time.
 * @returns {number|undefined}
 */
exports.lastConnection = () => lastConnection;

/**
 * Set last connection from storage.
 */
const setLastConnection = () => {
  storage.do('query', { type: 'keys', column: 'id', data: 'last_connection' }, (err, stored) => {
    if (err) logger.error('Error getting the last connection data');
    if (stored && stored.length > 0) {
      lastStored = parseInt(stored[0].value, 10);
      lastConnection = parseInt(lastStored, 10);
    } else {
      lastConnection = Math.round(Date.now() / 1000);
      storage.do('set', { type: 'keys', id: 'last_connection', data: { value: lastConnection } }, (errSet) => {
        if (errSet) logger.error('Error storing the last connection time');
        logger.info('Stored referential first connection time');
      });
    }
  });
};

/**
 * Update stored connection time.
 * @param {number} newStoredTime
 */
const updateStoredConnection = (newStoredTime) => {
  storage.do('update', {
    type: 'keys', id: 'last_connection', columns: 'value', values: newStoredTime,
  }, (err) => {
    if (err) logger.info('Unable to update the local last connection value');
  });
};

/**
 * Load hooks and start triggers.
 */
const loadHooks = () => {
  setLastConnection();
  triggers.start();
  setTimeout(() => {
    hooks.trigger('device_unseen');
  }, constants.DEVICE_UNSEEN_DELAY);
  hooks.on('connected', () => {
    fileretrieval.check_pending_files();
  });
};

/**
 * Load local server.
 */
const loadServer = () => {
  setTimeout(() => {
    server.create_server((err) => {
      if (err) logger.debug(err.message);
      setAliveTimeInterval = setInterval(updateTimestamp, constants.STARTUP_TIMEOUT);
    });
  }, constants.STARTUP_TIMEOUT);
};

/**
 * Query and reset triggers with device_unseen events.
 */
const queryTriggers = () => {
  storage.do('all', { type: 'triggers' }, (err, stored) => {
    if (err || !stored) return;
    if (stored && stored.length > 0) {
      const storedFiltered = stored.filter((storedElement) => !!(
        storedElement.automation_events
        && JSON.parse(storedElement.automation_events).filter(
          (event) => event.type.localeCompare('device_unseen') === 0
            && typeof event.type === 'string',
        ).length > 0
      ));

      const lookup = {};
      triggers.currentTriggers.forEach((element) => {
        lookup[element.id] = element;
      });
      storedFiltered.forEach((current) => {
        if (lookup[current.id]) {
          lookup[current.id].last_exec = null;
        }
        storage.do('update', {
          type: 'triggers',
          id: current.id,
          columns: 'last_exec',
          values: null,
        }, (errUpdate) => {
          if (errUpdate) logger.error(`Unable to update the execution time of the trigger: ${errUpdate}`);
        });
      });
    }
  });
};

/**
 * Configure and start WebSocket connection.
 */
const webSocketSettings = () => {
  // Set up retry intervals
  notifyActionInterval = setInterval(() => {
    responseQueue.retryQueuedResponses((status, replyId, target, opts, error, out, time, id, retries, fromWithin) => {
      exports.notify_action(status, replyId, target, opts, error, out, time, id, retries, fromWithin);
    });
  }, constants.RETRY_QUEUE_INTERVAL);

  notifyAckInterval = setInterval(() => {
    ackQueue.retryAckResponses(connection.getWebSocket(), logger);
  }, constants.RETRY_ACK_INTERVAL);

  getStatusInterval = setInterval(getStatusByInterval, constants.STATUS_INTERVAL);

  timeOutCancelIntervalHearBeat = setTimeout(() => {
    setIntervalWSStatus = setInterval(exports.heartbeat, constants.HEARTBEAT_CHECK_INTERVAL);
  }, constants.HEARTBEAT_CHECK_DELAY);

  const proxy = config.getData('try_proxy');
  const protocol = config.getData('control-panel.protocol');
  const host = config.getData('control-panel.host');
  const deviceKey = keys.get().device;
  const apiKey = keys.get().api;

  if (!deviceKey) {
    utils.propagateError(hooks, logger, errors.get('NO_DEVICE_KEY'));
    exports.unload(() => {});
    return;
  }

  // Start getting status in parallel (don't block connection)
  statusData = null; // Reset status data
  gettingStatus = true;
  logger.info('Starting to get status in parallel with connection...');
  statusTrigger.status_info((_err, status) => {
    gettingStatus = false;
    statusData = status;
    logger.info(`Status received: ${status ? 'YES' : 'NO'}, Connection ready: ${connection.isReady()}`);

    // If connection is already established, send status now
    if (connection.isReady() && statusData) {
      logger.info('Status ready after connection, sending to server');
      exports.notify_status(status);
    } else {
      logger.info('Status ready, waiting for connection or status is null');
    }
  });

  // Create WebSocket connection immediately (don't wait for status)
  connection.create(
      {
        protocol,
        host,
        deviceKey,
        apiKey,
        userAgent: common.system.user_agent,
        proxy,
      },
      {
        onOpen: () => {
          reconnection.resetReconnectDelay();
          logger.info('WebSocket connection established successfully');
          clearInterval(setIntervalWSStatus);

          // Start ping interval
          heartbeat.startPingInterval(connection.getWebSocket(), logger, restartWebsocketCall);

          // Notify status if already available, otherwise will be sent when ready
          logger.info(`onOpen: statusData is ${statusData ? 'available' : 'null'}`);
          if (statusData) {
            logger.info('Status already available on connection open, sending to server');
            exports.notify_status(statusData);
          } else {
            logger.info('Status not ready yet, will be sent when get_status completes');
          }

          // Load stored responses
          responseQueue.loadFromStorage(storage, () => {});

          // Sync exported queue reference
          exports.responses_queue = responseQueue.getQueue();

          // Handle location sending
          if (timerSendLocation) clearTimeout(timerSendLocation);
          if (config.getData('control-panel.send_location_on_connect').toString().toLowerCase().localeCompare('true') === 0) {
            timerSendLocation = setTimeout(() => {
              if (!lastLocationTime || (Date.now() - lastLocationTime > constants.LOCATION_TIME_LIMIT)) {
                lastLocationTime = Date.now();
                hooks.trigger('get_location', 'single');
                logger.info('Sending location single');
              }
            }, constants.LOCATION_SEND_DELAY);
          }
        },
        onClose: (code) => {
          if (exports.re_schedule && connection.isConnected()) {
            connection.setConnected(false);
            if (code === constants.WS_ERROR_NO_CONNECTION && proxy) {
              connection.incrementProxyFailureCount();
            }
            restartWebsocketCall();
          }
          if (timerSendLocation) clearTimeout(timerSendLocation);
        },
        onMessage: (data) => {
          return handlers.handleMessage(data, {
            ws: connection.getWebSocket(),
            responseQueue,
            ackQueue,
            storage,
            ackModule: ack,
            hooks,
            logger,
            emitter,
          });
        },
        onError: (error) => {
          if (connection.isConnected() && !reconnection.getIsReconnecting()) {
            logger.info('Error occurred while connected, triggering reconnection');
            restartWebsocketCall();
          }
        },
        onPong: () => {
          queryTriggers();
          hooks.trigger('device_unseen');
          heartbeat.setPongReceived(true);
          const lastLastConnection = lastConnection;
          const newLastConnection = Math.round(Date.now() / 1000);
          network.get_connection_status((statusConnection) => {
            const diffInMinutes = ((new Date(newLastConnection * 1000)).getTime()
              - (new Date(lastLastConnection * 1000)).getTime()) / 1000 / 60;
            if (typeof statusConnection === 'string'
                && statusConnection.localeCompare('connected') === 0
                && diffInMinutes >= 30) {
              hooks.trigger('disconnected');
            }
          });
          lastConnection = newLastConnection;
          updateStoredConnection(lastConnection);
        },
        onPing: () => {
          exports.heartbeatTimed();
          const ws = connection.getWebSocket();
          if (!connection.isReady()) return;
          ws.pong();
        },
      },
      logger,
    );
};

/**
 * Start WebSocket connection.
 */
exports.startWebsocket = () => {
  clearAndResetIntervals();
  webSocketSettings();
};

/**
 * Send ACK to server.
 * @param {Object} sendToWs - ACK data
 */
exports.sendAckToServer = (sendToWs) => {
  ackQueue.sendAckToServer(connection.getWebSocket(), sendToWs, logger);
};

/**
 * Notify ACK.
 */
exports.notifyAck = (ackId, type, id, sent, retries = 0) => {
  ackQueue.notifyAck(connection.getWebSocket(), ackId, type, id, sent, retries, logger);
};

/**
 * Notify action.
 */
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
  notifications.notifyAction(
    {
      ws: connection.getWebSocket(),
      storage,
      responseQueue,
      logger,
    },
    {
      status,
      id,
      action,
      opts,
      err,
      out,
      time,
      respId,
      retries,
      fromWithin,
    },
  );
  // Sync exported queue reference
  exports.responses_queue = responseQueue.getQueue();
};

/**
 * Check timestamp for alive status.
 * @returns {boolean}
 */
exports.check_timestamp = () => {
  if (!lastTime || (Date.now() - lastTime > 1000 * 60 * 5)) return false;
  return true;
};

/**
 * Notify device status.
 * @param {Object} status - Status data
 */
exports.notify_status = (status) => {
  notifications.notifyStatus(connection.getWebSocket(), status, logger);
};

/**
 * Load WebSocket module.
 * @param {Function} cb - Callback(err, emitter)
 */
exports.load = (cb) => {
  hooks = require('../../hooks');
  commandQueue.initialize(hooks);
  loadServer();
  loadHooks();
  exports.startWebsocket();
  if (emitter) return cb(null, emitter);
  emitter = new EventEmitter();
  return cb(null, emitter);
};

/**
 * Unload WebSocket module.
 * @param {Function} cb - Callback
 */
exports.unload = (cb) => {
  clearAndResetIntervals(true);
  exports.re_schedule = false;
  connection.terminate();
  heartbeat.clearPingTimeout();
  commandQueue.clearAllQueues();
  hooks.remove('connected');
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
  return cb();
};
