/**
 * Response Queue Module
 * Manages the queue of responses waiting to be sent/acknowledged.
 */

// State
let responsesQueue = [];
let markedToBePushed = [];

/**
 * Get current response queue.
 * @returns {Array} - Response queue array
 */
exports.getQueue = () => responsesQueue;

/**
 * Set response queue (for backward compatibility).
 * @param {Array} queue - New queue array
 */
exports.setQueue = (queue) => {
  responsesQueue = queue;
};

/**
 * Add response to queue.
 * @param {Object} response - Response object to add
 */
exports.addToQueue = (response) => {
  responsesQueue.push(response);
};

/**
 * Remove response from queue by ID.
 * @param {string} id - Response ID to remove
 */
exports.removeFromQueue = (id) => {
  responsesQueue = responsesQueue.filter((x) => x.id !== id);
};

/**
 * Find response in queue by ID.
 * @param {string} id - Response ID to find
 * @returns {Object|undefined} - Found response or undefined
 */
exports.findInQueue = (id) => responsesQueue.find((x) => x.id === id);

/**
 * Get marked to be pushed array.
 * @returns {Array}
 */
exports.getMarkedToBePushed = () => markedToBePushed;

/**
 * Reset marked to be pushed array.
 */
exports.resetMarkedToBePushed = () => {
  markedToBePushed = [];
};

/**
 * Add to marked to be pushed.
 * @param {Object} item - Item to add
 */
exports.addToMarkedToBePushed = (item) => {
  markedToBePushed.push(item);
};

/**
 * Merge marked items into main queue.
 */
exports.mergeMarkedToQueue = () => {
  responsesQueue = [...responsesQueue, ...markedToBePushed];
};

/**
 * Retry all queued responses.
 * @param {Function} notifyActionFn - Function to call for each response
 */
exports.retryQueuedResponses = (notifyActionFn) => {
  // First, move markedToBePushed items to the queue
  if (markedToBePushed.length > 0) {
    responsesQueue = [...responsesQueue, ...markedToBePushed];
    markedToBePushed = [];
  }

  if (responsesQueue.length === 0) return;

  responsesQueue.forEach((respQueued) => {
    notifyActionFn(
      respQueued.body.status,
      respQueued.reply_id,
      respQueued.body.target,
      respQueued.opts ? respQueued.opts : null,
      respQueued.error ? respQueued.error : null,
      respQueued.out ? respQueued.out : null,
      respQueued.time ? respQueued.time : null,
      respQueued.id ? respQueued.id : null,
      respQueued.retries ? respQueued.retries : null,
      true,
    );
  });
};

/**
 * Load responses from storage into queue, discarding entries older than MAX_RESPONSE_AGE.
 * @param {Object} storage - Storage module
 * @param {Object} constants - Constants module (for MAX_RESPONSE_AGE)
 * @param {Function} cb - Callback(err, actions)
 */
exports.loadFromStorage = (storage, constants, cb) => {
  storage.do('all', { type: 'responses' }, (err, actions) => {
    if (!actions || typeof actions === 'undefined') return cb(null, null);
    if (actions.length === 0 || err) return cb(err, []);

    const now = Date.now();
    const maxAge = constants.MAX_RESPONSE_AGE;

    const toLoad = Array.isArray(actions) ? actions : [actions];

    toLoad.forEach((element) => {
      const age = now - new Date(element.time).getTime();
      if (age > maxAge) {
        storage.do('del', { type: 'responses', id: element.id });
      }
    });

    responsesQueue = toLoad
      .filter((element) => now - new Date(element.time).getTime() <= maxAge)
      .map((element) => ({
        reply_id: `${element.action_id}`,
        type: 'response',
        out: element.out,
        error: element.error,
        opts: element.opts,
        body: { command: element.status, target: element.action, status: element.status },
        id: element.id,
        time: element.time,
        retries: element.retries,
      }));

    return cb(null, responsesQueue);
  });
};

/**
 * Clear the response queue.
 */
exports.clearQueue = () => {
  responsesQueue = [];
  markedToBePushed = [];
};
