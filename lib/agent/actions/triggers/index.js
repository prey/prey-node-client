const schedule = require('node-schedule');
const { EventEmitter } = require('events');
const logger = require('../../common').logger.prefix('triggers');
const api = require('../../control-panel/api');
const hooks = require('../../hooks');
const commands = require('../../commands');
const storage = require('../../utils/storage');

let emitter;
let runningTriggers = [];
let eventTriggers = {};
let currentTriggers = [];

let timeoutStartTrigger;
const websocket = require('../../control-panel/websockets');

const eventsList = [
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
  'device_unseen',
];

const errorStatusList = {
  0: 'Unknown error',
  1: 'Success!',
  2: 'Invalid trigger format',
  3: 'Cant set trigger into the past!',
  4: "The execution range dates doesn't make sense.",
  5: 'Unavailable event for Node Client.',
  6: 'Persisting action!',
};

const fetchTriggers = (cb) => {
  api.devices.get.triggers(cb);
};

const done = (id, err, cb) => {
  if (emitter) {
    setTimeout(() => {
      emitter.emit('end', id, err);
    }, 1000);
  }

  if (cb && typeof cb === 'function') return cb(err);
  return null;
};

const sendResponse = (status, idList) => {
  logger.debug(`sending ${status} w/ code ${JSON.stringify(idList)} to prey' control panel`);

  const data = {
    status,
    command: 'start',
    target: 'triggers',
    reason: JSON.stringify(idList),
  };
  // eslint-disable-next-line dot-notation
  api.push.methods['response'](data);
};

const cancelHooks = () => {
  if (Object.keys(eventTriggers).length === 0) return;

  Object.keys(eventTriggers).forEach((event) => {
    hooks.remove(event);
  });
};

const checkRepeat = (date, repeat) => {
  let limit;
  try {
    const hourFrom = repeat.hour_from;
    const hourUntil = repeat.hour_until;
    const dateFrom = date.setHours(
      hourFrom.slice(0, 2),
      hourFrom.slice(2, 4),
      hourFrom.slice(4, 6),
    );
    const dateUntil = date.setHours(
      hourUntil.slice(0, 2),
      hourUntil.slice(2, 4),
      hourUntil.slice(4, 6),
    );

    limit = { from: dateFrom, until: dateUntil };
  } catch (e) {
    limit = {};
  }
  return limit;
};

const checkRangeFormat = (from, until) => {
  if (from > until) return false;
  return true;
};

const checkRepeatFormat = (days, hourFrom, hourUntil, until) => {
  if (days.some(Number.isNaN)) return false;
  if (hourFrom.length !== 6 || hourUntil.length !== 6) return false;
  if (until && until.length !== 8) return false;
  return true;
};

const checkRules = (rule) => {
  if (rule.second && (rule.second < 0 || rule.second > 60)) return false;
  if (rule.minute && (rule.minute < 0 || rule.minute > 60)) return false;
  if (rule.hour && (rule.hour < 0 || rule.hour > 24)) return false;
  if (rule.dayOfWeek.some((elem) => elem > 6 || elem < 0)) return false;
  return true;
};

const runAction = (trigger, actionFrom) => {
  const action = actionFrom;
  let timeout = 0;

  if (action.delay && action.delay > 0) timeout = action.delay;

  setTimeout(() => {
    if (action.action.options) action.action.options.trigger_id = trigger.id;
    commands.perform(action.action, trigger.persist);
  }, timeout);
};

const runTriggerActions = (trigger) => {
  // Update last_exec
  storage.do(
    'update',
    {
      type: 'triggers',
      id: trigger.id,
      columns: 'last_exec',
      values: new Date().getTime(),
    },
    () => {
      sendResponse('stopped', [trigger.id]);
      // storage.do('del', { type: 'triggers', id: trigger.id });
    },
  );

  trigger.automation_actions.forEach((action) => {
    runAction(trigger, action);
  });
};

exports.cancel_all = () => {
  if (runningTriggers.length > 0) {
    runningTriggers.forEach((trigger) => {
      trigger.cancel();
    });
    runningTriggers = [];
  }
  cancelHooks();
};

