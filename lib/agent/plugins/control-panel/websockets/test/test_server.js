const WebSocket = require('ws');
let wss;
let ws;
var interval;
// let server;

// const { v4: uuidv4 } = require('uuid');

function open(port) {
  console.log("PORT!!", port)

  wss = new WebSocket.Server({ port: port });

  wss.on('connection', function connection(socket) {
    ws = socket;
    console.log("CONNECTED!!!")

    ws.on('message', function incoming(data) {
      data = JSON.parse(data);
      // {"status":"OK","id":"481a5f6a-f84a-434a-bf81-4c865a1b6e0c"}
      setTimeout(() => {
        ws.send(JSON.stringify({status: "OK", id: data.id}))
      }, 1000)
    });
  });

  // wss.on('message', function incoming(data) {
  //   console.log("MESSAGE DATA!!", data)
  // });

  wss.on('close', function close(hola) {
    // console.log(wss)
    clearInterval(interval);
    // this.clients.delete(wss)
    // hola.destroy();
  });

  start_ping();

  // server.listen(port);

  return wss;
}

function close(cb) {
  stop_ping();
  if (wss) {
    wss.close(cb)
  }
}

function publish_action(action) {
  ws.send(JSON.stringify(action));
}

function stop_ping() {
  clearInterval(interval);
  interval = null;
}

function start_ping() {
  interval = setInterval(function ping() {
    wss.clients.forEach(function each(ws) {
      // if (ws.isAlive === false) return ws.terminate();
  
      // ws.isAlive = false;
      ws.ping();
    });
  }, 1000);
}

exports.start_ping = start_ping;
exports.stop_ping  = stop_ping;
exports.publish_action = publish_action;
exports.open  = open;
exports.close = close;

// var http = require('http');

// var server;

// function open(port, res) {
//   server = http.createServer();

//   server.on('request', res);
//   server.listen(port);
//   return server;
// }

// function close(cb) {
//   if (server) server.close(cb);
// }

// exports.open = open;
// exports.close = close;