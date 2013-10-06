var api       = require('./api'),
    hostname  = require('os').hostname,
    system    = require('./system'),
    common; // need to load later, because common loads this guy

var running   = false;
var logger = {};

['debug', 'info', 'warn', 'error'].forEach(function(k) {
  logger[k] = console.log
})

var link_device = function(cb){

  get_device_data(function(err, data){
    if (err) return cb(err);

    data.name = hostname().replace(/\.local$/, ''); // remove tailing '.local'
    data.type = data.firmware_info && data.firmware_info.device_type || 'Laptop';

    api.devices.link(data, function(err, keys){
      if (err || !keys.device)
        return cb(err || new Error('Something happened. Could not register.'));

      logger.warn('Device succesfully created. Key: ' + keys.device);
      common.config.update('device_key', keys.device, cb);
    });

  });

};

var get_device_data = function(callback){

  var providers = require('./agent/providers');

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

  providers.get('specs', function(err, data) {
    done(err, { specs: data });
  });

  system.get_os_name(function(err, name) {
    var name = name.replace('LinuxMint', 'Ubuntu');
    done(err, { os: name })
  });

  system.get_os_version(function(err, ver) {
    done(err, { os_version: ver })
  });

};

// we know we have a verified device, so let's give some love to it.
// get OS version and real name and add it to the user agent
var decorate_api = function(cb) {
  system.get_os_info(function(err, data) {
    var os_info = err ? system.os_name : [data.name, data.version].join(' ');

    api.use({
      logger: common.logger,
      user_agent : 'Prey/' + common.version + ' (' + os_info + ', Node.js ' + process.version + ')'
    })

    cb();
  })
}

module.exports = function(obj, cb) {
  if (running) return cb(new Error('Setup in progress.'));

  var done = function(err) {
    running = false;
    return err ? cb(err) : decorate_api(cb);
  }

  running = true;
  common  = obj;

  var keys = {
    api    : common.config.get('api_key'),
    device : common.config.get('device_key')
  }

  // logger.info('Setting up API keys...');
  
  api.keys.verify(keys, function(err) {
    if (!err || (err.code != 'NO_DEVICE_KEY' && err.code != 'INVALID_DEVICE_KEY'))
      return done(err);

    if (obj.logger)
      logger = obj.logger;

    common.config.writable(function(yes) {
      if (!yes) throw(new Error('Config not writable. Cannot setup client.'))

      // make sure API key is set before linking.
      api.keys.set({ api: keys.api });

      link_device(function(err) {
        if (err) logger.error('Unable to register device: ' + err.message);
        done(err);
      });
    })
  })

};
