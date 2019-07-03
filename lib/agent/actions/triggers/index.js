"use strict";

var schedule     = require('node-schedule'),
    EventEmitter = require('events').EventEmitter,
    logger       = require('./../../common').logger.prefix('triggers'),
    api          = require('./../../plugins/control-panel/api'),
    hooks        = require('./../../hooks'),
    commands     = require('./../../commands'),
    storage      = require('./storage');

var emitter,
    running_triggers = [],
    event_triggers = {};

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
  'hardware_changed'
]

function fetch_triggers(cb) {
  api.devices.get.triggers(cb);
}

function cancel_hooks() {
  if (Object.keys(event_triggers).length == 0) return;

  Object.keys(event_triggers).forEach(event => {
    hooks.remove(event);
  })
}

exports.cancel_all = () => {
  if (running_triggers.length > 0) {
    running_triggers.forEach(trigger => {
      trigger.cancel();
    })
    running_triggers = [];
  }
  cancel_hooks();
}

function to_unix(date) {
  var new_date;
  try {
    if (/^\d+$/.test(date)) {
      var year   = parseInt(date.slice(0,4)),
          month  = parseInt(date.slice(4,6)) -1,       // January its 0
          day    = parseInt(date.slice(6,8)),          // One more day, until next day at 00:00
          hour   = parseInt(date.slice(8,10)),
          minute = parseInt(date.slice(10,12)),
          second = parseInt(date.slice(12,14));

      new_date = new Date(year, month, day, hour, minute, second).getTime();
    } else {
      date = date.split('Z');
      if (date.length > 1) {
        if (date[1].length > 0) date = date[1].charAt(0) == '-' ? date.join('') : date.join('+');
        else date = date[0];
      }
      new_date = new Date(date).getTime();
    }
  } catch(e) {
    new_date = NaN;
  }
  return parseInt(new_date);
}

function to_hour(hour) {
  // if (hour.length != 6) ....
  hour = hour.slice(0, 2) + ":" + hour.slice(2);
  hour = hour.slice(0, 5) + ":" + hour.slice(5);
  return hour;
}

function set_up_hooks() {
  if (Object.keys(event_triggers).length == 0) return;

  Object.keys(event_triggers).forEach(event => {

    hooks.on(event.split('-')[0], (info) => {
      if (info && info.id && event.split('-')[1] != info.id) return;

      event_triggers[event].forEach(action => {

        var timeout = 0;
        if (action.delay && action.delay > 0)
          timeout = action.delay;

        if (action.range) {
          var date = new Date();
          var current_day = date.getDay();

          if (action.range.days_of_week.indexOf(current_day) == -1) return;
          
          var hour = date.toTimeString().split(' ')[0];
          if (hour < to_hour(action.range.hour_from) || hour > to_hour(action.range.hour_until)) return;
        }

        setTimeout(() => {
          commands.perform(action.action)
        }, timeout);
      })
    })
  })
}


exports.activate_event = (trigger) => {
  var event_index = trigger.events.findIndex(obj => events_list.indexOf(obj.type) > -1);
  if (event_index == -1) return false;

  var event = trigger.events[event_index].type;
  var info = trigger.events[event_index].info;

  if (!event_triggers[event]) {
    if (info && info.id) event = [event, info.id].join('-');
    event_triggers[event] = [];
  }

  trigger.actions.forEach(action => {
    // If there's an element with type 'repeat_range_time' we keep the index
    var index = trigger.events.findIndex(obj => obj.type === 'repeat_range_time');

    if (index > -1) action.range = trigger.events[index].info;
    event_triggers[event].push(action);
  })

  return true;
}

exports.activate = (trigger) => {
  var info = trigger.events[0].info,
      opts, range;

  if (info.date) {
    opts = to_unix(info.date);
    if (isNaN(opts)) return false;

  } else if (info.days_of_week && info.hour) {  // At least the days and hour

    try{
      var rule = new schedule.RecurrenceRule();
      rule.second    = info.second || 0;
      rule.minute    = info.minute || null;
      rule.hour      = info.hour   || null;
      rule.dayOfWeek = info.days_of_week || null;

      opts = {rule: rule};

      if (info.until) {
        var until_date = info.until,
                  year = parseInt(until_date.slice(0,4)),
                month  = parseInt(until_date.slice(4,6)) - 1, // January its 0
                  day  = parseInt(until_date.slice(6,8)) + 1; // One more day, until next day at 00:00
        var end_date = new Date(year, month, day),
        current_date = new Date();

        if (current_date > end_date) return false;
        opts.end = end_date;
      }
    } catch(e) {
      return false;
    }

  } else return false;

  var da_trigger = schedule.scheduleJob(opts, () => {
    var index = trigger.events.findIndex(obj => obj.type === 'repeat_range_time');

    trigger.actions.forEach(action => {
      var timeout = 0;

      if (index > -1) {
        var range = trigger.events[index].info,
            date = new Date(),
            current_day = date.getDay();

        if (range.days_of_week.indexOf(current_day) == -1) return;

        var hour = date.toTimeString().split(' ')[0];
        if (hour < to_hour(range.hour_from) || hour > to_hour(range.hour_until)) return;
      }

      if (action.delay && action.delay > 0)
        timeout = action.delay;

      setTimeout(() => {
        commands.perform(action.action)
      }, timeout);
    })
  });

  if (da_trigger) {
    running_triggers.push(da_trigger)
    return true;
  }
  return false;
}

exports.sync = (triggers) => {
  var len = triggers.length,
      watching = [];

  event_triggers = {};
  exports.cancel_all();
    
  if (len === 0) return done();
  else {
    triggers.forEach((trigger, index) => {
      var check;

      if (trigger.events.some(obj => obj.type === 'exact_time' || obj.type === 'repeat_time'))
        check = exports.activate(trigger);
      else 
        check = exports.activate_event(trigger);

      var finish = () => {
        if (index == triggers.length - 1)
          watching.length > 0 ? start_watcher(done) : done();
      }

      if (check) {
        watching.push(trigger.id);
        storage.store(trigger, (err) => {
          if (err) logger.error("Error storing triggers: " + err);
          finish();
        });
      } else {
        logger.warn('Unable to set up trigger ' + trigger.name);
        finish();
      }
    })
    set_up_hooks();
  }

  function start_watcher(cb) {
    notify_done();

    function notify_done() {
      var data = {
        status: 'started',
        command: 'start',
        target: 'triggers',
        reason: JSON.stringify({"trigger_id": watching})
      }
      api.push['response'](data);
      cb();
    }
  }

  function done() {
    return emitter.emit('end');
  }

}

function refresh_triggers(opts, cb) {
  emitter = emitter || new EventEmitter();

  fetch_triggers((err, res) => {
    if (err) {
      storage.get_triggers((err, stored_triggers) => {
        if (err) return emitter.emit('end', err);

        storage.clear_triggers((err) => {
          exports.sync(stored_triggers);
          return cb && cb(null, emitter);
        });
      })
      
    } else {
      var triggers = res.body;
      
      if (!(triggers instanceof Array)) {
        var err = new Error('Triggers list is not an array');
        return emitter.emit('end', err)
      }

      storage.clear_triggers((err) => {
        exports.sync(triggers);
        return cb && cb(null, emitter);
      });
    }
  });
}

exports.start = exports.stop = refresh_triggers;