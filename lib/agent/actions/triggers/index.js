'use strict';

var schedule = require('node-schedule'),
  EventEmitter = require('events').EventEmitter,
  logger = require('./../../common').logger.prefix('triggers'),
  api = require('./../../plugins/control-panel/api'),
  hooks = require('./../../hooks'),
  commands = require('./../../commands'),
  storage = require('./../../utils/storage'),
  lp = require('./../../plugins/control-panel/long-polling');

var emitter,
  running_triggers = [],
  event_triggers = {},
  refreshing = false;

var da_triggers;

var events_list = [
  'connected',
  'disconnected',
  'geofencing_in',
  'geofencing_out',
  'new_location',
  'mac_address_changed',
  'ssid_changed',
  'private_ip_changed',
  'low_battery',
  'started_charging',
  'stopped_charging',
  'hardware_changed',
  'device_unseen'
];

var error_status_list = {
  0: 'Unknown error',
  1: 'Success!',
  2: 'Invalid trigger format',
  3: 'Cant set trigger into the past!',
  4: "The execution range dates doesn't make sense.",
  5: 'Unavailable event for Node Client.',
  6: 'Persisting action!'
};

function fetch_triggers(cb) {
  api.devices.get.triggers(cb);
}

function done(id, err, cb) {
  refreshing = false;
  if (emitter) {
    setTimeout(() => {
      emitter.emit('end', id, err);
    }, 1000);
  }

  if (cb && typeof cb == 'function') return cb() && cb(err);
  else return null;
}

function send_response(status, id_list) {
  var data = {
    status: status,
    command: 'start',
    target: 'triggers',
    reason: JSON.stringify(id_list)
  };
  api.push['response'](data);
}

function cancel_hooks() {
  if (Object.keys(event_triggers).length == 0) return;

  Object.keys(event_triggers).forEach((event) => {
    hooks.remove(event);
  });
}

function check_repeat(date, repeat) {
  var limit;
  try {
    var hour_from = repeat.hour_from,
      hour_until = repeat.hour_until,
      date_from = date.setHours(hour_from.slice(0, 2), hour_from.slice(2, 4), hour_from.slice(4, 6)),
      date_until = date.setHours(hour_until.slice(0, 2), hour_until.slice(2, 4), hour_until.slice(4, 6));

    limit = {from: date_from, until: date_until};
  } catch (e) {
    limit = {};
  }
  return limit;
}

function check_range_format(from, until) {
  if (from > until) return false;
  return true;
}

function check_repeat_format(days, hour_from, hour_until, until) {
  if (days.some(isNaN)) return false;
  else if (hour_from.length != 6 || hour_until.length != 6) return false;
  else if (until && until.length != 8) return false;
  else return true;
}

function check_rules(rule) {
  if (rule.second && (rule.second < 0 || rule.second > 60)) return false;
  if (rule.minute && (rule.minute < 0 || rule.minute > 60)) return false;
  if (rule.hour && (rule.hour < 0 || rule.hour > 24)) return false;
  if (rule.dayOfWeek.some((elem) => elem > 6 || elem < 0)) return false;
  return true;
}

function run_trigger_actions(trigger) {
  // Update last_exec
  storage.do('update', {type: 'triggers', id: trigger.id, columns: 'last_exec', values: new Date().getTime()}, () => {
    send_response('stopped', [trigger.id]);
    storage.do('del', {type: 'triggers', id: trigger.id});
    return;
  });

  trigger.automation_actions.forEach((action) => {
    run_action(trigger, action);
  });
}

function run_action(trigger, action) {
  var timeout = 0;

  if (action.delay && action.delay > 0) timeout = action.delay;

  setTimeout(() => {
    if (action.action.options) action.action.options.trigger_id = trigger.id;
    commands.perform(action.action);
  }, timeout);
}

exports.cancel_all = () => {
  if (running_triggers.length > 0) {
    running_triggers.forEach((trigger) => {
      trigger.cancel();
    });
    running_triggers = [];
  }
  cancel_hooks();
};

