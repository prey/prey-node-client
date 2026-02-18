/**
 * Command Queue Module
 * Prevents overlapping execution of commands of the same type.
 */

const constants = require('./constants');

// State: executing commands by target type
// Maps target -> commandId
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
      for (const [target, commandId] of executingCommands.entries()) {
        if (commandId === actionId) {
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
  // Check both command.body.target and command.target
  if (command.body && command.body.target) {
    return command.body.target;
  }
  if (command.target) {
    return command.target;
  }
  return 'unknown';
};


/**
 * Process command for execution.
 * @param {Object} command - Command object
 * @param {EventEmitter} emitter - Event emitter
 * @param {Object} logger - Logger instance
 * @returns {boolean} - Always true (ACK is always sent for received commands)
 */
exports.enqueueCommand = (command, emitter, logger) => {
  const target = getCommandTarget(command);
  const commandId = command.id;
  const commandType = command.body ? command.body.command : command.command;

  // Providers ('get', 'report', 'cancel') and 'stop' commands don't need tracking
  // - Providers execute immediately and return data
  // - 'stop' commands are instant operations that just stop other actions
  // - 'triggers' target doesn't emit standard action completion events
  const isProvider = ['get', 'report', 'cancel'].includes(commandType);
  const isStopCommand = commandType === 'stop';
  const isTriggersTarget = target === 'triggers';
  const skipTracking = isProvider || isStopCommand || isTriggersTarget;

  // Check if a command of this type is currently executing (only for tracked commands)
  if (!skipTracking && executingCommands.has(target)) {
    // Duplicate command - send ACK but do NOT execute
    const idMsg = commandId ? ` (id: ${commandId})` : '';
    logger.warn(`Command of type '${target}' already executing, ignoring duplicate${idMsg}`);

    // Emit event for monitoring purposes (command was received but not executed)
    emitter.emit('command_rejected', {
      command,
      reason: `Already running: ${target}`,
    });

    return true; // ACK sent to confirm reception, but command will NOT execute
  }

  // Execute immediately
  const idMsg = commandId ? ` (id: ${commandId})` : '';
  logger.info(`Executing command of type '${target}'${idMsg}`);

  // Track executing command (only for actions that need tracking)
  if (!skipTracking) {
    executingCommands.set(target, commandId);
  }

  emitter.emit('command', command);

  return true; // ACK will be sent
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
    executingId: executingCommands.has(target) ? executingCommands.get(target) : null,
  };
};

/**
 * Clear executing command for a target type.
 * @param {string} target - Target type
 */
exports.clearQueue = (target) => {
  executingCommands.delete(target);
};

/**
 * Clear all executing commands.
 */
exports.clearAllQueues = () => {
  executingCommands.clear();
};

/**
 * Get all execution status for debugging.
 * @returns {Object} - All execution status
 */
exports.getAllQueuesStatus = () => {
  const status = {};
  for (const [target, commandId] of executingCommands.entries()) {
    status[target] = {
      isExecuting: true,
      executingId: commandId,
    };
  }
  return status;
};
