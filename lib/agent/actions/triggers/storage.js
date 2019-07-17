var common  = require('./../../common'),
    storage = require('./../../utils/storage'),
    logger  = common.logger.prefix('triggers');

exports.store = (trigger, cb) => {
  var opts = {
    id: trigger.id,
    name: trigger.name,
    automation_events: trigger.automation_events,
    automation_actions: trigger.automation_actions
  }
  var key = ['trigger', opts.id].join('-');
  storage.set(key, opts, cb);
}

exports.clear_triggers = (cb) => {
  storage.clear('triggers', (err) => {
    if (err) logger.error(err.message);
    return cb() && cb(err);
  });
}

exports.get_triggers = (cb) => {
  storage.all('triggers', (err, triggers) => {

    if (err) return cb(new Error("Error retrieving triggers from local database"));

    var myData = Object.keys(triggers).map(key => {
        return triggers[key];
    })

    return cb(null, myData);
  })
}
