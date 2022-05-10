/* eslint-disable linebreak-style */

// eslint-disable-next-line import/no-extraneous-dependencies
const WebSocket = require('ws');
// eslint-disable-next-line import/no-extraneous-dependencies
const HttpsProxyAgent = require('https-proxy-agent');
// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');

const urlModule = require('url');
const { EventEmitter } = require('events');
// const common = require('../../../common');
// config = common.config;
// const logger = common.logger.prefix('websockets');
const keys = require('../api/keys');
const statusTrigger = require('../../../triggers/status');
const storage = require('../../../utils/storage');
const errors = require('../api/errors');

let common = require('../../../common');

const logger = common.logger.prefix('websockets');

let config;
let ws;
let pingTimeout;
let emitter;
let notifyActionInterval = null;

exports.pingtime = 60000 + 1000;
exports.re_schedule = true;
exports.responses_queue = [];
// [{'id':'1234567', 'reply_id', ...},{}]

const propagateError = (message) => {
  // hooks.trigger('error', new Error(message));
  logger.debug(message);
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

exports.heartbeat = () => {
  clearTimeout(pingTimeout);
  // Use `WebSocket#terminate()`, which immediately destroys the connection,
  // instead of `WebSocket#close()`, which waits for the close timer.
  // Delay should be equal to the interval at which your server
  // sends out pings plus a conservative assumption of the latency.
  pingTimeout = setTimeout(() => {
    ws.terminate();
  }, exports.pingtime);
};

exports.startWebsocket = () => {
  console.log('START WEBSOCKET!!');

  notifyActionInterval = setInterval(retryQueuedResponses, 1000); // <-revisar el tiempo
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

  // var base  = protocol + '://' + host,
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
    exports.notify_status(status);
    exports.heartbeat();
    // Create websocket
    ws = new WebSocket(`${protocol}://${url}`, options);

    ws.on('open', () => {
      storage.do('all', { type: 'responses' }, (errs, actions) => {
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
      exports.heartbeat();
    });

    ws.on('close', () => {
      clearInterval(notifyActionInterval);
      if (exports.re_schedule) setTimeout(exports.startWebsocket, 5000);
    });

    ws.on('message', (data) => {
      // tener en cuenta el caso de '\n'
      let parsedData;
      try {
        parsedData = JSON.parse(data);
      } catch (e) {
        return propagateError('Invalid command object');
      }
      // Viene un comando
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
          // si llega el ok del stopped, borrar el registro...
          // ver si ambos responses está listos.. si lo están borrar el registro...
          // ver caso si llega el stopped está pero no el started...

          if (value.type === 'response') {
            storage.do('del', { type: 'responses', id: value.id });
          }
          // then unqueue...
          exports.responses_queue = exports.responses_queue.filter((x) => x.id !== parsedData.id);
        }
      }
      return 0;
    });

    ws.on('error', (eError) => {
      // ver q mas hacer con el error
      logger.info(eError.message);
    });

    ws.on('ping', (data) => {
      // cuando hay error tb hay close
      console.log('PING!', data);
      exports.heartbeat();
    });
  });
};

exports.notify_action = (status, id, action, opts, time, respId, retries = 0) => {
  if (retries >= 10) {
    storage.do('del', { type: 'responses', id: respId });
    return;
  }
  // eslint-disable-next-line prefer-const
  let toSend = {
    reply_id: `${id}`, // id de la acción
    type: 'response',
    body: { command: status, target: action, status },
    retries: retries + 1,
  };
  toSend.time = time || new Date().toISOString();
  if (toSend.time === 'NULL') toSend.time = new Date().toISOString();
  toSend.id = (respId && typeof respId !== 'undefined' && respId !== 'undefined') ? respId : uuidv4();

  // Add to responses queue if isn't already present
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
    }, () => { });
    exports.responses_queue.push(toSend);
  }
  storage.do('update', {
    type: 'responses',
    id: toSend.id,
    columns: ['retries'],
    values: [toSend.retries + 1],
  }, (err) => {
    if (err) console.log('NOTIF ERR', err);
  });

  if (!ws || !ws.readyState || ws.readyState !== 1) return;
  ws.send(JSON.stringify(toSend));
};

exports.notify_status = (status) => {
  const data = {
    id: uuidv4(), // create id
    type: 'device_status',
    time: new Date().toISOString(),
    body: status,
  };

  if (!ws || !ws.readyState || ws.readyState !== 1) return;
  ws.send(JSON.stringify(data));
};
// eslint-disable-next-line consistent-return
exports.load = function (cb) {
  common = this;
  config = common.config;
  exports.startWebsocket();

  if (emitter) return cb(null, emitter);

  emitter = new EventEmitter();
  cb(null, emitter);
};

exports.unload = function (cb) {
  clearInterval(notifyActionInterval);
  exports.re_schedule = false;
  if (ws) ws.terminate();

  clearTimeout(pingTimeout);

  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
  // return cb && cb(true);
  return cb();
};