const toUnix = (dateData) => {
  let date = dateData;
  let newDate;
  try {
    if (/^\d+$/.test(date)) {
      const year = parseInt(date.slice(0, 4), 10);
      const month = parseInt(date.slice(4, 6), 10) - 1; // January its 0
      const day = parseInt(date.slice(6, 8), 10);
      const hour = parseInt(date.slice(8, 10), 10);
      const minute = parseInt(date.slice(10, 12), 10);
      const second = parseInt(date.slice(12, 14), 10);
      const timezoneOffset = new Date().getTimezoneOffset() * 60 * 1000; // miliseconds

      // eslint-disable-next-line max-len
      newDate = new Date(Date.UTC(year, month, day, hour, minute, second)).getTime() + timezoneOffset;
    } else {
      date = date.split('Z');
      if (date.length > 1) {
        if (date[1].length > 0) date = date[1].charAt(0) === '-' ? date.join('') : date.join('+');
        // eslint-disable-next-line prefer-destructuring
        else date = date[0];
      }
      newDate = new Date(date).getTime();
    }
  } catch (e) {
    newDate = NaN;
  }
  return parseInt(newDate, 10);
};

const setUpHooks = () => {
  if (Object.keys(eventTriggers).length === 0) return;

  Object.keys(eventTriggers).forEach((event) => {
    hooks.on(event.split('-')[0], (info) => {
      if (info && info.id && event.split('-')[1] !== info.id) return;
      eventTriggers[event].forEach((actionElement) => {
        const action = actionElement;
        let timeout = 0;
        if (action.delay && action.delay > 0) timeout = action.delay;

        const date = new Date();
        if (action.repeat) {
          if (action.repeat.days_of_week.indexOf(date.getDay()) === -1) return;

          const auxDate = new Date(date.valueOf());
          const dates = checkRepeat(auxDate, action.repeat);

          if (Object.keys(dates).length === 0
          || date.getTime() < dates.from || date.getTime() > dates.until) return;
        }

        if (action.after) {
          const lastConnection = websocket.lastConnection();
          if (!lastConnection) return;
          if (lastConnection + action.after > Math.round(Date.now() / 1000)) return;
          // Don't do if it was already executed
          if (!currentTriggers) return;
          const triggerIndex = currentTriggers.findIndex((obj) => obj.id === action.trigger_id);
          if (currentTriggers[triggerIndex].last_exec
            // eslint-disable-next-line no-mixed-operators
            && (typeof currentTriggers[triggerIndex].last_exec === 'string'
            && currentTriggers[triggerIndex].last_exec.localeCompare('null') !== 0)
            // eslint-disable-next-line no-mixed-operators
            || (typeof currentTriggers[triggerIndex].last_exec === 'number')) return;
          const execTime = new Date().getTime();
          currentTriggers[triggerIndex].last_exec = execTime;

          const current = currentTriggers[triggerIndex];
          if (event.split('-')[0].localeCompare('device_unseen') !== 0) {
            storage.do(
              'update',
              {
                type: 'triggers',
                id: current.id,
                columns: 'last_exec',
                values: execTime,
              },
              (err) => {
                if (err) logger.info('Unable to update the execution time');
              },
            );
          }
        }

        if (action.range) {
          const dateFrom = action.range.from;
          const dateUntil = action.range.until;

          if (Number.isNaN(dateFrom) || Number.isNaN(dateUntil) || date.getTime() < dateFrom
          || date.getTime() > dateUntil) return;
        }

        setTimeout(() => {
          if (action.action.options) {
            action.action.options.trigger_id = action.trigger_id;
            try {
              // eslint-disable-next-line max-len
              websocket.notify_action(action.action, action.action.options.trigger_id, action.action.target, null, null, null);
            } catch (ex) {
              logger.info('action from trigger not notified');
            }
          }
          logger.info('action to perform 1');
          commands.perform(action.action);
        }, timeout);
      });
    });
  });
};

