'use strict';

var keys = require('./plugins/control-panel/api/keys'),
  errors = require('./plugins/control-panel/api/errors'),
  specs = require('./reports/actions'),
  needle = require('needle');

const host = 'https://solid.preyproject.com',
  url = host + '/token/v2/check';

exports.post_token = (opts, cb) => {
  if (!keys.get().api || !keys.get().device)
    return cb(errors.get('MISSING_KEY'));

  if (!opts) return cb(errors.arguments('Empty data.'));

  var exists_action = specs.actions.find((x) => x == opts.action);

  if (!exists_action) return cb(null);

  var options = {
    json: true,
  };

  var data = {
    key: keys.get().device,
    token: opts.token,
    action: opts.action,
  };

  needle.post(url, data, options, function (err, resp) {
    if (err) return cb(err);

    if (resp.statusCode !== 200) {
      return cb(
        new Error('There was an error communicating with the server api Token')
      );
    }
    return cb(null);
  });
};
