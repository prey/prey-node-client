/// ///////////////////////////////////////
// Prey JS Alarm Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
/// ///////////////////////////////////////

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');
const commands = require(`./${os_name}`);
const Emitter = require('events').EventEmitter;
const common = require('../../common');

const logger = common.logger.prefix('actions');
const { system } = common;

let child;
let emitter;
let raiseInterval;

exports.start = function (id, options, cb) {
  let error;
  const self = this;
  let returned = 0;

  var options = options || {};
  const type = options.file || options.sound || 'alarm';
  let file = `${type}.mp3`;
  let loops = options.loops ? parseInt(options.loops) : 1;

  const done = function (id, err) {
    clearInterval(raiseInterval);
    if (returned++) returned;
    if (emitter) emitter.emit('end', id, err);
    emitter = null;
  };

  const raise_volume = function (cb, user) {
    if (os_name == 'linux') {
      const unmuteRaiseCommands = commands.raise_volume.split('&&');
      if (unmuteRaiseCommands.length < 2) return;
      system.run_as_logged_user(unmuteRaiseCommands[0], [], (err) => {
        if (err) { logger.info(`ERROR while raising volume: ${err}`); }
        system.run_as_logged_user(unmuteRaiseCommands[1], [], cb, null, user);
      }, null, user);
      return;
    }
    exec(commands.raise_volume, { timeout: 5000 }, cb);
  };

  const play_queue = function (user) {
    loops--;

    system.spawn_as_logged_user(commands.play, [file], null, (err, alarm) => {
      if (err && !user) return done(id, err);

      alarm.on('error', done);

      alarm.once('exit', (code) => {
        child = null;

        if (loops === 0) return done(id);

        play_queue();
      });

      child = alarm;
    }, user);
  };

  const exists = fs.existsSync(file);
  if (!exists) file = path.join(__dirname, 'lib', file);

  emitter = new Emitter();
  cb(null, emitter);

  // Check if there's a logged user before attempting to play audio
  system.get_logged_user((err, user) => {
    if (err) {
      if (err.message && err.message.includes('System on Windows Lock Screen state.')) {
        let userToPlay = err.message.split(' - System on Windows')[0];
        userToPlay = userToPlay.trim().replace('No logged user detected. ', '');
        logger.info(`Playing alarm as user: ${userToPlay}`);
        play_queue(userToPlay);

        raiseInterval = setInterval(() => {
          raise_volume(null, userToPlay);
        }, 1000);
        return;
      }
      logger.info(`Could not play alarm: ${err.message}`);
      return done(id, err);
    }

    logger.info(`Playing alarm as user: ${user}`);
    play_queue();

    raiseInterval = setInterval(() => {
      raise_volume();
    }, 1000);
  });
};

exports.stop = function () {
  if (child && !child.exitCode) {
    child.kill();
  }
};