exports.activate_event = (trigger) => {
  let eventIndex;
  try {
    eventIndex = trigger.automation_events.findIndex((obj) => eventsList.indexOf(obj.type) > -1);
  } catch (e) {
    return 2;
  }
  if (eventIndex === -1) return 5;

  let event = trigger.automation_events[eventIndex].type;
  const { info } = trigger.automation_events[eventIndex];

  if (!eventTriggers[event]) {
    if (info && info.id) event = [event, info.id].join('-');
    eventTriggers[event] = [];
  }

  // eslint-disable-next-line consistent-return
  trigger.automation_actions.forEach((actionElementAutomation) => {
    const action = actionElementAutomation;
    // If there's an element with type 'repeat_range_time' we keep the index
    const indexRepeat = trigger.automation_events.findIndex((obj) => obj.type === 'repeat_range_time');
    const indexRange = trigger.automation_events.findIndex((obj) => obj.type === 'range_time');
    const indexAfter = trigger.automation_events.findIndex((obj) => obj.type === 'after_time');

    if (indexAfter > -1) {
      const { seconds } = trigger.automation_events[indexAfter].info;
      action.after = seconds;
    }
    let currentDate;
    if (indexRepeat > -1) {
      const days = JSON.parse(trigger.automation_events[indexRepeat].info.days_of_week);
      const hourFrom = trigger.automation_events[indexRepeat].info.hour_from;
      const hourUntil = `${trigger.automation_events[indexRepeat].info.hour_until.slice(0, -2)}59`; // Include that last minute
      const { until } = trigger.automation_events[indexRepeat].info;

      if (until) {
        const year = parseInt(until.slice(0, 4), 10);
        const month = parseInt(until.slice(4, 6), 10) - 1; // January its 0
        const day = parseInt(until.slice(6, 8), 10) + 1; // One more day, until next day at 00:00

        const endDate = new Date(year, month, day);
        currentDate = new Date();

        if (currentDate > endDate) return 3;
      }

      if (!checkRepeatFormat(days, hourFrom, hourUntil, until)) return 4;

      action.repeat = {
        days_of_week: days,
        hour_from: hourFrom,
        hour_until: hourUntil,
        until,
      };
    }

    if (indexRange > -1) {
      const dateFrom = toUnix(`${trigger.automation_events[indexRange].info.from}000000`);
      const dateUntil = toUnix(`${trigger.automation_events[indexRange].info.until}235959`);

      if (currentDate > dateUntil) return 2;
      if (!checkRangeFormat(dateFrom, dateUntil)) return 4;
      action.range = { from: dateFrom, until: dateUntil };
    }

    action.trigger_id = trigger.id;
    eventTriggers[event].push(action);
  });

  return 1;
};

/**
 * activates the trigger in prey's control panel
 * @param {object} trigger - the object with trigger info
 */
exports.activate = (trigger) => {
  let index;
  let info;
  let opts;
  try {
    index = trigger.automation_events.findIndex((obj) => obj.type === 'exact_time' || obj.type === 'repeat_time');
    info = trigger.automation_events[index].info;
  } catch (e) {
    return 2;
  }

  // EXACT TIME!!
  if (info.date) {
    opts = toUnix(info.date);

    if (Number.isNaN(opts)) return 2;

    const currentDate = new Date().getTime();

    if (currentDate > opts) {
      if ((trigger.persist === true || trigger.persist === 1) && !trigger.last_exec) {
        runTriggerActions(trigger);
        return 6;
      }
      return 3;
    }

    // REPEAT TIME
  } else if (info.days_of_week && info.hour) {
    // At least the days and hour

    try {
      const rule = new schedule.RecurrenceRule();
      rule.second = parseInt(info.second, 10) || 0;
      rule.minute = parseInt(info.minute, 10) || null;
      rule.hour = parseInt(info.hour, 10) || null;
      rule.dayOfWeek = JSON.parse(info.days_of_week) || null;

      if (!checkRules(rule)) return 2;

      opts = { rule };

      if (info.until) {
        const untilDate = info.until;
        const year = parseInt(untilDate.slice(0, 4), 10);
        const month = parseInt(untilDate.slice(4, 6), 10) - 1; // January its 0
        // eslint-disable-next-line max-len
        const day = parseInt(untilDate.slice(6, 8), 10) + 1; // One more day, until next day at 00:00

        const endDate = new Date(year, month, day);
        const currentDate = new Date();

        if (currentDate > endDate) return 3;
        opts.end = endDate;
      }
    } catch (e) {
      return 2;
    }
  } else return 2;
  let indexRepeat;
  let indexRange;
  try {
    indexRepeat = trigger.automation_events.findIndex((obj) => obj.type === 'repeat_range_time');
    indexRange = trigger.automation_events.findIndex((obj) => obj.type === 'range_time');
  } catch (e) {
    return 2;
  }
  let repeat;
  if (indexRepeat > -1) {
    const repeatParams = trigger.automation_events[indexRepeat].info;
    const days = JSON.parse(repeatParams.days_of_week);
    // eslint-disable-next-line camelcase
    const { hour_from } = repeatParams;
    // eslint-disable-next-line camelcase
    const { hour_until } = repeatParams;
    const { until } = repeatParams.info;

    if (!checkRepeatFormat(days, hour_from, hour_until, until)) return 4;
    repeat = {
      days_of_week: days,
      // eslint-disable-next-line camelcase
      hour_from,
      // eslint-disable-next-line camelcase
      hour_until,
      until,
    };
  }
  let range;
  if (indexRange > -1) {
    const rangeParams = trigger.automation_events[indexRange].info;
    const dateFrom = toUnix(rangeParams.from);
    const dateUntil = toUnix(rangeParams.until);

    if (!checkRangeFormat(dateFrom, dateUntil)) return 4;
    range = { from: dateFrom, until: dateUntil };
  }

  const daTrigger = schedule.scheduleJob(opts, () => {
    const date = new Date();
    if (repeat) {
      if (repeat.days_of_week.indexOf(date.getDay()) === -1) return;

      const auxDate = new Date(date.valueOf());
      const dates = checkRepeat(auxDate, repeat);
      // eslint-disable-next-line max-len
      if (Object.keys(dates).length === 0 || date.getTime() < dates.from || date.getTime() > dates.until) return;
    }

    if (range) {
      const dateFrom = range.from;
      const dateUntil = range.until;

      if (Number.isNaN(dateFrom) || Number.isNaN(dateUntil)
        || date.getTime() < dateFrom || date.getTime() > dateUntil) return;
    }

    runTriggerActions(trigger);
  });

  if (daTrigger) {
    runningTriggers.push(daTrigger);
    return 1;
  }
  return 0;
};

