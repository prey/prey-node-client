const WebSocket = require('ws');
var HttpsProxyAgent = require('https-proxy-agent');
const { v4: uuidv4 } = require('uuid');

var util   = require('util'),
    url_   = require('url'),
    common = require('../../../common'),
    // config = common.config;
    logger = common.logger.prefix('websockets'),
    keys   = require('./../api/keys'),
    status_trigger = require('./../../../triggers/status'),
    storage = require('./../../../utils/storage'),
    errors  = require('../api/errors'),
    Emitter = require('events').EventEmitter;

var config;

var ws,
    pingTimeout;

exports.pingtime = 60000 + 1000;
exports.re_schedule = true;

var notifyActionInterval = null;

var emitter;
exports.responses_queue = [];
// [{"id":"1234567", "reply_id", ...},{}]

const retry_queued_responses = () => {
  if (exports.responses_queue.length == 0) return;

  exports.responses_queue.forEach(resp => {
    exports.notify_action(resp.body.status, resp.reply_id, resp.body.target, null,
      resp.time ? resp.time : null, resp.id ? resp.id : null, resp.retries ? resp.retries : null)
  })
}

const process_commands = (arr) => {
  //console.log("PROCESS COMMAND!!", arr)

  if (arr.forEach) {
    arr.forEach((el) => {
      emitter.emit('command', el);
    });
  } else {
    propagate_error('Invalid command object');
  }
}

///////
// setTimeout(() => {
//     process_commands([{"command":"start","target":"alert","options":{"alert_message":"This device has been currently marked as lost by the admin. Please contact javo@preyhq.com to arrange its safe return and avoid further measures.","messageID":"34ed6ad5-26c6-4c47-9f43-a07a66a6bcae"}}]);
// }, 5000)
///////

function propagate_error(message) {
  // hooks.trigger('error', new Error(message));
  logger.debug(message);
}

exports.heartbeat = () => {
  console.log("heartbeat!");
  clearTimeout(pingTimeout);
  // Use `WebSocket#terminate()`, which immediately destroys the connection,
  // instead of `WebSocket#close()`, which waits for the close timer.
  // Delay should be equal to the interval at which your server
  // sends out pings plus a conservative assumption of the latency.
  pingTimeout = setTimeout(() => {
    ws.terminate();
  }, exports.pingtime);
}

exports.startWebsocket = () => {
  console.log("START WEBSOCKET!!")

  notifyActionInterval = setInterval(retry_queued_responses, 1000); //<-revisar el tiempo
  var proxy      = config.get('try_proxy'),
      protocol   = config.get('protocol'),
      host       = config.get('host'),
      device_key = keys.get().device,
      api_key    = keys.get().api;

  protocol = protocol == "https" ? "wss" : "ws"
  
  if (!keys.get().device) { 
    propagate_error(errors.get('NO_DEVICE_KEY'));
    exports.unload();
  }

  // var base  = protocol + '://' + host,
  var url   = host + '/api/v2/devices/' + device_key + '.ws',
      str  = [api_key, 'x'].join(':'),
      auth = 'Basic ' + Buffer.from(str).toString('base64');

  var options = { 
    headers: {
      "Authorization": `Basic ${auth}`,
      "User-Agent": common.system.user_agent,
      "Content-Type": "application/json"
    }
  }

  if (proxy) {
    var agent = new HttpsProxyAgent(url_.parse(proxy));
    options.agent = agent;
    logger.debug('Setting up proxy');
  }

  status_trigger.get_status((err, status) => {
    // Create websocket
    ws = new WebSocket(`${protocol}://${url}`, options);

    ws.on('open', function open() {
      storage.do('all', { type: 'responses' }, (err, actions) => {
        if (actions.length == 0 || err) return;
        if(Array.isArray(actions)){
          exports.responses_queue = actions.map(element => {
            return {
              "reply_id": `${element.action_id}`,    // id de la acción
              "type": "response",
              "body": { command: element.status, target: element.action, status: element.status },
              "id": element.id,
              "time": element.time,
              "retries": element.retries
            }
          });
        }else{
          exports.responses_queue.push({
            "reply_id": `${actions.action_id}`,    // id de la acción
            "type": "response",
            "body": { command: actions.status, target: actions.action, status: actions.status },
            "id": actions.id,
            "time": actions.time,
            "retries": actions.retries
          });
        }
      });
      console.log("Connection has been established!")
      exports.heartbeat();
      exports.notify_status(status);
    });

    ws.on('close', function close() {
      clearInterval(notifyActionInterval);
      if (exports.re_schedule) setTimeout(exports.startWebsocket, 5000);
    });

    ws.on('message', function incoming(data) {
      console.log("INCOMING!!!", data);
      // tener en cuenta el caso de "\n"
      try {
        data = JSON.parse(data);
      } catch (e) {
        return propagate_error('Invalid command object');
      }

      // Viene un comando
      if (Array.isArray(data)) {
        var len = data.length;
        if (len && len > 0) {
          process_commands(data);
        }
      // El response
      } else {
        if (data.status && data.status == "OK") {
          let value = exports.responses_queue.find(x => x.id === data.id)
          if (value) {
            // si llega el ok del stopped, borrar el registro...
            // ver si ambos responses está listos.. si lo están borrar el registro...
            // ver caso si llega el stopped está pero no el started...

            if(value.type == 'response') {
              storage.do('del', { type: 'responses', id: value.id });
            }
            
            // then unqueue...
            exports.responses_queue = exports.responses_queue.filter(x =>  x.id != data.id);
          }
        }
      }
    });

    ws.on('error', (err) => {
      // ver q mas hacer con el error
      logger.info(err.message)
    });

    ws.on('ping', (data) => {
      // cuando hay error tb hay close
      console.log("PING!", data);
      exports.heartbeat();
    });
  });
}

