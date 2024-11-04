const { EventEmitter } = require('events');
const common = require('../../common');
const api = require('../../control-panel/api');

const logger = common.logger.prefix('sync_settings');
const config = require('../../../utils/configfile');
const errorsActions = require('../../../constants/actions');

let emitter;

const done = (id, err) => {
  if (!emitter) emitter = new EventEmitter();
  emitter.emit('end', id, err);
};

const verifyNewDataForKey = (newData, oldData, cb) => {
  if (typeof newData !== 'undefined'
      && oldData !== newData) cb();
};

const process = (valuesFn, target, locals = false) => {
  const values = valuesFn;
  Object.keys(values).forEach((key) => {
    const newValue = locals ? `control-panel.${key}` : key;
    const valueConfigData = config.getData(newValue);
    if (values[key] == null) values[key] = false;
    verifyNewDataForKey(values[key], valueConfigData, () => {
      logger.notice(`Updating value of ${key} to ${values[key]}`);
      config.setData(newValue, values[key]);
    });
  });
};
const updateSettings = (obj) => {
  if (obj.global) process(obj.global, config);
  if (obj.local) process(obj.local, config, true);
};
// eslint-disable-next-line consistent-return
exports.start = (id, _opts, cb) => {
  cb();
  api.devices.get.status((err, response) => {
    if (err) return;
    const result = response && response.body;
    // eslint-disable-next-line consistent-return, max-len
    if (!result || (response && response.statusCode > 300)) return done(id, new Error(errorsActions.INVALID_RESPONSE));
    if (result.settings) {
      updateSettings(result.settings);
      // eslint-disable-next-line consistent-return
      return done(id);
    }
    done(id, new Error(errorsActions.RESPONSE_NOT_FOUND));
  });
};

exports.stop = () => {
};