function to_unix(date) {
  var new_date;
  try {
    if (/^\d+$/.test(date)) {
      var year = parseInt(date.slice(0, 4)),
        month = parseInt(date.slice(4, 6)) - 1, // January its 0
        day = parseInt(date.slice(6, 8)),
        hour = parseInt(date.slice(8, 10)),
        minute = parseInt(date.slice(10, 12)),
        second = parseInt(date.slice(12, 14)),
        timezone_offset = new Date().getTimezoneOffset() * 60 * 1000; // miliseconds

      new_date = new Date(Date.UTC(year, month, day, hour, minute, second)).getTime() + timezone_offset;
    } else {
      date = date.split('Z');
      if (date.length > 1) {
        if (date[1].length > 0) date = date[1].charAt(0) == '-' ? date.join('') : date.join('+');
        else date = date[0];
      }
      new_date = new Date(date).getTime();
    }
  } catch (e) {
    new_date = NaN;
  }
  return parseInt(new_date);
}

function set_up_hooks() {
  if (Object.keys(event_triggers).length == 0) return;

  Object.keys(event_triggers).forEach((event) => {
    hooks.on(event.split('-')[0], (info) => {
      if (info && info.id && event.split('-')[1] != info.id) return;

      event_triggers[event].forEach((action) => {
        var timeout = 0;
        if (action.delay && action.delay > 0) timeout = action.delay;

        var date = new Date();
        if (action.repeat) {
          if (action.repeat.days_of_week.indexOf(date.getDay()) == -1) return;

          var aux_date = new Date(date.valueOf());
          var dates = check_repeat(aux_date, action.repeat);

          if (Object.keys(dates).length == 0 || date.getTime() < dates.from || date.getTime() > dates.until) return;
        }

        if (action.after) {
          var last_connection = lp.last_connection();
          if (!last_connection) {
            logger.info('No last connection to server registered');
            return;
          }

          if (last_connection + action.after > Math.round(Date.now() / 1000)) return;

          // Don't do if it was already executed
          var trigger_index = da_triggers.findIndex((obj) => obj.id === action.trigger_id);
          if (da_triggers[trigger_index].last_exec) return;

          var exec_time = new Date().getTime();
          da_triggers[trigger_index].last_exec = exec_time;

          var current = da_triggers[trigger_index];
          storage.do('update', {type: 'triggers', id: current.id, columns: 'synced_at', values: exec_time}, (err) => {
            if (err) logger.info('Unable to update the execution time');
          });
        }

        if (action.range) {
          var date_from = action.range.from,
            date_until = action.range.until;

          if (isNaN(date_from) || isNaN(date_until) || date.getTime() < date_from || date.getTime() > date_until)
            return;
        }

        setTimeout(() => {
          if (action.action.options) action.action.options.trigger_id = action.trigger_id;
          commands.perform(action.action);
        }, timeout);
      });
    });
  });
}

exports.activate_event = (trigger) => {
  try {
    var event_index = trigger.automation_events.findIndex((obj) => events_list.indexOf(obj.type) > -1);
  } catch (e) {
    return 2;
  }
  if (event_index == -1) return 5;

  var event = trigger.automation_events[event_index].type;
  var info = trigger.automation_events[event_index].info;

  if (!event_triggers[event]) {
    if (info && info.id) event = [event, info.id].join('-');
    event_triggers[event] = [];
  }

  trigger.automation_actions.forEach((action) => {
    // If there's an element with type 'repeat_range_time' we keep the index
    var index_repeat = trigger.automation_events.findIndex((obj) => obj.type === 'repeat_range_time'),
      index_range = trigger.automation_events.findIndex((obj) => obj.type === 'range_time'),
      index_after = trigger.automation_events.findIndex((obj) => obj.type === 'after_time');

    if (index_after > -1) {
      var seconds = trigger.automation_events[index_after].info.seconds;
      action.after = seconds;
    }

    if (index_repeat > -1) {
      var days = JSON.parse(trigger.automation_events[index_repeat].info.days_of_week),
        hour_from = trigger.automation_events[index_repeat].info.hour_from,
        hour_until = trigger.automation_events[index_repeat].info.hour_until.slice(0, -2) + '59', // Include that last minute
        until = trigger.automation_events[index_repeat].info.until;

      if (until) {
        var year = parseInt(until.slice(0, 4)),
          month = parseInt(until.slice(4, 6)) - 1, // January its 0
          day = parseInt(until.slice(6, 8)) + 1; // One more day, until next day at 00:00

        var end_date = new Date(year, month, day),
          current_date = new Date();

        if (current_date > end_date) return 3;
      }

      if (!check_repeat_format(days, hour_from, hour_until, until)) return 4;

      action.repeat = {days_of_week: days, hour_from: hour_from, hour_until: hour_until, until: until};
    }

    if (index_range > -1) {
      var date_from = to_unix(trigger.automation_events[index_range].info.from + '000000'),
        date_until = to_unix(trigger.automation_events[index_range].info.until + '235959');

      if (current_date > date_until) return 2;
      if (!check_range_format(date_from, date_until)) return 4;
      action.range = {from: date_from, until: date_until};
    }

    action.trigger_id = trigger.id;
    event_triggers[event].push(action);
  });

  return 1;
};

