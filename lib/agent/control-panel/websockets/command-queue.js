/**
 * Command Queue Module
 * Manages sequential execution of commands to prevent overlapping actions of the same type.
 */

const constants = require('./constants');
const { delay } = require('./utils');

// State: executing commands by target type
// Maps target -> {id, timeout}
const executingCommands = new Map();
let hooks = null;

/**
 * Initialize command queue with hooks.
 * @param {Object} hooksModule - Hooks module for listening to action events
 */
exports.initialize = (hooksModule) => {
  if (hooks) return; // Already initialized

  hooks = hooksModule;

  // Listen for action completion events
  hooks.on('action', (event, actionId) => {
    if (event === 'stopped' || event === 'failed') {
      // Find and remove the completed action from executingCommands
      for (const [target, data] of executingCommands.entries()) {
        if (data.id === actionId) {
          if (data.timeout) clearTimeout(data.timeout);
          executingCommands.delete(target);
          break;
        }
      }
    }
  });
};

/**
 * Get the target/type key from a command.
 * @param {Object} command - Command object
 * @returns {string} - Target key (e.g., "alert", "lock")
 */
const getCommandTarget = (command) => {
  if (command.body && command.body.target) {
    return command.body.target;
  }
  return 'unknown';
};


/**
 * Add command to execution queue.
 * @param {Object} command - Command object
 * @param {EventEmitter} emitter - Event emitter
 * @param {Object} logger - Logger instance
 * @returns {boolean} - True if command was accepted, false if rejected
 */
exports.enqueueCommand = (command, emitter, logger) => {
  const target = getCommandTarget(command);
  const commandId = command.id;

  // Check if a command of this type is currently executing
  if (executingCommands.has(target)) {
    // Reject the command - don't queue it
    logger.warn(`Command of type '${target}' already executing, rejecting duplicate command (id: ${commandId})`);

    // Emit a rejection event so it can be handled (e.g., send error response)
    emitter.emit('command_rejected', {
      command,
      reason: `Already running: ${target}`,
    });

    return false;
  }

  // Execute immediately
  logger.info(`Executing command of type '${target}' immediately (id: ${commandId})`);

  // Set a safety timeout in case action events don't fire
  const timeoutId = setTimeout(() => {
    if (executingCommands.has(target)) {
      logger.warn(`Action '${target}' (id: ${commandId}) didn't send completion event, cleaning up after timeout`);
      executingCommands.delete(target);
    }
  }, constants.COMMAND_EXECUTION_DELAY || 30000); // 30 seconds default safety timeout

  executingCommands.set(target, {
    id: commandId,
    timeout: timeoutId,
  });

  emitter.emit('command', command);

  return true;
};

/**
 * Process array of commands through the queue.
 * @param {Array} commands - Array of command objects
 * @param {EventEmitter} emitter - Event emitter
 * @param {Object} logger - Logger instance
 * @returns {Array} - Array of accepted commands
 */
exports.processCommands = (commands, emitter, logger) => {
  if (!Array.isArray(commands)) {
    logger.error('processCommands expects an array');
    return [];
  }

  const acceptedCommands = [];
  commands.forEach((command) => {
    const accepted = exports.enqueueCommand(command, emitter, logger);
    if (accepted) {
      acceptedCommands.push(command);
    }
  });

  return acceptedCommands;
};

/**
 * Get current execution status for a target type.
 * @param {string} target - Target type
 * @returns {Object} - Execution status
 */
exports.getQueueStatus = (target) => {
  return {
    isExecuting: executingCommands.has(target),
    executingId: executingCommands.has(target) ? executingCommands.get(target).id : null,
  };
};

/**
 * Clear executing command for a target type.
 * @param {string} target - Target type
 */
exports.clearQueue = (target) => {
  const data = executingCommands.get(target);
  if (data && data.timeout) {
    clearTimeout(data.timeout);
  }
  executingCommands.delete(target);
};

/**
 * Clear all executing commands.
 */
exports.clearAllQueues = () => {
  for (const data of executingCommands.values()) {
    if (data.timeout) {
      clearTimeout(data.timeout);
    }
  }
  executingCommands.clear();
};

/**
 * Get all execution status for debugging.
 * @returns {Object} - All execution status
 */
exports.getAllQueuesStatus = () => {
  const status = {};
  for (const [target, data] of executingCommands.entries()) {
    status[target] = {
      isExecuting: true,
      executingId: data.id,
    };
  }
  return status;
};
