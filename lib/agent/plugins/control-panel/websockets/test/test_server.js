/* eslint-disable linebreak-style */
const WebSocket = require('ws');

let wss;
let ws;
let interval;

const stopPing = () => {
  clearInterval(interval);
  interval = null;
};

const close = (cb) => {
  stopPing();
  if (wss) wss.close(cb);
};

const publishAction = (action) => {
  wss.clients.forEach((wsock) => {
    console.log("sending action!");
    wsock.send(JSON.stringify(action));
  });
};

const startPing = () => {
  interval = setInterval(() => {
    wss.clients.forEach((wsock) => {
      wsock.ping();
    });
  }, 1000);
};

function open(port) {
  wss = new WebSocket.Server({ port });

  wss.on('connection', (socket) => {
    ws = socket;
    ws.on('message', (data) => {
      const dataInformation = JSON.parse(data);
      setTimeout(() => {
        ws.send(JSON.stringify({
          status: 'OK',
          id: dataInformation.id,
        }));
      }, 1000);
    });
  });

  wss.on('close', () => {
    clearInterval(interval);
  });

  startPing();
  return wss;
}

exports.start_ping = startPing;
exports.stop_ping = stopPing;
exports.publish_action = publishAction;
exports.open = open;
exports.close = close;