const uniqueElementsFromArray = (arr1, arr2) => {
  // eslint-disable-next-line max-len
  const uniqueElements = arr1.filter((item) => !arr2.some((elem) => parseInt(elem.id, 10) === parseInt(item.id, 10)));
  return uniqueElements;
};

exports.sync = (success, id, err, triggersSync, storedSync, cb) => {
  let triggers = [...triggersSync];
  const stored = [...storedSync];
  const watching = [];

  if (err || !success) {
    if (err) logger.error(`error starting async: ${err}`);
    triggers = stored;
  }
  if (success) {
    const deletedElements = uniqueElementsFromArray(stored, triggers);
    if (deletedElements.length > 0) {
      logger.info(`deleted triggers: ${JSON.stringify(deletedElements)}`);
      deletedElements.forEach((elemTrigger) => {
        storage.do('del', { type: 'triggers', id: elemTrigger.id });
      });
    }
  }

  currentTriggers = [...triggers];
  const lookup = {};
  stored.forEach((element) => {
    lookup[element.id] = element;
  });
  currentTriggers = currentTriggers.map((elementA) => {
    const elementB = lookup[elementA.id];
    if (elementB) {
      logger.info(`found! ${JSON.stringify(elementB)}`);
      logger.info(`comparation! ${JSON.stringify(elementA)}`);
      return { ...elementA, last_exec: elementB.last_exec, synced_at: elementB.synced_at };
    }
    return elementA;
  });
  // eslint-disable-next-line max-len
  exports.cancel_all();
  eventTriggers = {};

  // iterate over only active and filtered triggers
  currentTriggers.forEach((triggerToWatch, index) => {
    logger.warn(`what is ${JSON.stringify(triggerToWatch)}`);
    const trigger = triggerToWatch;
    if (typeof triggerToWatch.automation_events === 'string') {
      try {
        trigger.automation_events = JSON.parse(triggerToWatch.automation_events);
        trigger.automation_actions = JSON.parse(triggerToWatch.automation_actions);
      } catch (e) {
        logger.warn(`Error parsing trigger options: ${e.message}`);
      }
    }

    if (trigger.options && trigger.options.persist === true) {
      trigger.persist = 1;
    }

    if (!trigger.synced_at) {
      trigger.synced_at = new Date().getTime();
      trigger.last_exec = null;
    }

    let state;

    try {
      logger.info(`${typeof trigger.automation_events}`);
      if (trigger.automation_events.some((obj) => obj.type === 'exact_time' || obj.type === 'repeat_time')) {
        state = exports.activate(trigger);
      } else {
        state = exports.activate_event(trigger);
      }
    } catch (e) {
      state = 0;
    }

    const finish = () => {
      if (index === triggers.length - 1 && watching.length > 0) {
        sendResponse('started', watching);
      }
    };

    const storedIndex = stored.findIndex((x) => x.id === trigger.id);
    if (storedIndex === -1 || state !== 1) {
      watching.push({ id: trigger.id, state });
    }

    if (state !== 1 && state !== 6) {
      logger.info(`Unable to set up trigger "${trigger.name}": ${errorStatusList[state]}`);
      if (trigger.persist === false || trigger.persist == null || trigger.persist === 0) {
        sendResponse('stopped', [trigger.id]);
      }

      if (index === triggers.length - 1) done(id, null, cb);
      finish();
    } else if (stored.filter((x) => x.id === trigger.id).length === 0) {
      logger.debug(`saving stored trigger ID: ${trigger.id}`);
      if (state === 6) {
        logger.warn(`Persisting action for ${trigger.name}`);
      }

      if (!trigger.persist) trigger.persist = 0;

      const data = {
        id: trigger.id,
        name: trigger.name,
        persist: trigger.persist, // persist as initial state? // valid values are 0 or 1
        synced_at: trigger.synced_at,
        last_exec: trigger.last_exec,
        automation_events: trigger.automation_events,
        automation_actions: trigger.automation_actions,
      };

      if (!trigger.persist || trigger.persist === false || trigger.persist === 0) data.persist = 0;
      if (trigger.persist && (trigger.persist === true || trigger.persist === 1)) data.persist = 1;
      if (lookup[trigger.id]) {
        storage.do(
          'update',
          {
            type: 'triggers',
            id: trigger.id,
            columns:
            ['name', 'persist', 'automation_events', 'automation_actions'],
            values: [
              trigger.name, trigger.persist, JSON.stringify(trigger.automation_events),
              JSON.stringify(trigger.automation_actions),
            ],
          },
          (errStorageDo) => {
            if (errStorageDo) {
              logger.error(`Error updating triggers: ${errStorageDo}`);
            }
            if (index === triggers.length - 1) {
              done(id, null, cb);
            }
            finish();
          },
        );
      } else {
        storage.do(
          'set',
          { type: 'triggers', id: trigger.id, data },
          (errStorageDo) => {
            if (errStorageDo) {
              logger.error(`Error storing triggers: ${errStorageDo}`);
            }
            if (index === triggers.length - 1) {
              done(id, null, cb);
            }
            finish();
          },
        );
      }
    }
  });
  setUpHooks();
};

