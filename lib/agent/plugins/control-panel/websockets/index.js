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

var emitter;
exports.request_queue = [];
exports.responses_queue = [];
// [{"id":"1234567", "reply_id", ...},{}]

const retry_queued_responses = () => {
  if (exports.responses_queue.length == 0) return;

  exports.responses_queue.forEach(resp => {
    exports.notify_action(resp.body.status, resp.reply_id, resp.body.target, null, resp.time, resp.id)
  })
}

const process_commands = (arr) => {
  //console.log("PROCESS COMMAND!!", arr)

  if (arr.forEach) {
    arr.forEach((el) => {
      if(el.type == 'action'){
        exports.request_queue.push({
          id: el.id,
          command: el.body.command,
          target: el.body.target,
          options: el.body.options,
          started_resp: 0,
          stopped_resp: 0
        });
      }
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
      storage.do('query', {type: 'commands', column: '', data: '', query: 'started_resp = 0 OR stopped_resp = 0'}, (err, actions) => {
        if (actions.length == 0 || err) return;
        /*if(Array.isArray(actions)){
          actions.forEach(element => {
            exports.request_queue.push({
              id: element.id,
              command: element.body.command,
              target: element.body.target,
              options: element.body.options,
              started_resp: 0,
              stopped_resp: 0
            });
          });
        }else{
          exports.request_queue.push({
            id: element.id,
            command: element.body.command,
            target: element.body.target,
            options: element.body.options,
            started_resp: 0,
            stopped_resp: 0
          });
        }*/
      });
      console.log("Connection has been established!")
      exports.heartbeat();
      exports.notify_status(status);
      retry_queued_responses();
    });

    ws.on('close', function close() {
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
          logger.info('Got ' + len + ' commands.');
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
            if(exports.request_queue.length > 0){
              let request = exports.request_queue.find(x => x.id === value.reply_id);
              if(value.type == 'response' && value.body.status == 'started') {
                request.started_resp = 1;
                storage.do('update', { type: 'commands', id: value.reply_id, columns: value.body.status+'_resp', values: 1 }, (err) => {
                  if(err) console.log("NOTIF ERR", err);
                });
              }
              if(value.type == 'response' && value.body.status == 'stopped') {
                request.stopped_resp = 1;
                exports.request_queue = exports.request_queue.filter(x =>  x.id != data.reply_id);
                storage.do('del', { type: 'commands', id: value.reply_id });
              }
              //exports.request_queue = exports.request_queue.filter(x => x.id != value.reply_id);
            }
            console.log(`!!!!!!!!!!!!!!!!!!!!!!!!`);
            exports.responses_queue.forEach(element => console.log(element));
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

exports.notify_action = (status, id, action, opts, time, resp_id) => {
  console.log("NOTIFY!", status, id, action, opts, time, resp_id);

  var data = {
    "reply_id": `${id}`,    // id de la acción
    "type": "response",
    "body": { command: 'start', target: action, status: status }
  }

  data.time = time ? time : new Date().toISOString();
  data.id   = resp_id ? resp_id : uuidv4();

  // Add to responses queue if isn't already present
  if (!exports.responses_queue.some(queue => queue.id === resp_id)){
    storage.do('update', { type: 'commands', id: data.reply_id, columns: 'resp_id', values: data.id }, (err) => {
      if(err) console.log("NOTIF ERR", err);
    });
    exports.responses_queue.push(data);
  }

  if (!ws || !ws.readyState || ws.readyState != 1) return;

  ws.send(JSON.stringify(data));
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