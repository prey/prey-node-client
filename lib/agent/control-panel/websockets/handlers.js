/**
 * WebSocket Message Handlers
 * Handles incoming messages and command processing.
 */

const constants = require('./constants');
const { delay, propagateError } = require('./utils');

/**
 * Get structure signature for an object (for grouping).
 * Renamed from: obtenerFirmaEstructura
 * @param {Object} obj - Object to get signature for
 * @returns {string} - Structure signature
 */
const getStructureSignature = (obj) => {
  const allKeys = new Set();

  const collectKeys = (currentObj, prefix = '') => {
    const keysObj = Object.keys(currentObj);
    keysObj.sort((a, b) => a.localeCompare(b));

    keysObj.forEach((key) => {
      const fullKeyPath = prefix ? `${prefix}.${key}` : key;
      allKeys.add(fullKeyPath);

      if (typeof currentObj[key] === 'object'
          && currentObj[key] !== null
          && !Array.isArray(currentObj[key])) {
        collectKeys(currentObj[key], fullKeyPath);
      }
    });
  };

  collectKeys(obj);
  const sortedAllKeys = Array.from(allKeys).sort((a, b) => a.localeCompare(b));
  return sortedAllKeys.join('-');
};

/**
 * Group array of objects by their nested structure.
 * Renamed from: agruparPorEstructuraAnidada
 * @param {Array} arrayOfObjects - Array to group
 * @returns {Object} - Grouped objects by structure signature
 */
exports.groupByStructure = (arrayOfObjects) => {
  const groups = {};

  arrayOfObjects.forEach((objeto) => {
    const signature = getStructureSignature(objeto);
    if (!groups[signature]) {
      groups[signature] = [];
    }
    groups[signature].push(objeto);
  });

  return groups;
};

/**
 * Process array of commands and emit them with delay.
 * @param {Array} arr - Array of commands
 * @param {EventEmitter} emitter - Event emitter
 * @param {Object} hooks - Hooks module
 * @param {Object} logger - Logger instance
 */
exports.processCommands = (arr, emitter, hooks, logger) => {
  const groupedObjects = exports.groupByStructure(arr);
  Object.values(groupedObjects).forEach((groupOfObjects) => {
    if (Array.isArray(groupOfObjects)) {
      const emitWithDelay = (index) => {
        if (index >= groupOfObjects.length) return;
        emitter.emit('command', groupOfObjects[index]);
        delay(constants.COMMAND_DELAY, () => emitWithDelay(index + 1));
      };
      emitWithDelay(0);
    } else {
      propagateError(hooks, logger, 'Invalid command group structure');
    }
  });
};

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
      logger.info(`message received from backend: ${JSON.stringify(parsedData)}`);
    }
  } catch (e) {
    propagateError(hooks, logger, 'Invalid command object');
    return undefined;
  }

  if (Array.isArray(parsedData)) {
    const len = parsedData.length;
    if (len && len > 0) {
      exports.processCommands(parsedData, emitter, hooks, logger);
      ackQueue.processAcks(parsedData, ackModule, logger);
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
