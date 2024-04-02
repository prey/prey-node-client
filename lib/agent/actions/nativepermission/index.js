const { EventEmitter } = require('events');
const common = require('../../../common');
const socket = require('../../socket');
const permissionFile = require('../../../utils/permissionfile');

const emitter = new EventEmitter();
const logger = common.logger.prefix('osquery');
const osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
const permissionFunction = 'check-location-perms';
const done = (id, err) => {
  if (emitter) emitter.emit('end', id, err);
};

// eslint-disable-next-line consistent-return
exports.start = (id, opts, cb) => {
  if (osName.localeCompare('mac') !== 0) return cb(new Error('Action only allowed on MacOS'));
  logger.info('inside start');
  // eslint-disable-next-line consistent-return
  socket.writeMessage(permissionFunction, () => {
    const permissionNative = permissionFile.getData('nativeLocation');
    if (permissionNative.localeCompare('') === 0) {
      logger.info('No permissions granted');
      return done(id, new Error('No permissions granted'));
    }
    done(id, null);
  });
};

exports.stop = () => {
  logger.info('inside stop');
};