/**
 * activates the trigger in prey's control panel
 * @param {object} trigger - the object with trigger info
 */
exports.activate = (trigger) => {
  try {
    var index = trigger.automation_events.findIndex((obj) => obj.type === 'exact_time' || obj.type === 'repeat_time'),
      info = trigger.automation_events[index].info,
      opts;
  } catch (e) {
    return 2;
  }

  // EXACT TIME!!
  if (info.date) {
    opts = to_unix(info.date);

    if (isNaN(opts)) return 2;

    var current_date = new Date().getTime();

    if (current_date > opts) {
      if ((trigger.persist == true || trigger.persist == 1) && !trigger.last_exec) {
        run_trigger_actions(trigger);
        return 6;
      } else {
        return 3;
      }
    }

    // REPEAT TIME
  } else if (info.days_of_week && info.hour) {
    // At least the days and hour

    try {
      var rule = new schedule.RecurrenceRule();
      rule.second = parseInt(info.second) || 0;
      rule.minute = parseInt(info.minute) || null;
      rule.hour = parseInt(info.hour) || null;
      rule.dayOfWeek = JSON.parse(info.days_of_week) || null;

      if (!check_rules(rule)) return 2;

      opts = {rule: rule};

      if (info.until) {
        var until_date = info.until,
          year = parseInt(until_date.slice(0, 4)),
          month = parseInt(until_date.slice(4, 6)) - 1, // January its 0
          day = parseInt(until_date.slice(6, 8)) + 1; // One more day, until next day at 00:00

        var end_date = new Date(year, month, day),
          current_date = new Date();

        if (current_date > end_date) return 3;
        opts.end = end_date;
      }
    } catch (e) {
      return 2;
    }
  } else return 2;

  try {
    var index_repeat = trigger.automation_events.findIndex((obj) => obj.type === 'repeat_range_time'),
      index_range = trigger.automation_events.findIndex((obj) => obj.type === 'range_time');
  } catch (e) {
    return 2;
  }

  if (index_repeat > -1) {
    var repeat_params = trigger.automation_events[index_repeat].info;
    (days = JSON.parse(repeat_params.days_of_week)),
      (hour_from = repeat_params.hour_from),
      (hour_until = repeat_params.hour_until),
      (until = repeat_params.info.until);

    if (!check_repeat_format(days, hour_from, hour_until, until)) return 4;
    var repeat = {days_of_week: days, hour_from: hour_from, hour_until: hour_until, until: until};
  }

  if (index_range > -1) {
    var range_params = trigger.automation_events[index_range].info,
      date_from = to_unix(range_params.from),
      date_until = to_unix(range_params.until);

    if (!check_range_format(date_from, date_until)) return 4;
    var range = {from: date_from, until: date_until};
  }

  var da_trigger = schedule.scheduleJob(opts, () => {
    var date = new Date();

    if (repeat) {
      if (repeat.days_of_week.indexOf(date.getDay()) == -1) return;

      var aux_date = new Date(date.valueOf());
      var dates = check_repeat(aux_date, repeat);
      if (Object.keys(dates).length == 0 || date.getTime() < dates.from || date.getTime() > dates.until) return;
    }

    if (range) {
      (date_from = range.from), (date_until = range.until);

      if (isNaN(date_from) || isNaN(date_until) || date.getTime() < date_from || date.getTime() > date_until) return;
    }

    run_trigger_actions(trigger);
  });

  if (da_trigger) {
    running_triggers.push(da_trigger);
    return 1;
  }
  return 0;
};

