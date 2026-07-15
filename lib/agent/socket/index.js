// @ts-check
const net = require('net');
const fs = require('fs');
const { exec } = require('child_process');

const socketFile = '/var/run/prey.sock';
const { functionObject } = require('./messages');
const hooks = require('../hooks');
const logger = require('../common').logger.prefix('socket');

exports.activeToSend = false;
exports.osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
exports.messagesData = [];
exports.currentMessage = null;
exports.intervalToSendMessages = null;
exports.timeLimitPerMessageDefault = 7000;
let messageNumber = 0;

/**
 * Verify the consistency of data object.
 *
 * @param {Object} dataObj - the data object to be checked
 * @return {boolean} true if the data object has 'function',
 * 'success', and 'output' properties, false otherwise
 */
const verifyConsistencyData = (dataObj) => {
  if (Object.prototype.hasOwnProperty.call(dataObj, 'function')
  && Object.prototype.hasOwnProperty.call(dataObj, 'success')
  && Object.prototype.hasOwnProperty.call(dataObj, 'output')) return true;
  return false;
};
/**
 * Executes `ls -l` on the socket file to determine its owner.
 *
 * @param {function} cb - Node.js error-first callback: (err, stdout, stderr)
 * @return {void}
 */
const executeOwnershipCommand = (cb) => {
  exec(`ls -l ${socketFile}`, (error, stdout, stderr) => {
    if (typeof cb === 'function') cb(error, stdout, stderr);
  });
};

/**
 * Processes the result of the ownership command and invokes the callback.
 *
 * @param {function} cb - Node.js error-first callback: (err, owner)
 * @param {Error|null} error - Error from exec, if any
 * @param {string} stdout - Standard output from the command
 * @param {string} stderr - Standard error from the command
 * @return {void}
 */
// eslint-disable-next-line consistent-return
const processOwnershipResult = (cb, error, stdout, stderr) => {
  if (error || stderr) {
    const errorProcess = error ? error.message : stderr;
    logger.error(`Error executing ownership command: ${errorProcess}`);
    return typeof cb === 'function' && cb(errorProcess);
  }
  const owner = stdout.split(' ');
  if (typeof cb === 'function') cb(null, owner);
};

/**
 * Retrieves the ownership of the socket file by executing a command.
 *
 * @param {function} cb - Node.js error-first callback: (err, owner)
 * @return {void}
 */
const getOwnerShip = (cb) => {
  executeOwnershipCommand((error, stdout, stderr) => {
    processOwnershipResult(cb, error, stdout, stderr);
  });
};

/**
 * Verifica si el archivo de socket existe.
 *
 * @return {boolean} True si el archivo de socket existe, false de lo contrario.
 */
const checkSocketFileExists = () => fs.existsSync(socketFile);

/**
 * Parses data received from the socket and triggers the corresponding hook.
 *
 * @param {{ message: any, cb: function }} messageToSendSocket - The current message context
 * @param {any} data - Raw data received from the socket (Buffer or string)
 * @param {function} cb - Node.js error-first callback: (err)
 * @return {void}
 */
const handleDataConnection = (messageToSendSocket, data, cb) => {
  try {
    const dataObj = JSON.parse(data);
    let nameFunction = `${dataObj.name}-${dataObj.function}`;
    if (dataObj.function.localeCompare('') === 0) {
      nameFunction = `${dataObj.name}`;
    }
    logger.debug(`Function's data: ${JSON.stringify(dataObj)}`);
    logger.debug('Got data from socket.');
    if (verifyConsistencyData(dataObj) && messageToSendSocket.message === exports.currentMessage) {
      if (nameFunction.localeCompare(exports.currentMessage.functionName) === 0) {
        exports.currentMessage.completed = true;
        exports.messagesData = exports.messagesData.filter((obj) => obj !== exports.currentMessage);
      }
      logger.debug(`Function's name: ${nameFunction}`);
      // @ts-ignore — hooks is a Prey EventEmitter extension with a custom .trigger() method
      hooks.trigger(nameFunction, [dataObj.success, dataObj.output, messageToSendSocket.cb]);
      if (typeof cb === 'function') cb(null);
    } else if (typeof cb === 'function') {
      cb('Error invalid data from socket or current message is already completed.');
    }
  } catch (errorParse) {
    if (typeof cb === 'function') cb(new Error(`Error parsing data from socket: ${errorParse})`));
  }
};
/**
 * Verifies that the socket file is owned by the prey user.
 *
 * @param {string|null} err - Error string from processOwnershipResult, if any
 * @param {string[]} owner - Split output of `ls -l` on the socket file
 * @param {function} cb - Node.js error-first callback: (err)
 * @return {void}
 */
