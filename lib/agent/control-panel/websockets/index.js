/* eslint-disable indent */
const WebSocket = require('ws');
const HttpsProxyAgent = require('https-proxy-agent');
const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('events');
const server = require('./server');
const keys = require('../api/keys');
const statusTrigger = require('../../triggers/status');
const fileretrieval = require('../../actions/fileretrieval');
const triggers = require('../../actions/triggers');
const storage = require('../../utils/storage');
const errors = require('../api/errors');
const ack = require('../../ack');
const common = require('../../../common');

const logger = common.logger.prefix('websockets');
const maxCountNotConnectionProxy = 5;
const codeErrorNoConnectionWebSocket = 1006;

let config;
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
let setIntervalWSStatus = null;
let notifyActionInterval = null;
let notifyAckInterval = null;
let getStatusInterval = null;
let idTimeoutToCancel;
let websocketConnected = false;
let workingWithProxy = true;
let countNotConnectionProxy = 0;

const startupTimeout = 5000;
const heartbeatTimeout = 120000 + 1000;
const retriesMax = 10;

exports.re_schedule = true;
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

const retryQueuedResponses = () => {
  if (exports.responses_queue.length === 0) return;

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
      respQueued.retries ? respQueued.retries : null
    );
  });
};
// Created this function to connect with ack.js, but
// I'm not sure it's the cleanest way to do it.
const AckResponses = () => {
  try {
    ack.retryAckResponses().forEach((respAck) => {
      if (!ws || !ws.readyState || ws.readyState !== 1) {
        throw new Error('ws is not available');
      }
      ws.send(JSON.stringify(respAck));
      ack.removeAckFromArray(respAck.ack_id);
    });
  } catch (error) {
    logger.error(`Error sending ACK: ${JSON.stringify(error)}`);
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
const updateStoredConnection = (newStoredTime) => {
  storage.do(
    'update',
    {
      type: 'keys',
      id: 'last_connection',
      columns: 'value',
      values: newStoredTime,
    },
    (err) => {
      if (err) logger.info('Unable to update the local last connection value');
    }
  );
};

const clearAndResetIntervals = (aliveTimeReset = false) => {
  if (notifyAckInterval) clearInterval(notifyAckInterval);
  if (notifyActionInterval) clearInterval(notifyActionInterval);
  if (getStatusInterval) clearInterval(getStatusInterval);
  if (setIntervalWSStatus) clearInterval(setIntervalWSStatus);
  if (pingTimeout) clearInterval(pingTimeout);
  if (pingInterval) clearInterval(pingInterval);
  if (setAliveTimeInterval && aliveTimeReset)
    clearInterval(setAliveTimeInterval);
};

const validationConnectionsProxy = () => {
  if (config.get('try_proxy')) {
    if (countNotConnectionProxy >= maxCountNotConnectionProxy) {
      logger.info('connecting without proxy');
      workingWithProxy = !workingWithProxy;
      countNotConnectionProxy = 0;
    }
  }
};

const restartWebsocketCall = () => {
  clearAndResetIntervals();
  validationConnectionsProxy();
  if (ws) ws.terminate();
  if (exports.re_schedule) {
    if (idTimeoutToCancel) clearTimeout(idTimeoutToCancel);
    idTimeoutToCancel = setTimeout(exports.startWebsocket, 5000);
  }
};

exports.heartbeat = () => {
  if (!ws || !ws.readyState || ws.readyState !== 1) {
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

const updateTimestamp = () => {
  lastTime = Date.now();
};

const loadHooks = () => {
  storage.do(
    'query',
    { type: 'keys', column: 'id', data: 'last_connection' },
    (err, stored) => {
      if (err) logger.error('Error getting the last connection data');
      if (stored && stored.length > 0) {
        // eslint-disable-next-line prefer-destructuring
        lastStored = stored[0];
        lastConnection = lastStored;
      } else {
        // Just the first time the client starts
        lastConnection = Math.round(Date.now() / 1000);
        storage.do(
          'set',
          {
            type: 'keys',
            id: 'last_connection',
            data: { value: lastConnection },
          },
          (errSet) => {
            if (errSet) logger.error('Error storing the last connection time');
            logger.debug('Stored referential first connection time');
          }
        );
      }
    }
  );

  hooks.on('connected', () => {
    fileretrieval.check_pending_files();
    triggers.start();
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

exports.startWebsocket = () => {
  clearAndResetIntervals();
  notifyActionInterval = setInterval(retryQueuedResponses, 5000); // <-revisar el tiempo
  // Use a function called retryAckResponses
  // to retry ack responses, but calling ack.retryAckResponses on it
  // and getting the array of responses from it then sending them to server
  notifyAckInterval = setInterval(AckResponses, 4 * 1000);
  getStatusInterval = setInterval(getStatusByInterval, 5 * 60 * 1000);
  setIntervalWSStatus = setInterval(exports.heartbeat, 20000);
  const proxy = config.get('control-panel.try_proxy');
  let protocol = config.get('control-panel.protocol');
  const host = config.get('control-panel.host');
  const deviceKey = keys.get().device;
  const apiKey = keys.get().api;

  protocol = protocol === 'https' ? 'wss' : 'ws';

  if (!keys.get().device) {
    propagateError(errors.get('NO_DEVICE_KEY'));
    exports.unload();
  }
  const url = `${host}/api/v2/devices/${deviceKey}.ws`;
  const str = [apiKey, 'x'].join(':');
  const auth = `Basic ${Buffer.from(str).toString('base64')}`;

  const options = {
    headers: {
      Authorization: `Basic ${auth}`,
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
  statusTrigger.get_status((err, status) => {
    gettingStatus = false;
    // Create websocket
    ws = new WebSocket(`${protocol}://${url}`, options);
    websocketConnected = true;
    ws.on('open', () => {
      pingInterval = setInterval(() => {
        ws.ping();
      }, 60000);
      exports.notify_status(status);

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
            body: {
              command: element.status,
              target: element.action,
              status: element.status,
            },
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
            body: {
              command: actions.status,
              target: actions.action,
              status: actions.status,
            },
            id: actions.id,
            time: actions.time,
            retries: actions.retries,
          });
        }
      });
    });

    ws.on('close', (code) => {
      if (exports.re_schedule && websocketConnected) {
        websocketConnected = false;
        if (code === codeErrorNoConnectionWebSocket && proxy) {
          countNotConnectionProxy += 1;
        }
        restartWebsocketCall();
      }
    });

    ws.on('message', (data) => {
      let parsedData;
      try {
        parsedData = JSON.parse(data);
      } catch (e) {
        return propagateError('Invalid command object');
      }
      if (Array.isArray(parsedData)) {
        const len = parsedData.length;
        if (len && len > 0) {
          processCommands(parsedData);
          ack.processAcks(parsedData);
        }
        return 0;
      }
      if (parsedData.status && parsedData.status === 'OK') {
        const value = exports.responses_queue.find(
          (x) => x.id === parsedData.id
        );
        if (value) {
          if (value.type === 'response') {
            storage.do('del', { type: 'responses', id: value.id });
          }
          exports.responses_queue = exports.responses_queue.filter(
            (x) => x.id !== parsedData.id
          );
        }
      }
      return 0;
    });

    ws.on('error', (eError) => {
      logger.info(`websockets error: ${eError.message}`);
    });

    ws.on('ping', () => {
      exports.heartbeatTimed();
      if (!ws || !ws.readyState || ws.readyState !== 1) return;
      ws.pong();
    });
  });
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
  retries = 0
) => {
  if (
    !id ||
    id === 'report' ||
    action === 'triggers' ||
    action === 'geofencing'
  )
    return;
  if (retries >= retriesMax) {
    storage.do('del', { type: 'responses', id: respId });
    exports.responses_queue = exports.responses_queue.filter(
      (x) => x.id !== respId
    );
    return;
  }
  // eslint-disable-next-line prefer-const
  let toSend = {
    reply_id: `${id}`,
    type: 'response',
    body: { command: status, target: action, status },
    retries: retries + 1,
  };
  toSend.time = time || new Date().toISOString();
  if (toSend.time === 'NULL') toSend.time = new Date().toISOString();
  toSend.id =
    respId && typeof respId !== 'undefined' && respId !== 'undefined'
      ? respId
      : uuidv4();
  ///
  if (out) {
    if (action === 'diskencryption') toSend.body.reason = { encryption: out };
    else if (action === 'factoryreset')
      toSend.body.reason = { status_code: out.data, status_msg: out.message };
    else if (action === 'fullwipe')
      toSend.body.reason = { status_code: out.data, status_msg: out.message };
  }
  if (err) {
    if (action === 'factoryreset') {
      toSend.body.reason = {
        status_code: err.code ? err.code : 1,
        status_msg: err.message,
      };
      toSend.body.status = 'stopped';
    } else toSend.body.reason = err.message;
  }
  if (action === 'fullwipe' || action === 'fullwipewindows') {
    if (err) {
      toSend.body = {
        command: toSend.body.command,
        status: 'stopped',
        reason: {
          status_code: err.code ? err.code : 1,
          status_msg: err.message,
        },
      };
    }
    if (opts) toSend.body.target = opts.target;
  }
  ///
  const queuedResponse = exports.responses_queue.filter(
    (queue) => queue.id === toSend.id
  )[0];
  if (!queuedResponse) {
    let optsTarget = opts ? opts.target : null;
    optsTarget = optsTarget || null;
    storage.do(
      'set',
      {
        type: 'responses',
        id: toSend.id,
        data: {
          status: toSend.body.status,
          error: err ? JSON.stringify(err) : null,
          reason: toSend.body.reason
            ? JSON.stringify(toSend.body.reason)
            : null,
          out: out ? JSON.stringify(out) : null,
          opts: optsTarget,
          action,
          time: toSend.time,
          retries: toSend.retries,
          action_id: toSend.reply_id,
        },
      },
      (errSet) => {
        if (errSet) logger.error(errSet);
      }
    );
    exports.responses_queue.push(toSend);
  } else {
    storage.do(
      'update',
      {
        type: 'responses',
        id: toSend.id,
        columns: ['retries'],
        values: [toSend.retries + 1],
      },
      (errUpdate) => {
        if (errUpdate) logger.error(errUpdate);
      }
    );
    queuedResponse.retries = toSend.retries + 1;
  }
  if (!ws || !ws.readyState || ws.readyState !== 1) return;
  ws.send(JSON.stringify(toSend));
};

exports.check_timestamp = () => {
  if (!lastTime || Date.now() - lastTime > 1000 * 60 * 5) return false;
  return true;
};

exports.notify_status = (status) => {
  const data = {
    id: uuidv4(), // create id
    type: 'device_status',
    time: new Date().toISOString(),
    body: status,
  };
  const newStoredTime = Math.round(Date.now() / 1000);
  lastConnection = newStoredTime;
  updateStoredConnection(newStoredTime);
  if (!ws || !ws.readyState || ws.readyState !== 1) return;
  logger.info("Sending device's status information");
  ws.send(JSON.stringify(data));
};

exports.load = (cb) => {
  config = common.config;
  // eslint-disable-next-line global-require
  hooks = require('../../hooks');
  loadServer();
  loadHooks();
  exports.startWebsocket();
  if (emitter) return cb(null, emitter);
  emitter = new EventEmitter();
  return cb(null, emitter);
};

exports.unload = (cb) => {
  clearAndResetIntervals(true);
  exports.re_schedule = false;
  if (ws) ws.terminate();
  clearTimeout(pingTimeout);
  hooks.remove('connected');
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
  return cb();
};