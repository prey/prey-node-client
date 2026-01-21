/**
 * WebSocket Notifications Module
 * Handles sending status and action notifications.
 */

const { v4: uuidv4 } = require('uuid');
const constants = require('./constants');
const { isConnectionReady } = require('./utils');

/**
 * Send device status notification.
 * @param {WebSocket} ws - WebSocket instance
 * @param {Object} status - Status data to send
 * @param {Object} logger - Logger instance
 */
exports.notifyStatus = (ws, status, logger) => {
  const data = {
    id: uuidv4(),
    type: 'device_status',
    time: new Date().toISOString(),
    body: status,
  };
  if (!isConnectionReady(ws)) return;
  logger.info("Sending device's status information");
  try {
    ws.send(JSON.stringify(data));
  } catch (ex) {
    logger.error(`error at notify_status: ${ex}`);
  }
};

/**
 * Send action notification.
 * @param {Object} context - Context with dependencies
 * @param {WebSocket} context.ws - WebSocket instance
 * @param {Object} context.storage - Storage module
 * @param {Object} context.responseQueue - Response queue module
 * @param {Object} context.logger - Logger instance
 * @param {Object} params - Action parameters
 * @param {string} params.status - Action status
 * @param {string} params.id - Action ID
 * @param {string} params.action - Action name
 * @param {Object} params.opts - Options
 * @param {Error} params.err - Error if any
 * @param {Object} params.out - Output data
 * @param {string} params.time - Timestamp
 * @param {string} params.respId - Response ID
 * @param {number} params.retries - Retry count
 * @param {boolean} params.fromWithin - Whether called from retry loop
 */
exports.notifyAction = (context, params) => {
  const { ws, storage, responseQueue, logger } = context;
  const {
    status,
    id,
    action,
    opts,
    err,
    out,
    time,
    respId,
    retries = 0,
    fromWithin = false,
  } = params;

  // Early returns for invalid cases
  if (!id || id === 'report' || action === 'triggers'
      || (action === 'factoryreset' && status === 'stopped')) {
    return;
  }

  // Check max retries
  if (retries >= constants.MAX_RETRIES) {
    storage.do('del', { type: 'responses', id: respId });
    responseQueue.removeFromQueue(respId);
    return;
  }

  // Build response object
  const toSend = {
    reply_id: `${id}`,
    type: 'response',
    body: { command: status, target: action, status },
    retries: retries + 1,
  };

  toSend.time = time || new Date().toISOString();
  if (toSend.time === 'NULL') toSend.time = new Date().toISOString();
  toSend.id = (respId && typeof respId !== 'undefined' && respId !== 'undefined')
    ? respId
    : uuidv4();

  // Handle output data
  if (out) {
    if (action === 'diskencryption') {
      toSend.body.reason = { encryption: out };
    } else if (action === 'factoryreset') {
      toSend.body.reason = { status_code: out.data, status_msg: out.message };
    } else if (action === 'fullwipe') {
      toSend.body.reason = { status_code: out.data, status_msg: out.message };
    }
  }

  // Handle errors
  if (err) {
    if (action === 'factoryreset') {
      toSend.body.reason = {
        status_code: (err.code) ? err.code : 1,
        status_msg: err.message,
      };
      toSend.body.status = 'stopped';
    } else if (action === 'diskencryption') {
      toSend.body.reason = { encryption: err };
    } else {
      toSend.body.reason = err.message;
    }
  }

  // Special handling for fullwipe actions
  if (action === 'fullwipe' || action === 'fullwipewindows') {
    if (err) {
      toSend.body = {
        command: toSend.body.command,
        status: 'stopped',
        reason: {
          status_code: (err.code) ? err.code : 1,
          status_msg: err.message,
        },
      };
    }
    if (opts) toSend.body.target = opts.target;
  }

  // Queue management
  const queuedResponse = responseQueue.findInQueue(toSend.id);
  if (!queuedResponse) {
    let optsTarget = opts ? opts.target : null;
    optsTarget = optsTarget || null;
    storage.do('set', {
      type: 'responses',
      id: toSend.id,
      data: {
        status: toSend.body.status,
        error: err ? JSON.stringify(err) : null,
        reason: toSend.body.reason ? JSON.stringify(toSend.body.reason) : null,
        out: out ? JSON.stringify(out) : null,
        opts: optsTarget,
        action,
        time: toSend.time,
        retries: toSend.retries,
        action_id: toSend.reply_id,
      },
    }, (errSet) => {
      if (errSet && Object.keys(errSet).length > 0) {
        logger.error(`Error storing the response: ${errSet}`);
      }
    });
    if (fromWithin) {
      responseQueue.addToMarkedToBePushed(toSend);
    } else {
      responseQueue.addToQueue(toSend);
    }
  } else {
    storage.do('update', {
      type: 'responses',
      id: toSend.id,
      columns: ['retries'],
      values: [toSend.retries + 1],
    }, (errUpdate) => {
      if (errUpdate && Object.keys(errUpdate).length > 0) {
        logger.error(`Error updating the response: ${errUpdate}`);
      }
    });
    queuedResponse.retries = toSend.retries + 1;
  }

  // Send if connection is ready
  if (!isConnectionReady(ws)) return;
  try {
    ws.send(JSON.stringify(toSend));
  } catch (ex) {
    logger.error(`error at notify_action: ${ex}`);
  }
};
