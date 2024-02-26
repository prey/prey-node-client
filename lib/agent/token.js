/* eslint-disable consistent-return */
const needle = require('needle');
const keys = require('./control-panel/api/keys');
const errors = require('./control-panel/api/errors');
const specs = require('./reports/actions');
const config = require('../utils/configfile');

const protocol = config.getData('control-panel.protocol');
const host = config.getData('control-panel.host');
const url = `${protocol}://${host}/token/v2/check`;

exports.post_token = (opts, cb) => {
  if (!keys.get().api || !keys.get().device) return cb(errors.get('MISSING_KEY'));

  if (!opts) return cb(errors.arguments('Empty data.'));

  const existsAction = specs.actions.find((x) => x === opts.action);

  if (!existsAction) return cb(null);

  const options = {
    json: true,
  };

  const data = {
    key: keys.get().device,
    token: opts.token,
    action: opts.action,
  };

  needle.post(url, data, options, (errPost, resp) => {
    if (errPost) return cb(errPost);
    if (resp.statusCode !== 200) {
      const newErrPost = new Error('There was an error communicating with the server api Token');
      return cb(newErrPost);
    }
    return cb(null);
  });
};
