var shared = require('./shared');

var log = function(str) {
  shared.log(str);
}

var verify_data = function(hash) {
  var obj = {};

  for (var key in hash) {
    if (typeof hash[key] !== 'undefined')
      obj[key] = hash[key]
  }

  return obj;
}

// set api key and call setup so device gets linked
// called from cli.js after signing up or signing in
var set_api_key_and_register = function(key, cb) {

  // ensure the plugin is loaded if registration succeeds
  var success = function() {
    shared.plugin_manager.force_enable('control-panel', function(err) {
      cb();
    });
  }

  // set API key and clear Device key
  shared.keys.set_api_key(key, function(err) {
    if (err) return cb(err);

    log('Linking device...');
    shared.panel.link(function(err) {
      if (!err) return success();

      // ok, we got an error. clear the API key before returning.
      // call back the original error as well.
      shared.keys.set_api_key('', function(e) {
        cb(err);
      });
    });
  })
}

exports.authorize = function(values, cb) {

  var opts = {};
  var args = {
    api_key:  values['-a'],
    email:    values['-e'],
    password: values['-p']
  };

  if (args.email && !args.password)
    return cb(new Error('Password required.'));

  opts.username = args.email    || args.api_key;
  opts.password = args.password || 'x';

  shared.panel.authorize(opts, function(err, key) {
    if (err || !key)
      return cb(err || new Error("Couldn't verify credentials."));

    set_api_key_and_register(key, cb);
  });
}

exports.verify = function(values, cb) {
  var obj      = {},
      current  = values['-c'] === true,
      update   = values['-u'] === true;

  if (current) {
    obj        = shared.keys.get();
  } else {
    obj.api    = values['-a'];
    obj.device = values['-d'];
  }

  shared.panel.verify_keys(obj, function(err) {
    if (!err) log('Keys are A-OK.')

    // if error or just checking current (no need to update)
    // or no update requested, then just return
    if (err || current || !update) return cb(err);

    shared.keys.set(obj, cb);
  });
}

exports.signup = function(values, cb) {

  if (shared.keys.is_api_key_set())
    return cb(new Error('Account already set up!'));

  var data = verify_data({
    name:     values['-n'],
    email:    values['-e'],
    password: values['-p'],
    password_confirmation: values['-p'],
    country:  values['-c']
  });

  shared.panel.signup(data, function(err, key) {
    if (err || !key)
      return cb(err || new Error('No API Key received.'));

    log('Account created!');
    set_api_key_and_register(key, cb);
  });
}

exports.setup = function(values, cb) {
  var run_again = values['-f'] === true;

  if (shared.keys.is_api_key_set() && !run_again)
    return cb(new Error('Account already set up! Run with -f/--force to continue anyway.'));

  shared.plugin_manager.setup('control-panel', function(err) {
    if (err) return cb(err);

    log('Credentials verified.');
    shared.keys.set_device_key('', function(err) {
      if (err) return cb(err);

      log('Linking device...');
      shared.panel.link(cb);
    })

  })
}
