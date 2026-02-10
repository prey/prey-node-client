/**
 * ACK Queue Module
 * Manages the queue of acknowledgments waiting to be sent.
 */

const constants = require('../constants');
const { isConnectionReady } = require('../utils');

// State
let responsesAck = [];

/**
 * Get current ACK queue.
 * @returns {Array} - ACK queue array
 */
exports.getQueue = () => responsesAck;

/**
 * Set ACK queue (for backward compatibility).
 * @param {Array} queue - New queue array
 */
exports.setQueue = (queue) => {
  responsesAck = queue;
};

/**
 * Add ACK to queue.
 * @param {Object} ackData - ACK data to add
 */
exports.addAck = (ackData) => {
  responsesAck.push(ackData);
};

/**
 * Remove ACK from queue by ack_id.
 * @param {string} ackId - ACK ID to remove
 */
exports.removeAck = (ackId) => {
  responsesAck = responsesAck.filter((x) => x.ack_id !== ackId);
};

/**
 * Find ACK in queue by ack_id.
 * @param {string} ackId - ACK ID to find
 * @returns {Object|undefined} - Found ACK or undefined
 */
exports.findAck = (ackId) => responsesAck.find((x) => x.ack_id === ackId);

/**
 * Set retries value for ACK in queue.
 * @param {string} ackId - ACK ID to update
 */
exports.incrementRetries = (ackId) => {
  const index = responsesAck.findIndex((x) => x.ack_id === ackId);
  if (index >= 0) {
    responsesAck[index].retries += 1;
  }
};

/**
 * Send ACK to server.
 * @param {WebSocket} ws - WebSocket instance
 * @param {Object} sendToWs - ACK data to send
 * @param {Object} logger - Logger instance
 */
exports.sendAckToServer = (ws, sendToWs, logger) => {
  try {
    if (!isConnectionReady(ws)) return;
    // Check if ACK already exists and was sent
    const existing = exports.findAck(sendToWs.ack_id);
    if (existing && existing.sent) {
      // Don't send if already sent
      return;
    }

    if (!existing) {
      exports.addAck({
        ack_id: sendToWs.ack_id,
        type: sendToWs.type,
        retries: sendToWs.retries || 0,
        sent: false,
      });
    }

    const toSend = { ack_id: sendToWs.ack_id, type: sendToWs.type };
    ws.send(JSON.stringify(toSend));

    // Remove ACK from queue immediately after sending
    // Since server doesn't send ACK confirmations, we don't need to keep it in queue
    exports.removeAck(sendToWs.ack_id);
  } catch (error) {
    if (error) {
      logger.error('error to send ack:', JSON.stringify(error));
    }
  }
};

/**
 * Notify ACK - process and send acknowledgment.
 * @param {WebSocket} ws - WebSocket instance
 * @param {string} ackId - ACK ID
 * @param {string} type - ACK type
 * @param {string} id - Command ID
 * @param {boolean} sent - Whether already sent
 * @param {number} retries - Current retry count
 * @param {Object} logger - Logger instance
 */
exports.notifyAck = (ws, ackId, type, id, sent, retries = 0, logger) => {
  if (retries >= constants.MAX_ACK_RETRIES) {
    exports.removeAck(ackId);
    return;
  }

  // Since ACKs are removed immediately after sending,
  // if we're here it means we need to send a new ACK
  const newAck = {
    ack_id: ackId,
    type,
    id,
    sent: false,
    retries,
  };

  exports.sendAckToServer(ws, newAck, logger);
};

/**
 * Process array of ACKs from incoming message.
 * @param {Array} arr - Array of items to process
 * @param {WebSocket} ws - WebSocket instance (for immediate send)
 * @param {Object} ackModule - ACK processing module
 * @param {Object} logger - Logger instance
 */
exports.processAcks = (arr, ws, ackModule, logger) => {
  if (arr.forEach) {
    arr.forEach((el) => {
      ackModule.processAck(el, (err, sendToWs) => {
        if (err) {
          logger.error(`Error processing ack: ${err.message}`);
          return;
        }
        try {
          // Send ACK immediately (it will be removed from queue after sending)
          if (ws) {
            exports.sendAckToServer(ws, sendToWs, logger);
          }
        } catch (error) {
          logger.error(`Error sending ack: ${error}`);
        }
      });
    });
  }
};

/**
 * Retry all ACK responses.
 * @param {WebSocket} ws - WebSocket instance
 * @param {Object} logger - Logger instance
 */
exports.retryAckResponses = (ws, logger) => {
  // ACKs are removed immediately after sending, so this queue should be empty
  // This function is kept for backwards compatibility but shouldn't do anything
  if (responsesAck.length === 0) return;

  // If there are any ACKs still in queue (shouldn't happen), retry them
  responsesAck.forEach((respoAck) => {
    const newRetries = respoAck.retries + 1;
    exports.notifyAck(
      ws,
      respoAck.ack_id,
      respoAck.type,
      respoAck.id,
      respoAck.sent,
      newRetries,
      logger,
    );
  });
};

/**
 * Clear the ACK queue.
 */
exports.clearQueue = () => {
  responsesAck = [];
};
