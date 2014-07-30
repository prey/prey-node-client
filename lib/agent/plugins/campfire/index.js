//////////////////////////////////////////
// Prey Campfire Plugin
// Written by Tomas Pollak
// (c) 2012, Fork Ltd. http://forkhq.com
// Licensed under the GPLv3
//////////////////////////////////////////

var Campfire = require('campfire').Campfire,
    parser   = require('./parser'),
    helpers  = require('./helpers');

var common,
    logger,
    hooks,
    commands;

var temporary_network_error = function(err) {
  return err.code == 'EADDRINFO' || err.code == 'ENOTFOUND' || err.code == 'ECONNRESET';
}

var CampfireDriver = function(options) {

  var self = this;
  var options = options || {};

  this.token     = options.token;
  this.room_id   = options.room_id;
  this.nickname  = options.nickname || 'prey';
  this.subdomain = options.subdomain;
  this.domain    = this.subdomain + '.campfirenow.com';

  this.load = function(cb) {
    if (!this.token || this.token == 'USER_TOKEN' || parseInt(this.room_id) === NaN)
      return cb(new Error('You need to set up your Campfire credentials.'))

    // hooks.on('connected', this.start);
    this.start(cb);
  };

  this.start = function(cb) {
    this.connect(function(err, room) {
      if (err) {
        // if we had a error, but not connection related, return it.
        if (!temporary_network_error(err))
          return cb && cb(err);

        // otherwise, retry the connection in a while but callback anyway.
        self.timer = setTimeout(function() { self.start() }, 10000);
        return cb();
      }

      self.load_hooks();
      self.room = room;
      self.listener = room.listen(self.parse_message);
      self.greet();

      logger.info("Connected to room " + room.name + " at " + self.domain);
      cb && cb();
    });
  }

  this.connect = function(cb) {
    var conn = new Campfire({
      ssl     : true,
      token   : this.token,
      account : this.subdomain
    });

    conn.me(function(err, data) {
      if (err || (!data || !data.user))
        return cb(err || new Error('Unable to get user data. Invalid credentials?'));

      self.connection = conn;
      self.user_id    = data.user.id;

      conn.join(parseInt(self.room_id), function(err, room) {
        if (err || !room)
          return cb(err || new Error("Unable to enter room " + self.room_id));

        cb(null, room);
      });
    });
  };

  this.disconnect = function(cb) {
    if (this.timer)
      clearTimeout(this.timer);

    if (this.listener) {
      logger.info('Stopping message listener.');
      this.listener.end();
      this.listener = null;
    }

    if (this.room) { 
      logger.info('Leaving room ' + this.room.name);
      this.room.leave(cb);
    } else {
      cb();
    }
  }

  this.unload = function(cb){
    this.disconnect(cb);
  };

  this.load_hooks = function() {
    hooks.on('report', function(name, data) {
      self.paste(name, data);
    });

    hooks.on('data', function(name, data) {
      if (helpers[name])
        self.paste(name, helpers[name](data));
      else
        self.paste(name, data);
    });

    hooks.on('event', function(event_name, data) {
      self.say('New event: ' + event_name, data);
    });

    hooks.on('error', function(err){
      self.say("\n" + err);
    });
  }

  this.parse_message = function(message, internal) {
    var res = parser.apply(self, [message, internal]);
    if (res !== 'authorized') return;

    var body = message.body.trim().replace(self.nickname + ' ', ''),
        res  = commands.parse(body);

    if (res && res[1]) {
      self.say('Sure. Hold on one sec.');
      return commands.perform(res[1]);
    }

    self.say('What do you mean by "' + body.trim() + '"?');
  };

  // these below are commands triggered by messages

  this.greet = function(){
    var now = new Date();
    if (now.getHours() < 4)
      this.say("Bongiorno. Why are you still up so late?");
    else if (now.getHours() < 8)
      this.say("Good morning Vietnam!");
    else if (now.getHours() < 12)
      this.say("Hello folks. Nice day, is it not?");
    else if (now.getHours() < 16)
      this.say("Good afternoon. How was lunch?")
    else if (now.getHours() < 20)
      this.say("Hey there, what a long day, huh?");
    else if (now.getHours() < 24)
      this.say("Greetings. Fine evening it is, wouldn't you say?")
  }

/*
  this.logout = function(){
    this.say("I'll be back.");
    this.unload();
  }
*/

  this.check_owner = function(message) {
    if (this.owner_id && this.owner_id != message.userId) {
      this.say('Definitely not you. Off you go.')
    } else if (!this.owner_id) {
      if (!this.owner_id) this.owner_id = message.userId;
      self.say('Welcome back, master. Your wish is my command.');
    } else {
      self.say('Awaiting your command, master.');
    }
  };

  this.update_nickname = function(nick){
    this.nickname = nick.trim();
    this.say("I will now respond to messages that begin with " + this.nickname);
  }

  this.say = function(message, data){
    var str = data ? message + " received:\n\n" + JSON.stringify(data, null, 2) : message;

    self.room.speak(str, function(error, response){
      if (error) logger.error("Unable to send message " + error);
      else logger.info("Message succesfully sent at " + response.message.created_at)
    });
  };

  this.paste = function(message, data){
    var str = data ? message + " received:\n\n" + JSON.stringify(data, null, 2) : message;

    self.room.paste(str, function(error, response){
      if (error) logger.error("Unable to send message " + error);
      else logger.info("Message succesfully sent at " + response.message.created_at)
    });
  };

};

// after configured, this ensures that the keys are valid.
exports.enabled = function(cb) {
  common   = this;
  logger   = this.logger;
  var opts = this.config.all();

  var plugin = new CampfireDriver(opts);
  plugin.connect(function(err, room) {
    if (err) return cb(new Error('Could not connect: ' + err.message));

    room.leave();
    cb();
  })
}

exports.load = function(done) {
  // console.log('Called load', this.config);

  common   = this;
  logger   = common.logger;
  hooks    = common.hooks;
  commands = common.commands;

  var opts = common.config.all()
  module.instance = new CampfireDriver(opts);
  module.instance.load(done);
}

exports.unload = function(done) {
  if (module.instance)
    return module.instance.unload(done);

  module.instance = null;
  done();
}