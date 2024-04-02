const { EventEmitter } = require('events');
const common = require('../../../common');
const socket = require('../../socket');
const permissionFile = require('../../../utils/permissionfile');

// eslint-disable-next-line camelcase
const { get_location } = require('../../providers/geo/darwin');

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
  // eslint-disable-next-line consistent-return
  socket.writeMessage(permissionFunction, () => {
    const permissionNative = permissionFile.getData('nativeLocation');
    if (permissionNative.localeCompare('false') !== 0 && permissionNative.localeCompare('true') !== 0) {
      get_location((err) => {
        done(id, err);
      });
    }
    done(id, null);
  });
};

exports.stop = () => {
  logger.info('inside stop');
};
