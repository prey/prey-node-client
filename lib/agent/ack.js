const ackType = 'ack';

const existKeyAckInJson = (json) => Object.hasOwn(json, 'ack_id');

exports.processAck = (json, cb) => {
  if (!existKeyAckInJson(json)) return cb(new Error('there is no key ack_id in the json'));

  const { ack_id: ackId, id = '' } = json;

  return cb(null, {
    ack_id: ackId,
    type: ackType,
    id,
  });
};

exports.existKeyAckInJson = existKeyAckInJson;
