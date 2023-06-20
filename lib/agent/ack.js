const retriesMaxAck = 4;
let responsesAck = [];

const existKeyAckInJson = (json) => {
  if (json.ack_id) {
    return true;
  }
  return false;
};
const existKeyIdInJson = (json) => {
  if (json.id) {
    return true;
  }
  return false;
};

// try {
//   if (!ws || !ws.readyState || ws.readyState !== 1) return;
//   const toSend = exports.notifyAck()
//   ws.send(JSON.stringify(toSend));
//   exports.removeAckFromArray(sendToWs.ack_id);
// } catch (error) {
//   logger.error(`
//   Error sending ACK to server: ${JSON.stringify(error)}`);
// }

// eslint-disable-next-line consistent-return
const notifyAck = (ackId, _type, id, _sent, retries = 0) => {
  if (retries >= retriesMaxAck) {
    return exports.removeAckFromArray(ackId);
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
};

const processAck = (json, cb) => {
  if (!existKeyAckInJson(json)) {
    return cb(new Error('there is no key ack_id in the json'));
  }
  return cb(null, {
    ack_id: json.ack_id,
    type: 'ack',
    id: existKeyIdInJson(json) ? json.id : '',
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

exports.retryAckResponses = () => {
  if (responsesAck.length === 0) return;

  responsesAck.forEach((respoAck) => {
    notifyAck(
      respoAck.ack_id,
      respoAck.type,
      respoAck.id,
      respoAck.send,
      respoAck.retries
    );
  });
};

exports.removeAckFromArray = (ackId) => {
  responsesAck = responsesAck.filter((x) => x.ack_id !== ackId);
};
