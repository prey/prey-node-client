var triggers  = require('os-triggers'),
    join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    providers = require(join(base_path, 'providers')),
    common    = require('./../../common'),
    logger    = common.logger.prefix('power'),
    toaster   = require('./../../utils/toaster'),
    Emitter   = require('events').EventEmitter;

var emitter,
    previous = {};

var toast_opts = {
  title: 'Prey',
  message: 'Device Enchufado/Desenchufado'
}

var check_battery_status = () => {

  providers.get('battery_status', (err, current) => {
    if (err || !emitter) return;

    // console.log('Current: ' + current.state);
    // console.log('Previous: ' + previous.state);

    if (current.state == 'charging' && previous.state != 'charging')
      emitter.emit('started_charging');
    else if (current.state == 'discharging' && previous.state != 'discharging')
      emitter.emit('stopped_charging');

    previous = current;
  });

};

exports.start = (opts, cb) => {

  triggers.watch('power')
    .catch(error => { return cb(error); })
    .then((power) => {
      power.on('state_changed', (info) => {
        logger.info("POWER CHANGED!")
        toaster.notify(toast_opts);
        setTimeout(check_battery_status, 1500);
      });

      power.on('low_power', (info) => {
        emitter.emit('low_battery');
      });

      emitter = new Emitter();
      cb(null, emitter);
    })
};

exports.stop = () => {
  triggers.unwatch('power');
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
};

exports.events = [ 'low_battery', 'started_charging', 'stopped_charging' ];
