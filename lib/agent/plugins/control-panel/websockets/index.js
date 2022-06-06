const WebSocket = require('ws');
const HttpsProxyAgent = require('https-proxy-agent');
const { v4: uuidv4 } = require('uuid');
const server = require('./server');
const urlModule = require('url');
const { EventEmitter } = require('events');
const keys = require('../api/keys');
const statusTrigger = require('../../../triggers/status');
const fileretrieval = require('../../../actions/fileretrieval');
const triggers = require('../../../actions/triggers');
const storage = require('../../../utils/storage');
const errors = require('../api/errors');

let common = require('../../../common');

const logger = common.logger.prefix('websockets');
let last_time = null;
let last_connection;
let last_stored;
let hooks;
let config;
let ws;
let pingTimeout;
let emitter;
let setAliveTimeInterval = null;
let notifyActionInterval = null;
let getStatusInterval = null;

let startupTimeout = 5000;

exports.pingtime = 120000 + 1000;
exports.re_schedule = true;
exports.responses_queue = [];

const propagateError = (message) => {
  hooks.trigger('error', new Error(message));
  logger.debug(message);
};

const getStatusByInterval = () => {
  statusTrigger.get_status((err, status) => {
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
      null,
      respQueued.time ? respQueued.time : null,
      respQueued.id ? respQueued.id : null,
      respQueued.retries ? respQueued.retries : null,
    );
  });
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
  storage.do('update', { type: 'keys', id: 'last_connection', columns: 'value', values: newStoredTime }, (err) => {
    if (err) logger.info("Unable to update the local last connection value")
  })
}
exports.heartbeat = () => {
  clearTimeout(pingTimeout);
  pingTimeout = setTimeout(() => {
    ws.close();
  }, exports.pingtime);
};

exports.startWebsocket = () => {
  const proxy = config.get('try_proxy');
  let protocol = config.get('protocol');
  const host = config.get('host');
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

  if (proxy) {
    const agent = new HttpsProxyAgent(urlModule.parse(proxy));
    options.agent = agent;
    logger.debug('Setting up proxy');
  }
  statusTrigger.get_status((err, status) => {
    // Create websocket
    ws = new WebSocket(`${protocol}://${url}`, options);

    ws.on('open', () => {
      exports.heartbeat();
      storage.do('all', { type: 'responses' }, (errs, actions) => {
        exports.notify_status(status);
        notifyActionInterval = setInterval(retryQueuedResponses, 5000); // <-revisar el tiempo
        getStatusInterval = setInterval(getStatusByInterval, 3 * 60 * 1000);
        if (!actions || typeof actions === 'undefined') return;
        if (actions.length === 0 || errs) return;
        if (Array.isArray(actions)) {
          exports.responses_queue = actions.map((element) => ({
            reply_id: `${element.action_id}`, // id de la acción
            type: 'response',
            body: { command: element.status, target: element.action, status: element.status },
            id: element.id,
            time: element.time,
            retries: element.retries,
          }));
        } else {
          exports.responses_queue.push({
            reply_id: `${actions.action_id}`, // id de la acción
            type: 'response',
            body: { command: actions.status, target: actions.action, status: actions.status },
            id: actions.id,
            time: actions.time,
            retries: actions.retries,
          });
        }
      });
    });

    ws.on('close', () => {
      clearIntervals();
      ws.terminate();
      if (exports.re_schedule) setTimeout(exports.startWebsocket, 5000);
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
        }
        return 0;
      }
      if (parsedData.status && parsedData.status === 'OK') {
        const value = exports.responses_queue.find((x) => x.id === parsedData.id);
        if (value) {
          if (value.type === 'response') {
            storage.do('del', { type: 'responses', id: value.id });
          }
          exports.responses_queue = exports.responses_queue.filter((x) => x.id !== parsedData.id);
        }
      }
      return 0;
    });

    ws.on('error', (eError) => {
      logger.info(eError.message);
    });

    ws.on('ping', () => {
      ws.pong();
      exports.heartbeat();
    });
  });
};

