var fs       = require('fs'),
    actions  = require('./actions'),
    logger   = require('./common').logger.prefix('triggers');

var watchers = [],
    triggers_list;

var map = function(){

  if (triggers_list)
    return cb(null, triggers_list);

  fs.readdir(triggers_path, function(err, files){
    if (err) return cb(err);

    triggers_list = {};

    files.forEach(function(trigger_name) {
      var module = require(join(reports_path, report_name));

      triggers_list[trigger_name] = module.events;
      module.events.forEach(function(evt){
        events_list[evt] = trigger_name;
      });

    });

    cb(null, triggers_list);
  });

}

exports.add = function(trigger_name) {
  actions.start_trigger(trigger_name, function(err){
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

  logger.notice('Watching: ' + list.join(', '));
  list.forEach(exports.add);
}

exports.unwatch = function() {
  watchers.forEach(exports.remove)
}
