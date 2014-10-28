
var common = require('../common'),
    shared = require('./shared'),
    config = common.config;

var log = function(str) {
  shared.log(str);
}

var no_config = function() {
  return new Error('Config file not found! Run `config activate` to build one.');
}

var update = function(key, val, cb) {
  if (!key)
    return cb(new Error('Key required.'));

  var current = config.get(key);

  if (!val)
    return cb(new Error('Please provide a value for ' + key + '. Current is `' + current + '`'));

  if (typeof current == 'undefined')
    return cb(new Error('Key not found in config: ' + key));

  if (typeof current == 'object')
    return cb(new Error(key + ' is an object. Valid subkeys are: ' + Object.keys(current).join(', ')));

  config.update(key, val, cb);
}

exports.list = function(values, cb) {
  if (!config.present())
    return cb(no_config())

  log(config.all());
}

exports.read = function(values, cb) {
  if (!config.present())
    return cb(no_config())

  if (!values.key)
    return cb(new Error('Key required.'));

  var val = config.get(values.key);
  if (typeof val == 'undefined')
    return cb(new Error(values.key + ' not found.'));

  log(val);
}

exports.update = function(values, cb) {
  if (!config.present())
    return cb(no_config())

  var key = values.positional[0],
      val = values.positional[1];

  update(key, val, cb); // does all the checks for us.
}

exports.toggle = function(values, cb) {
  if (!config.present())
    return cb(no_config())

  if (!values.key)
    return cb(new Error('Key required.'));

  var key     = values.key,
      current = config.get(key);

  if (typeof current == 'undefined')
    return cb(new Error(key + ' not found.'));
  else if (typeof current != 'boolean')
    return cb(new Error(key + ' is not boolean.'));

  config.update(key, !current, function(err) {
    cb(err, key + ' toggled: ' + current.toString() + ' -> ' + (!current).toString())
  })
}