exports.notify_action = (status, id, action, opts, time, respId, retries = 0) => {
  if () return;
  if (!id || id === 'report' || action === 'triggers') return;
  if (retries >= 10) {
    storage.do('del', { type: 'responses', id: respId });
    exports.responses_queue = exports.responses_queue.filter((x) => x.id !== respId);
    return;
  }
  let toSend = {
    reply_id: `${id}`,
    type: 'response',
    body: { command: status, target: action, status },
    retries: retries + 1,
  };
  toSend.time = time || new Date().toISOString();
  if (toSend.time === 'NULL') toSend.time = new Date().toISOString();
  toSend.id = (respId && typeof respId !== 'undefined' && respId !== 'undefined') ? respId : uuidv4();

  const queuedResponse = exports.responses_queue.filter((queue) => queue.id === toSend.id)[0];
  if (!queuedResponse) {
    storage.do('set', {
      type: 'responses',
      id: toSend.id,
      data: {
        status,
        action,
        time: toSend.time,
        retries: toSend.retries,
        action_id: toSend.reply_id,
      },
    }, (err) => {
      if (err) logger.error(err);
    });
    exports.responses_queue.push(toSend);
  }
  else{
    storage.do('update', {
      type: 'responses',
      id: toSend.id,
      columns: ['retries'],
      values: [toSend.retries + 1],
    }, (err) => {
      if (err) logger.error(err);
    });
    queuedResponse.retries = toSend.retries + 1;
  }
  if (!ws || !ws.readyState || ws.readyState !== 1) return;
  ws.send(JSON.stringify(toSend));
};

exports.check_timestamp = () => {
  if (!last_time || (Date.now() - last_time > 1000 * 60 * 5))
    return false;
  return true;
}

exports.notify_status = (status) => {
  const data = {
    id: uuidv4(), // create id
    type: 'device_status',
    time: new Date().toISOString(),
    body: status,
  };
  let newStoredTime = Math.round(Date.now()/1000);
  last_connection = newStoredTime;
  updateStoredConnection(newStoredTime);
  if (!ws || !ws.readyState || ws.readyState !== 1) return;
  ws.send(JSON.stringify(data));
};

exports.load = function (cb) {
  common = this;
  config = common.config;
  hooks = common.hooks;
  loadHooks();
  exports.startWebsocket();
  if (emitter) return cb(null, emitter);
  emitter = new EventEmitter();
  cb(null, emitter);
};

const loadHooks = () => {
  storage.do('query', { type: 'keys', column: 'id', data: 'last_connection' }, (err, stored) => {
    if (err) logger.info("Error getting the last connection data");
    if (stored && stored.length > 0) {
      last_stored = stored[0]
      last_connection = last_stored;

    } else {
      // Just the first time the client starts
      last_connection = Math.round(Date.now()/1000);
      storage.do('set', { type: 'keys', id: 'last_connection', data: { value: last_connection }}, (err) => {
        if (err) logger.info("Error storing the last connection time")
        logger.debug("Stored referential first connection time");
      });
    }
  });

  hooks.on('connected', () => {
    fileretrieval.check_pending_files();
    triggers.start();
  });

  setTimeout(() => {
    server.create_server((err) => {
      if (err) logger.debug(err.message)
      setAliveTimeInterval = setInterval(updateTimestamp, startupTimeout);
    });
  }, startupTimeout);
}


const updateTimestamp = () => {
  last_time = Date.now();
}

const clearIntervals = (aliveTimeReset = false) => {
  if(notifyActionInterval) clearInterval(notifyActionInterval);
  if(getStatusInterval) clearInterval(getStatusInterval);
  if(setAliveTimeInterval && aliveTimeReset) clearInterval(setAliveTimeInterval);
}

exports.unload = function (cb) {
  clearIntervals(true);
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