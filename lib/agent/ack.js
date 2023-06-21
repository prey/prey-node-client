const retriesMaxAck = 4;
let responsesAck = [];

const notifyAck = (ackId, _type, id, _sent, retries = 0) => {
  if (retries >= retriesMaxAck) {
    exports.removeAckFromArray(ackId);
    return null;
  }

  if ((id && id !== '') || (ackId && ackId !== '')) {
    const ackResponse = responsesAck.filter(
      (x) => (x.id === id || x.ack_id === ackId) && x.sent === false
    );

    if (ackResponse.length > 0) {
      ackResponse[0].retries += 1;
      return { ack_id: ackResponse[0].ack_id, type: ackResponse[0].type };
    }
  }

  return null;
};

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

///
// exports
///
// logger.error(`Error processing ACK ${JSON.stringify(err)}`);
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

// Changed this function to allow to create
// an array of the ack messages needed to be
// sent to the server. As I said on websockets/index.js
// not sure it's the cleanest way to do it
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
      respoAck.retries
    );

    if (dataToNotify) {
      dataAck.push(dataToNotify);
    }
  });

  return dataAck;
};

exports.removeAckFromArray = (ackId) => {
  responsesAck = responsesAck.filter((x) => x.ack_id !== ackId);
};
