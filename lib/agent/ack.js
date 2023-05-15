const storage = require('./utils/storage');

const existKeyAckInJson = (json) => {
  // eslint-disable-next-line no-prototype-builtins
  if (json.hasOwnProperty('ack_id')) {
    return true;
  }
  return false;
};

exports.processAck = (json, cb) => {
  if (!existKeyAckInJson(json)) {
    return cb(new Error('there is no key ack_id in the json'));
  }
  exports.verifyIfExistId(json.ack_id, (err, exist) => {
    if (err) return cb(new Error(err));
    if (exist) return cb(new Error('ack_id already exists!'));
    exports.registerAck(json, (errRegister, registered) => {
      if (errRegister) return cb(new Error(errRegister));
      return cb(null, registered);
    });
  });
};

exports.updateAck = (json, cb) => {
  storage.do('update', {
    type: 'ack',
    id: json.ack_id,
    columns: ['retries'],
    values: [json.retries + 1],
  }, (err) => {
    if (err) return cb(new Error(err));
    return cb && cb(null, {
      ack_id: json.ack_id,
      type: json.type,
      retries: json.retries + 1,
    });
  });
};

exports.registerAck = (json, cb) => {
  storage.do(
    'set',
    { type: 'ack', id: json.ack_id, data: { id: json.ack_id, type: 'ack', retries: json.retries } },
    (err) => {
      if (err) return cb(new Error(err));
      return cb(null, {
        ack_id: json.ack_id,
        type: 'ack',
        retries: json.retries,
      });
    },
  );
};

exports.verifyIfExistId = (ackId, cb) => {
  storage.do(
    'query',
    { type: 'ack', column: 'id', data: ackId },
    (err, rows) => {
      if (err) return cb(err);

      if (rows && rows.length === 0) { return cb(null, false); } return cb(null, true);
    },
  );
};