// eslint-disable-next-line consistent-return
const ownerShipVerify = (err, owner, cb) => {
  if (err) {
    return typeof cb === 'function' && cb(err);
  }
  if (!owner.includes('prey')) {
    return typeof cb === 'function' && cb(new Error('The socket file is not owned by Prey'));
  }
  if (typeof cb === 'function') cb();
};

/**
 * Opens a Unix socket connection and writes the message, handling incoming data.
 *
 * @param {any} messageToSendSocket - Message object with functionName and cbAttached
 * @param {function} cb - Callback forwarded to handleDataConnection for result dispatch
 * @return {void}
 */
const handleConnection = (messageToSendSocket, cb) => {
  const socketConnection = net.createConnection({ path: socketFile });

  socketConnection.write(`${JSON.stringify(functionObject[messageToSendSocket.functionName])}\n`);

  socketConnection.on('data', (data) => handleDataConnection({
    message: messageToSendSocket,
    cb,
  }, data, (error) => {
    if (!error || typeof error === 'string') {
      socketConnection.destroy();
    }
  }));
  socketConnection.on('error', (errorSocket) => logger.error(`Error in socket connection: ${errorSocket}`));
};
/**
 * Function to create a connection socket and send a message through it.
 *
 * @param {any} messageToSendSocket - the message object to be sent through the socket
 * @param {function} cb - callback function to handle the result of the socket connection
 * @return {void} This function does not return a value
 */
// eslint-disable-next-line consistent-return
const createConnectionSocket = (messageToSendSocket, cb) => {
  try {
    if (!checkSocketFileExists()) {
      logger.error('The socket file does not exist');
      return;
    }
    // eslint-disable-next-line consistent-return
    getOwnerShip((err, owner) => {
      ownerShipVerify(err, owner, (errorVerify) => {
        // eslint-disable-next-line no-useless-return
        if (errorVerify) return;
        handleConnection(messageToSendSocket, cb);
      });
    });
  } catch (ex) {
    logger.error(`Error between ownership and local socket: ${ex})`);
  }
};
/**
 * Stamps the message with a timestamp and dispatches it through the socket.
 *
 * @param {any} messageToSend - Message object with functionName and cbAttached
 * @param {function} cb - Callback forwarded to createConnectionSocket
 * @return {void}
 */
const sendMessage = (messageToSend, cb) => {
  // eslint-disable-next-line no-param-reassign
  messageToSend.time = new Date().getTime();
  if (Object.prototype.hasOwnProperty.call(functionObject, messageToSend.functionName)) {
    createConnectionSocket(messageToSend, cb);
  }
};
/**
 * Filter messages that have exceeded the time limit per message and handle accordingly.
 */