exports.sync = (id, err, triggers, stored, cb) => {
  if (err) triggers = stored;
  var watching = [];

  triggers.forEach((trigger) => {
    if (typeof trigger.automations_events == 'string') {
      try {
        trigger.automations_events = JSON.parse(trigger.automations_events);
        trigger.automations_actions = JSON.parse(trigger.automations_action);
      } catch (e) {
        logger.warn('Error parsing trigger options: ' + e.message);
      }
    }

    // The previous states are reassignated
    var t_id = stored.findIndex((obj) => obj.id === trigger.id);

    if (t_id > -1) {
      trigger.persist = stored[t_id].persist;
      trigger.synced_at = stored[t_id].synced_at;
      trigger.last_exec = stored[t_id].last_exec;

      var stored_index = stored.findIndex((x) => x.id === trigger.id);

      if (stored_index > -1) stored.splice(stored_index, 1);
    }
  });

  exports.cancel_all();
  event_triggers = {};
  da_triggers = triggers;

  if (triggers.length == 0) return done(id, null, cb);

  triggers.forEach((trigger, index) => {
    if (trigger.options && trigger.options.persist == true) {
      // ta bien
      trigger.persist = 1;
    }

    if (!trigger.synced_at) {
      trigger.synced_at = new Date().getTime(); // Tiene los 3 digitos extras!!
      trigger.last_exec = null;
    }

    var state;

    try {
      if (trigger.automation_events.some((obj) => obj.type === 'exact_time' || obj.type === 'repeat_time')) {
        state = exports.activate(trigger);
      } else state = exports.activate_event(trigger);
    } catch (e) {
      state = 0;
    }

    var finish = () => {
      if (index == triggers.length - 1 && watching.length > 0) {
        send_response('started', watching);
      }
    };

    var stored_index = stored.findIndex((x) => x.id === trigger.id);
    if (stored_index == -1 || state != 1) {
      watching.push({id: trigger.id, state: state});
    }

    if (state != 1 && state != 6) {
      logger.warn('Unable to set up trigger "' + trigger.name + '": ' + error_status_list[state]);
      if (trigger.persist == false || trigger.persist == null || trigger.persist == 0) {
        send_response('stopped', [trigger.id]);
      }

      if (index == triggers.length - 1) {
        done(id, null, cb);
      }
      finish();
    } else {
      if (state == 6) logger.warn('Persisting action for ' + trigger.name);
      if (!trigger.persist) trigger.persist = 0;

      var data = {
        id: trigger.id,
        name: trigger.name,
        persist: trigger.persist, // persist estado inicial? // guardar como 0 o 1
        synced_at: trigger.synced_at,
        last_exec: trigger.last_exec,
        automation_events: trigger.automation_events,
        automation_actions: trigger.automation_actions
      };

      if (!trigger.persist || trigger.persist == false || trigger.persist == 0) data.persist = 0;
      if (trigger.persist && (trigger.persist == true || trigger.persist == 1)) data.persist = 1;

      storage.do('set', {type: 'triggers', id: trigger.id, data: data}, (err) => {
        if (err) logger.error('Error storing triggers: ' + err);

        if (index == triggers.length - 1) {
          done(id, null, cb);
        }
        finish();
      });
    }
  });
  set_up_hooks();

  // Which reimains in stored array it's added to the action stopped response reason
  if (stored.length > 0) {
    var stored_triggers = stored.map((a) => a.id),
      request_triggers = triggers.map((a) => a.id);

    var deleted = stored_triggers.filter((el) => !request_triggers.includes(el));
    if (deleted.length > 0) {
      send_response('stopped', deleted);
    }
  }
};

function refresh_triggers(id, opts, cb) {
  if (refreshing) return;

  refreshing = true;
  emitter = emitter || new EventEmitter();

  fetch_triggers((err, res) => {
    if (err) {
      storage.do('all', {type: 'triggers'}, (err, stored_triggers) => {
        if (err) return done(id, err, cb);
        exports.clear_triggers((err) => {
          exports.sync(id, err, [], stored_triggers, () => {
            cb && cb(null, emitter);
          });
        });
      });
    } else {
      var triggers = res.body;

      if (!(triggers instanceof Array)) {
        var err = new Error('Triggers list is not an array');
        return done(id, err, cb);
      }

      storage.do('all', {type: 'triggers'}, (err, stored_triggers) => {
        exports.clear_triggers((err) => {
          exports.sync(id, null, triggers, stored_triggers, () => {
            cb && cb(null, emitter);
          });
        });
      });
    }
  });
}

exports.clear_triggers = (cb) => {
  storage.do('clear', {type: 'triggers'}, (err) => {
    if (err) logger.error(err.message);
    return cb() && cb(err);
  });
};

exports.start = exports.stop = refresh_triggers;
exports.logger = logger;
