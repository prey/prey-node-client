/**
 * WebSocket Message Handlers
 * Handles incoming messages and command processing.
 */

const { propagateError } = require('./utils');
const commandQueue = require('./command-queue');

/**
 * Handle incoming WebSocket message.
 * @param {string} data - Raw message data
 * @param {Object} context - Context object with dependencies
 * @param {Object} context.responseQueue - Response queue module
 * @param {Object} context.ackQueue - ACK queue module
 * @param {Object} context.storage - Storage module
 * @param {Object} context.ackModule - ACK processing module
 * @param {Object} context.hooks - Hooks module
 * @param {Object} context.logger - Logger instance
 * @param {EventEmitter} context.emitter - Event emitter
 * @returns {number|undefined} - 0 on success
 */
exports.handleMessage = (data, context) => {
  const {
    ws,
    responseQueue,
    ackQueue,
    storage,
    ackModule,
    hooks,
    logger,
    emitter,
  } = context;

  let parsedData;
  try {
    parsedData = JSON.parse(data);
    if (Object.keys(parsedData).length) {
      // Use debug level for simple OK acknowledgment messages (status: "OK" + id only)
      const isSimpleAck = parsedData.status === 'OK'
        && parsedData.id
        && Object.keys(parsedData).length === 2;

      if (isSimpleAck) {
        logger.debug(`message received from backend: ${JSON.stringify(parsedData)}`);
      } else {
        logger.info(`message received from backend: ${JSON.stringify(parsedData)}`);
      }
    }
  } catch (e) {
    propagateError(hooks, logger, 'Invalid command object');
    return undefined;
  }

  if (Array.isArray(parsedData)) {
    const len = parsedData.length;
    if (len && len > 0) {
      // Process commands and get list of accepted commands
      const acceptedCommands = commandQueue.processCommands(parsedData, emitter, logger);
      // Send ACKs for all commands (ACK confirms reception, not execution)
      ackQueue.processAcks(acceptedCommands, ws, ackModule, logger);
    }
    return 0;
  }

  if (parsedData.status && parsedData.status === 'OK') {
    const value = responseQueue.findInQueue(parsedData.id);
    if (value) {
      if (value.type === 'response') {
        storage.do('del', { type: 'responses', id: value.id });
      }
      responseQueue.removeFromQueue(parsedData.id);
    }
  }
  return 0;
};
