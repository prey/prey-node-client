const retriesMaxAck = 4;
let responsesAck = [];
/**
 * Notifies the acknowledgement of a message.
 *
 * @param {string} ackId - The ID of the acknowledgement.
 * @param {string} _type - The type of the acknowledgement.
 * @param {string} id - The ID of the message.
 * @param {boolean} _sent - The sent status of the message.
 * @param {number} retries - The number of retries.
 * @return {Object | null} The acknowledgement object or null if retries exceed maximum.
 */
const notifyAck = (ackId, _type, id, _sent, retries = 0) => {
  if (retries >= retriesMaxAck) {
    exports.removeAckFromArray(ackId);
    return null;
  }

  if ((id && id !== '') || (ackId && ackId !== '')) {
    const ackResponse = responsesAck.filter(
      (x) => (x.id === id || x.ack_id === ackId) && x.sent === false,
    );

    if (ackResponse.length > 0) {
      ackResponse[0].retries += 1;
      return { ack_id: ackResponse[0].ack_id, type: ackResponse[0].type };
    }
  }

  return null;
};
/**
 * Processes the given JSON object and invokes the callback with the result.
 *
 * @param {Object} json - The JSON object to be processed.
 * @param {function(Error, Object)} cb - The callback function to be invoked.
 * @return {void}
 */
const processAck = (json, cb) => {
  if (!json.ack_id) {
    return cb(new Error('There is no key ack_id in the json'));
  }

  return cb(null, {
    ack_id: json.ack_id,
    type: 'ack',
    id: json.id || '',
  });
};
/**
 * Processes the array of messages and calls the processAck function for each element.
 *
 * @param {Array} messageArray - The array of messages to be processed.
 * @return {undefined} This function does not return a value.
 */
exports.processAcks = (messageArray) => {
  messageArray.forEach((el) => {
    // eslint-disable-next-line consistent-return
    processAck(el, (err, sendToWs) => {
      if (err) {
        return err;
      }

      responsesAck.push({
        ack_id: sendToWs.ack_id,
        type: sendToWs.type,
        id: sendToWs.id,
        sent: false,
        retries: 0,
      });
    });
  });
};

/**
 * Retrieves and returns the data to be acknowledged.
 *
 * @return {Array} An array containing the data to be acknowledged.
 */
exports.retryAckResponses = () => {
  // eslint-disable-next-line prefer-const
  let dataAck = [];
  if (responsesAck.length === 0) {
    return dataAck;
  }

  responsesAck.forEach((respoAck) => {
    const dataToNotify = notifyAck(
      respoAck.ack_id,
      respoAck.type,
      respoAck.id,
      respoAck.send,
      respoAck.retries,
    );

    if (dataToNotify) {
      dataAck.push(dataToNotify);
    }
  });

  return dataAck;
};
/**
 * Removes the specified ackId from the responsesAck array.
 *
 * @param {any} ackId - The ackId to be removed from the array.
 */
exports.removeAckFromArray = (ackId) => {
  responsesAck = responsesAck.filter((x) => x.ack_id !== ackId);
};
