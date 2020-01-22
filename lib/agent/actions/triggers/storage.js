var common  = require('./../../common'),
    storage = require('./../../utils/storage'),
    logger  = common.logger.prefix('triggers');

exports.store = (trigger, cb) => {
  var opts = {
    id:                 trigger.id,
    name:               trigger.name,
    persist:            trigger.persist,
    synced_at:          trigger.synced_at,
    last_exec:          trigger.last_exec,
    automation_events:  trigger.automation_events,
    automation_actions: trigger.automation_actions
  }
  var key = ['trigger', opts.id].join('-');
  storage.set(key, opts, cb);
}

exports.update = (id, name, persist, events, actions, synced, del, add, cb) => {
  var key = ["trigger", id].join("-");

  if (del != add) {
    var trigger_del,
        trigger_add,
        obj_del = {},
        obj_add = {},

    trigger_del = {
      "id": id,
      "name": name,
      "persist": persist,
      "automation_events": events,
      "automation_actions": actions,
      "synced_at": synced,
      "last_exec": del
    }
    trigger_add = {
      "id": id,
      "name": name,
      "persist": persist,
      "automation_events": events,
      "automation_actions": actions,
      "synced_at": synced,
      "last_exec": add
    }

    obj_del[key] = trigger_del;
    obj_add[key] = trigger_add;

    storage.update(key, obj_del, obj_add, cb);
q
  } else {
    return cb(null);
  }
}

exports.del = function(id) {
  var key = ['trigger', id].join('-');
  logger.debug('Removing trigger from DB: ' + id);
  storage.del(key);
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
