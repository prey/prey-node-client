const net = require('net');

const socketFile = '/var/run/prey.sock';
const messages = require('./messages');
const hooks = require('../hooks');

let messagesData = [];
let currentMessage;
let intervalToSendMessages = null;

const verifyConsistencyData = (dataObj) => {
  if (Object.prototype.hasOwnProperty.call(dataObj, 'function')
  && Object.prototype.hasOwnProperty.call(dataObj, 'success')
  && Object.prototype.hasOwnProperty.call(dataObj, 'output')) return true;
  return false;
};
const createConnectionSocket = (messageToSendSocket, cb) => {
  if (!intervalToSendMessages) {
    // eslint-disable-next-line no-use-before-define
    intervalToSendMessages = setInterval(tryToSendNew, 500);
  }
  try {
    let socketConnection = null;
    socketConnection = net.createConnection({ path: socketFile }, () => {
      console.log('CONNECTED TO SOCKET');
      socketConnection.write(messageToSendSocket);
    });
    socketConnection.on('data', (data) => {
      const dataObj = JSON.parse(data);
      console.log(`GET DATA FROM SOCKET: ${JSON.stringify(dataObj)}`);
      if (verifyConsistencyData(dataObj)) {
        if (dataObj.function.localeCompare(currentMessage.functionName) === 0) {
          currentMessage.completed = true;
        }
        hooks.trigger(dataObj.function, [dataObj.success, dataObj.output, cb]);
        socketConnection.destroy();
        socketConnection = null;
      }
    });
  } catch (ex) {
    console.log(`Error local socket: ${ex})`);
  }
};
const sendMessage = (functionName, cb) => {
  if (Object.prototype.hasOwnProperty.call(messages, functionName)) {
    createConnectionSocket(`${JSON.stringify(messages[functionName])}\n`, cb);
  }
};
const tryToSendNew = () => {
  // eslint-disable-next-line array-callback-return, consistent-return
  messagesData = messagesData.filter((element) => {
    const timeObj = element.time;
    if (new Date().getTime() - timeObj >= 15000) {
      element.cbAttached(new Error(`Time exceeded for ${element.functionName}`));
      return true;
    }
  });
  if (!currentMessage || messagesData.length === 0) {
    return;
  }
  if (currentMessage.completed) {
    const indexToDelete = messagesData.findIndex((obj) => obj === currentMessage);

    if (indexToDelete !== -1) {
      messagesData.splice(indexToDelete, 1);
    }
    if (messagesData.length === 0) {
      currentMessage = null;
      return;
    }
    // eslint-disable-next-line prefer-destructuring
    currentMessage = messagesData[0];
    sendMessage(currentMessage.functionName, currentMessage.callback);
  }
};

const addAndWait = (functionName, cb) => {
  let cbAttached = cb;
  if (!cbAttached) cbAttached = () => {};
  const messageToSend = {
    functionName,
    toSend: JSON.stringify(messages[functionName]),
    completed: false,
    callback: cbAttached,
    time: new Date().getTime(),
  };
  if (!currentMessage) {
    currentMessage = messageToSend;
    sendMessage(functionName, cbAttached);
  }
  messagesData.push(messageToSend);
};

// eslint-disable-next-line consistent-return
const writeMessage = (functionName, cb) => {
  addAndWait(functionName, cb);
};

exports.writeMessage = writeMessage;