exports.notify_action = (status, id, action, opts, time, resp_id, retries = 0) => {
  console.log("NOTIFY!", status, id, action, opts, time, resp_id, retries);
  if(retries >= 10) {
    storage.do('del', { type: 'responses', id: resp_id });
    return;
  }
  
  console.log("PASE!");
  var toSend = {
    "reply_id": `${id}`,    // id de la acción
    "type": "response",
    "body": { command: status, target: action, status: status },
    "retries": retries + 1
  }
  toSend.time = time ? time : new Date().toISOString();
  if (toSend.time == 'NULL')
    toSend.time = new Date().toISOString();
  toSend.id   = (resp_id && typeof resp_id !== "undefined" && resp_id !== 'undefined') ? resp_id : uuidv4();

  // Add to responses queue if isn't already present
  let queuedResponse = exports.responses_queue.filter(queue => queue.id === toSend.id)[0];
  if (!queuedResponse) {
    storage.do('set', { type: 'responses', id: toSend.id,
      data: {
        status: status, 
        action: action,
        time: toSend.time,
        retries: toSend.retries,
        action_id: toSend.reply_id
      }
    }, (err) => { });
    exports.responses_queue.push(toSend);
  }
  storage.do('update', { type: 'responses', id: toSend.id, columns: ['retries'], values: [toSend.retries + 1]}, (err) => {
    if(err) console.log("NOTIF ERR", err);
  });

  if (!ws || !ws.readyState || ws.readyState != 1) return;
  ws.send(JSON.stringify(toSend));
}

exports.notify_status = (status) => {
  //   /*
  //   0	CONNECTING	Socket has been created. The connection is not yet open.
  //   1	OPEN	The connection is open and ready to communicate.
  //   2	CLOSING	The connection is in the process of closing.
  //   3	CLOSED	The connection is closed or couldn't be opened.
  //   */
  //   // console.log("READY STATE!!!", ws.readyState)
  //   if (!ws || !ws.readyState || ws.readyState != 1) return;
  //   ws.send(status, data)

  console.log("NEW STATUS!", status);

  var data = {
    "id": uuidv4(),   // create id
    "type": "device_status",
    "time": new Date().toISOString(),
    "body": status
  }

  console.log("DATA STATUS ID!", data.id);

  if (!ws || !ws.readyState || ws.readyState != 1) return;
  ws.send(JSON.stringify(data));
  return;
}

exports.load = function(cb) {
  var common = this;
  config = common.config;
  hooks = common.hooks;
  exports.startWebsocket();

  if (emitter)
    return cb(null, emitter);

  emitter = new Emitter();
  cb(null, emitter);
};

exports.unload = function(cb) {
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