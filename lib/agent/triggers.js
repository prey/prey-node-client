var fs       = require('fs'),
    join     = require('path').join,
    actions  = require('./actions'),
    hooks    = require('./hooks'),
    logger   = require('./common').logger.prefix('triggers');

var watchers = [],
    events_list = {},
    triggers_list;

var triggers_path = join(__dirname, 'triggers');

var load_trigger = function(name) {
  try {
    return require(join(triggers_path, name));
  } catch(e) {
    hooks.trigger('error', e);
  }
}

exports.map = function(cb){

  if (triggers_list)
    return cb(null, triggers_list);

  fs.readdir(triggers_path, function(err, files){
    if (err) return cb(err);

    triggers_list = {};

    files.forEach(function(trigger_name) {
      if (trigger_name.match('README'))
        return;

      var module = load_trigger(join(triggers_path, trigger_name));
      if (!module) return;

      triggers_list[trigger_name] = module.events;

      module.events.forEach(function(evt){
        events_list[evt] = trigger_name;
      });

    });

    cb(null, events_list);
  });

}

exports.add = function(trigger_name) {
  actions.start_trigger(trigger_name, function(err) {
    if (!err)
      watchers.push(trigger_name);
  });
};

exports.remove = function(trigger_name) {
  actions.stop(trigger_name);
};

exports.watch = function(list, cb) {
  if (!list || !list[0])
    return cb && cb(new Error('Empty trigger list.'));

  logger.info('Watching: ' + list.join(', '));
  list.forEach(exports.add);
  cb && cb();
}

exports.unwatch = function() {
  watchers.forEach(exports.remove)
}
