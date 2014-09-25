var api = require('./api');

var agent;
var running   = false;
var logger = {};

['debug', 'info', 'warn', 'error'].forEach(function(k) {
  logger[k] = console.log
})

var link_device = function(cb){

  get_device_data(function(err, data){
    if (err) return cb(err);

    data.name = agent.system.get_device_name();
    data.type = data.firmware_info && data.firmware_info.device_type || 'Laptop';

    api.devices.link(data, function(err, key) {
      if (err || !key)
        return cb(err || new Error('Something happened. Could not register.'));

      logger.warn('Device succesfully linked. Key: ' + key);
      agent.config.update('device_key', key, cb);
    });

  });

};

var get_device_data = function(callback) {

  logger.info('Gathering device data...');
  var e, data = {}, count = 3;

  var done = function(err, new_data) {
    if (err) {
      e = err;
    } else {
      for (var key in new_data) {
        data[key] = new_data[key];
      }
    }
    --count || callback(e, data);
  }

  agent.providers.get('specs', function(err, data) {
    done(err, { specs: data });
  });

  agent.system.get_os_name(function(err, name) {
    done(err, { os: name })
  });

  agent.system.get_os_version(function(err, ver) {
    done(err, { os_version: ver })
  });

};

// get OS version and real name and add it to the user agent
var setup_api = function(cb) {
  agent.system.get_os_info(function(err, data) {
    var os_info = err ? agent.system.os_name : [data.name, data.version].join(' ');

    api.use({
      // client: agent.transports.http,
      logger: agent.logger,
      user_agent : 'Prey/' + agent.version + ' (' + os_info + ', Node.js ' + process.version + ')'
    })

    cb && cb();
  })
}

var setup_keys = function(cb) {

  var done = function(err) {
    cb(err, keys);
  }

  var keys = {
    api    : agent.config.get('api_key'),
    device : agent.config.get('device_key')
  }

  if (keys.api && keys.api.toString().trim() != '')
    return done();

  // ok, so not found. let's see if we have them from the previous configuration
  if (!agent.config.global)
    return done(new Error('No global keys found.'))

  var keys = {
    api    : agent.config.global.get('api_key'),
    device : agent.config.global.get('device_key')
  }

  // if found, move keys to new placeholders, and save config.
  if (keys.api && keys.api.toString().trim() != '') {
    agent.config.global.set('api_key', '');
    agent.config.global.set('device_key', '');
    agent.config.set('api_key', keys.api);
    agent.config.set('device_key', keys.device);

    return agent.config.save(done);
  }

  done();
}

exports.start = function(common, cb) {
  if (running) return cb(new Error('Setup in progress.'));

  var done = function(err) {
    running = false;
    cb(err);
  }

  running = true;
  agent   = common;
  logger  = common.logger;

  // check existing or keys from previous config file.
  setup_keys(function(err, keys) {
    if (err) return done(err);

    setup_api(function() {

      api.keys.set(keys, function(err) {

        // if api is empty or both are present, stop here.
        if (err || api.keys.present())
          return done(err);

        link_device(function(err) {
          if (err) logger.error('Unable to register device: ' + err.message);
          done(err);
        });

      });

    });

  });

};