const tryToSendNew = () => {
  if (!exports.currentMessage) return;
  if (!exports.currentMessage.completed
      // eslint-disable-next-line max-len
      && ((new Date()).getTime() - exports.currentMessage.time) >= exports.currentMessage.timeLimitPerMessage) {
    exports.currentMessage.completed = true;
    if (typeof exports.currentMessage.cbAttached === 'function') {
      exports.currentMessage.cbAttached(new Error(`Time exceeded for ${exports.currentMessage.functionName}`));
    }
  }
  if (exports.messagesData.length === 0) {
    exports.currentMessage = null;
    return;
  }
  if (exports.currentMessage.completed) {
    const indexToDelete = exports.messagesData.findIndex((obj) => obj === exports.currentMessage);

    if (indexToDelete !== -1) {
      exports.messagesData.splice(indexToDelete, 1);
    }
    if (exports.messagesData.length === 0) {
      exports.currentMessage = null;
      return;
    }
    // eslint-disable-next-line prefer-destructuring
    exports.currentMessage = exports.messagesData[0];
    sendMessage(exports.currentMessage, exports.currentMessage.cbAttached);
  }
};
/**
 * Executes a function with an optional callback, and sends a message with
 * the function details to a queue for processing.
 *
 * @param {string} functionName - The name of the function to be executed.
 * @param {function} cb - Optional callback function.
 */
/**
 * Enqueues a message and waits for a response from the macOS socket agent.
 *
 * @param {string} functionName - The name of the function to invoke on the agent
 * @param {function} [cb] - Optional callback invoked when the agent responds or times out
 * @param {number} [time] - Custom timeout in ms; defaults to timeLimitPerMessageDefault
 * @return {void}
 */
const addAndWait = (functionName, cb, time) => {
  messageNumber += 1;
  let callbAttached = cb;
  if (!callbAttached) callbAttached = () => {};
  const messageToSend = {
    id: messageNumber,
    functionName,
    toSend: JSON.stringify(functionObject[functionName]),
    completed: false,
    cbAttached: callbAttached,
    timeLimitPerMessage: time || exports.timeLimitPerMessageDefault,
    time: null,
  };
  if (!exports.currentMessage) {
    exports.currentMessage = messageToSend;
    sendMessage(exports.currentMessage, exports.currentMessage.cbAttached);
  }
  exports.messagesData.push(messageToSend);
  if (!exports.intervalToSendMessages) {
    // eslint-disable-next-line no-use-before-define
    exports.intervalToSendMessages = setInterval(tryToSendNew, 500);
  }
};

// eslint-disable-next-line consistent-return
const handleNonMac = (cb) => {
  if (typeof cb === 'function') return cb();
};

/**
 * Invokes the callback with an error indicating the agent is not active.
 *
 * @param {function} [cb] - Optional callback: (err)
 * @return {void}
 */
const handleInactive = (cb) => {
  if (typeof cb === 'function') cb(new Error('Agent not active to send messages.'));
};
/**
 * Writes a message to the queue for processing, which will be sent to the
 * agent once the agent is active and if the agent is on a Mac.
 *
 * @param {string} functionName - The name of the function to be executed.
 * @param {function} cb - Optional callback function.
 * @return {void} This function does not return a value
 */
const writeMessage = (functionName, cb, time) => {
  if (!Object.keys(functionObject).includes(functionName)) {
    if (typeof cb !== 'function') return;
    // eslint-disable-next-line consistent-return
    return cb(new Error(''));
  }
  const isMac = exports.osName === 'mac';
  const isActiveToSend = exports.activeToSend;
  if (!isMac) {
    // eslint-disable-next-line consistent-return
    return handleNonMac(cb);
  }
  if (!isActiveToSend) {
    // eslint-disable-next-line consistent-return
    return handleInactive(cb);
  }

  addAndWait(functionName, cb, time);
};

exports.writeMessage = writeMessage;
exports.tryToSendNew = tryToSendNew;
exports.verifyConsistencyData = verifyConsistencyData;
exports.processOwnershipResult = processOwnershipResult;
exports.sendMessage = sendMessage;
exports.addAndWait = addAndWait;
exports.createConnectionSocket = createConnectionSocket;
exports.handleDataConnection = handleDataConnection;
exports.ownerShipVerify = ownerShipVerify;
exports.handleConnection = handleConnection;
