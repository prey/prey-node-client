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
exports.timeLimitPerMessageDefault = 15000;

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
 * Ejecuta el comando para obtener la propiedad del archivo.
 *
 * @param {string} socketFile - Ruta del archivo
 * @param {function} cb - Callback function to handle the results or errors
 */
const executeOwnershipCommand = (cb) => {
  exec(`ls -l ${socketFile}`, (error, stdout, stderr) => {
    cb(error, stdout, stderr);
  });
};

/**
 * Procesa el resultado del comando para obtener la propiedad del archivo.
 *
 * @param {function} cb - Callback function to handle the results or errors
 * @param {Error|null} error - Error si ocurrió un error
 * @param {string} stdout - Salida estándar del comando
 * @param {string} stderr - Salida de error del comando
 */
// eslint-disable-next-line consistent-return
const processOwnershipResult = (cb, error, stdout, stderr) => {
  if (error || stderr) {
    const errorProcess = error ? error.message : stderr;
    logger.error(`Error executing ownership command: ${errorProcess}`);
    return cb(errorProcess);
  }
  const owner = stdout.split(' ');
  cb(null, owner);
};

/**
 * Retrieves the ownership of a specified file by executing a command.
 *
 * @param {function} cb - Callback function to handle the results or errors
 * @return {string} The owner of the file
 */
const getOwnerShip = (cb) => {
  executeOwnershipCommand((error, stdout, stderr) => {
    processOwnershipResult(cb, error, stdout, stderr);
  });
};
/**
 * Function to create a connection socket and send a message through it.
 *
 * @param {string} messageToSendSocket - the message to be sent through the socket
 * @param {function} cb - callback function to handle the result of the socket connection
 * @return {void} This function does not return a value
 */
// eslint-disable-next-line consistent-return
const createConnectionSocket = (messageToSendSocket, cb) => {
  try {
    const existsFile = fs.existsSync(socketFile);
    if (!existsFile) {
      logger.error('The socket file does not exist');
      return;
    }
    // eslint-disable-next-line consistent-return
    getOwnerShip((err, owner) => {
      if (err) {
        logger.error(`Error ownership socket file: ${err}`);
        return;
      }
      if (!owner.includes('prey')) {
        logger.error('The socket file is not owned by Prey');
        // eslint-disable-next-line consistent-return
        return;
      }
      let socketConnection = null;
      const MessageToSend = `${JSON.stringify(functionObject[messageToSendSocket.functionName])}\n`;
      try {
        socketConnection = net.createConnection({ path: socketFile }, () => {
          logger.debug(`Connected to local socket for message ${exports.currentMessage.functionName}`);
          socketConnection.write(MessageToSend);
        });
        socketConnection.on('data', (data) => {
          try {
            const dataObj = JSON.parse(data);
            let nameFunction = `${dataObj.name}-${dataObj.function}`;
            if (dataObj.function.localeCompare('') === 0) {
              nameFunction = `${dataObj.name}`;
            }
            logger.debug(`Function's data: ${JSON.stringify(dataObj)}`);
            logger.debug('Got data from socket.');
            if (verifyConsistencyData(dataObj) && messageToSendSocket === exports.currentMessage) {
              if (nameFunction.localeCompare(exports.currentMessage.functionName) === 0) {
                exports.currentMessage.completed = true;
              }
              logger.debug(`Function's name: ${nameFunction}`);
              hooks.trigger(nameFunction, [dataObj.success, dataObj.output, cb]);
              socketConnection.destroy();
              socketConnection = null;
            } else {
              logger.error('Error invalid data from socket or current message is already completed.');
              socketConnection.destroy();
              socketConnection = null;
            }
          } catch (errorParse) {
            logger.error(`Error parsing data from socket: ${errorParse})`);
          }
        });
        socketConnection.on('error', (errorSocket) => {
          logger.error(`Error in socket connection: ${errorSocket}`);
        });
      } catch (ex) {
        logger.error(`Error connecting to local socket: ${ex})`);
      }
    });
  } catch (ex) {
    logger.error(`Error between ownership and local socket: ${ex})`);
  }
};
/**
 * A function that sends a message based on the functionName provided.
 *
 * @param {string} functionName - the name of the function to retrieve a message for
 * @param {function} cb - a callback function to handle the message sending
 * @return {void}
 */
const sendMessage = (messageToSend, cb) => {
  if (Object.prototype.hasOwnProperty.call(functionObject, messageToSend.functionName)) {
    createConnectionSocket(messageToSend, cb);
  }
};
/**
 * Filter messages that have exceeded the time limit per message and handle accordingly.
 */
const tryToSendNew = () => {
  // eslint-disable-next-line array-callback-return, consistent-return
  exports.messagesData = exports.messagesData.reduce((acc, element) => {
    const timeObj = element.time;
    if (((new Date()).getTime() - timeObj) >= element.timeLimitPerMessage) {
      if (exports.currentMessage === element) {
        exports.currentMessage.completed = true;
      }
      if (typeof element.cbAttached === 'function') {
        element.cbAttached(new Error(`Time exceeded for ${element.functionName}`));
      }
    } else if (((new Date()).getTime() - timeObj) < element.timeLimitPerMessage) {
      acc.push(element);
    }
    return acc;
  }, []);
  if (!exports.currentMessage || exports.messagesData.length === 0) {
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
const addAndWait = (functionName, cb, time) => {
  let callbAttached = cb;
  if (!callbAttached) callbAttached = () => {};
  const messageToSend = {
    functionName,
    toSend: JSON.stringify(functionObject[functionName]),
    completed: false,
    cbAttached: callbAttached,
    timeLimitPerMessage: time || exports.timeLimitPerMessageDefault,
    time: new Date().getTime(),
  };
  if (!exports.currentMessage) {
    exports.currentMessage = messageToSend;
    sendMessage(exports.currentMessage, callbAttached);
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
const writeMessage = (functionName, cb) => {
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

  addAndWait(functionName, cb);
};

exports.writeMessage = writeMessage;
exports.tryToSendNew = tryToSendNew;
exports.verifyConsistencyData = verifyConsistencyData;
exports.processOwnershipResult = processOwnershipResult;
exports.sendMessage = sendMessage;
exports.addAndWait = addAndWait;
exports.createConnectionSocket = createConnectionSocket;