const handleTriggersSuccesfully = (success, id, cb, triggers = null) => {
  // eslint-disable-next-line consistent-return
  storage.do('all', { type: 'triggers' }, (error, storedTriggers) => {
    if (error || !storedTriggers) {
      return done(id, error, cb);
    }

    logger.debug(`triggers fetched from API successfully: ${success}`);
    const errData = null;
    let triggersToSync = [];

    if (success) {
      triggersToSync = triggers;
    }
    exports.sync(success, id, errData, triggersToSync, storedTriggers, () => {
      if (cb && typeof (cb) === 'function') cb(null, emitter);
    });
  });
};

const refreshTriggers = (id, cb) => {
  logger.info('retrieving triggers from API');

  emitter = emitter || new EventEmitter();
  if (timeoutStartTrigger) clearTimeout(timeoutStartTrigger);
  timeoutStartTrigger = setTimeout(() => {
    // eslint-disable-next-line consistent-return
    fetchTriggers((err, res) => {
      if (err) {
        handleTriggersSuccesfully(false, id, cb);
      } else {
        const fetchedTriggers = res.body;
        if (!(fetchedTriggers instanceof Array)) {
          return done(id, new Error('Triggers list is not an array'), cb);
        }
        handleTriggersSuccesfully(true, id, cb, fetchedTriggers);
      }
    });
  }, 8000);
};

exports.clear_triggers = (cb) => {
  logger.debug('cleaning triggers from local db');
  storage.do('clear', { type: 'triggers' }, (err) => {
    if (err) logger.error(err.message);
    return cb() && cb(err);
  });
};

// eslint-disable-next-line no-multi-assign
exports.start = exports.stop = refreshTriggers;
exports.logger = logger;
