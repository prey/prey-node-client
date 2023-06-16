const storage = require('./utils/storage');
const ackType = 'ack';

const existKeyAckInJson = (json) => {
  //eslint-disable-next-line no-prototype-builtins
  if (json.hasOwnProperty('ack_id')) {
    return true;
  }
  return false;
};
const existKeyIdInJson = (json) => {
  //eslint-disable-next-line no-prototype-builtins
  if (json.hasOwnProperty('id')) {
    return true;
  }
  return false;
};

exports.processAck = (json, cb) => {
  if (!existKeyAckInJson(json)) {
    return cb(new Error('there is no key ack_id in the json'));
  }
  return cb(null, {
    ack_id: json.ack_id,
    type: ackType,
    id: existKeyIdInJson(json) ? json.id : '',
  });
};
