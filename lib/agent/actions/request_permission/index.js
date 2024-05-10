const { EventEmitter } = require('events');
const common = require('../../../common');
const permissions = require('../../permissions');

let emitter;
const logger = common.logger.prefix('request_permission');
const done = (id, err) => {
  if (!emitter) emitter = new EventEmitter();
  emitter.emit('end', id, err);
};

// eslint-disable-next-line consistent-return
exports.start = (id, opts, cb) => {
  // eslint-disable-next-line consistent-return
  cb();
  if (!opts.name) return done(id, new Error('Invalid permission name'));
  switch (opts.name) {
    case 'native_location':
      permissions.requestNativeLocation((err) => {
        done(id, err);
      });
      break;
    default:
      done(id, new Error('Invalid permission name'));
  }
};

exports.stop = () => {
  logger.info('inside stop');
};
