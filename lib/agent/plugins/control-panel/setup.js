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

    api.devices.link(data, function(err, key){
      if (err || !key)
        return cb(err || new Error('Something happened. Could not register.'));

      logger.warn('Device succesfully created. Key: ' + key);
      common.config.update('device_key', key, cb);
    });

  });

};

var get_device_data = function(callback){

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

// we know we have a verified device, so let's give some love to it.
// get OS version and real name and add it to the user agent
var decorate_api = function(cb) {
  agent.system.get_os_info(function(err, data) {
    var os_info = err ? system.os_name : [data.name, data.version].join(' ');

    agent.api.use({
      logger: agent.logger,
      user_agent : 'Prey/' + agent.version + ' (' + os_info + ', Node.js ' + process.version + ')'
    })

    cb();
  })
}

module.exports = function(common, cb) {
  if (running) return cb(new Error('Setup in progress.'));

  var done = function(err) {
    running = false;
    return err ? cb(err) : decorate_api(cb);
  }

  running = true;
  agent   = common;

  var keys = {
    api    : common.config.get('api_key'),
    device : common.config.get('device_key')
  }

  // set the keys and get a callback if api is empty
  agent.api.keys.set(keys, function(err) {
    // if api is empty or both are present, return
    if (err || agent.api.keys.present())
      return done(err);

    if (obj.logger)
      logger = obj.logger;

    agent.config.writable(function(yes) {
      if (!yes) throw(new Error('Config not writable. Cannot setup client.'))

      // if we called api.keys.verify() above, make sure API key is set before linking.
      // api.keys.set({ api: keys.api });

      link_device(function(err) {
        if (err) logger.error('Unable to register device: ' + err.message);
        done(err);
      });
    })
  })

};
