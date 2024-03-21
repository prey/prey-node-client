const net = require('net');
const fs = require('fs');
const { exec } = require('child_process');

const socketFile = '/var/run/prey.sock';
const messages = require('./messages');
const hooks = require('../hooks');
const logger = require('../common').logger.prefix('socket');

let messagesData = [];
let currentMessage;
let intervalToSendMessages = null;
const timeLimitPerMessage = 7000;
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
 * Retrieves the ownership of a specified file by executing a command.
 *
 * @param {function} cb - Callback function to handle the results or errors
 * @return {string} The owner of the file
 */
const getOwnerShip = (cb) => {
  exec(`ls -l ${socketFile}`, (error, stdout, stderr) => {
    if (error) {
      logger.error(`Error executing ownership command: ${error.message}`);
      cb(error);
    }
    if (stderr) {
      logger.error(`Standard error ownership command: ${stderr}`);
      cb(stderr);
    }
    const owner = stdout.split(' ');
    cb(null, owner);
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
    if (!existsFile) return cb(new Error('The socket file does not exist'));
    // eslint-disable-next-line consistent-return
    getOwnerShip((err, owner) => {
      if (err) return cb(err);
      if (!owner.includes('prey')) return cb(new Error('The socket file is not owned by Prey'));
      let socketConnection = null;
      socketConnection = net.createConnection({ path: socketFile }, () => {
        logger.info('Connected to local socket');
        socketConnection.write(messageToSendSocket);
      });
      socketConnection.on('data', (data) => {
        try {
          const dataObj = JSON.parse(data);
          logger.debug(`Function's name: ${dataObj}`);
          logger.info('Got data from socket.');
          if (verifyConsistencyData(dataObj)) {
            if (dataObj.function.localeCompare(currentMessage.functionName) === 0) {
              currentMessage.completed = true;
            }
            logger.info(`Function's name: ${dataObj.function}`);
            hooks.trigger(dataObj.function, [dataObj.success, dataObj.output, cb]);
            socketConnection.destroy();
            socketConnection = null;
          } else {
            logger.error('Error invalid data from socket.');
            socketConnection.destroy();
            socketConnection = null;
          }
        } catch (errorParse) {
          logger.error(`Error parsing data from socket: ${errorParse})`);
        }
      });
    });
  } catch (ex) {
    logger.error(`Error local socket: ${ex})`);
  }
};
/**
 * A function that sends a message based on the functionName provided.
 *
 * @param {string} functionName - the name of the function to retrieve a message for
 * @param {function} cb - a callback function to handle the message sending
 * @return {void}
 */
const sendMessage = (functionName, cb) => {
  if (Object.prototype.hasOwnProperty.call(messages, functionName)) {
    createConnectionSocket(`${JSON.stringify(messages[functionName])}\n`, cb);
  }
};
/**
 * Filter messages that have exceeded the time limit per message and handle accordingly.
 */
const tryToSendNew = () => {
  // eslint-disable-next-line array-callback-return, consistent-return
  messagesData = messagesData.reduce((acc, element) => {
    const timeObj = element.time;
    if (((new Date()).getTime() - timeObj) >= timeLimitPerMessage) {
      if (typeof element.cbAttached === 'function') element.cbAttached(new Error(`Time exceeded for ${element.functionName}`));
    } else if (((new Date()).getTime() - timeObj) < timeLimitPerMessage) {
      acc.push(element);
    }
    return acc;
  }, []);
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
/**
 * Executes a function with an optional callback, and sends a message with
 * the function details to a queue for processing.
 *
 * @param {string} functionName - The name of the function to be executed.
 * @param {function} cb - Optional callback function.
 */
const addAndWait = (functionName, cb) => {
  let callbAttached = cb;
  if (!callbAttached) callbAttached = () => {};
  const messageToSend = {
    functionName,
    toSend: JSON.stringify(messages[functionName]),
    completed: false,
    cbAttached: callbAttached,
    time: new Date().getTime(),
  };
  if (!currentMessage) {
    currentMessage = messageToSend;
    sendMessage(functionName, callbAttached);
  }
  messagesData.push(messageToSend);
  if (!intervalToSendMessages) {
    // eslint-disable-next-line no-use-before-define
    intervalToSendMessages = setInterval(tryToSendNew, 500);
  }
};
/**
 * A function that writes a message.
 *
 * @param {string} functionName - the name of the function
 * @param {function} cb - callback function
 * @return {void}
 */
const writeMessage = (functionName, cb) => {
  addAndWait(functionName, cb);
};

exports.writeMessage = writeMessage;
