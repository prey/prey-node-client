//////////////////////////////////////////
// Prey Campfire Plugin
// Written by Tomas Pollak
// (c) 2012, Fork Ltd. http://forkhq.com
// Licensed under the GPLv3
//////////////////////////////////////////

var Campfire = require('campfire').Campfire,
    parser   = require('./parser');

var common,
    logger,
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
    if (!this.token || this.token == 'USER_TOKEN' || parseInt(this.room_id) == NaN)
      return cb(new Error("You need to set up your Campfire credentials."))

    self.connect(function(err, room) {
      if (err) {
        if (temporary_network_error(err))
          return setTimeout(function() { self.load(cb) }, 1000);
        else
          return cb(err);
      }

      self.room = room;
      room.listen(self.parse_message);

      self.greet();
      logger.info("Connected to room " + room.name + " at " + self.domain);

      cb();
    });
  };

  this.connect = function(cb) {
    var self = this;
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

  this.load_hooks = function() {
    var self = this;

    hooks.on('report', function(name, data){
      self.paste(name, data);
    });

    hooks.on('data', function(name, data){
      self.paste(name, data);
    });

    hooks.on('event', function(event_name, data){
      self.say('New event: ' + event_name, data);
    });

    hooks.on('error', function(err){
      self.say("\n" + red(err));
    });
  }

  this.greet = function(){
    var now = new Date();
    if (now.getHours() < 4)
      this.say("Bongiorno. It's kinda' late, don't you think?");
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

  this.logout = function(){
    this.say("I'll be back.");
    this.unload();
  }

  this.unload = function(err){
    if (err) logger.error(err);

    if (!this.room) return;
    logger.info("Leaving room " + this.room.name);
    this.room.leave();

    // this.emit('unload', err);
  };

  this.check_owner = function(message){
    if (this.owner_id && this.owner_id != message.userId){
      this.say("Definitely not you. Off you go.")
    } else if (!this.owner_id){
      if (!this.owner_id) this.owner_id = message.userId;
      self.say("Welcome back, master. Your wish is my command.");
    } else {
      self.say("Awaiting your command, master.");
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

  this.parse_message = function(message, internal) {
    parser.apply(self, [message, internal]);
  };

};

// after configured, this ensures that the keys are valid.
exports.enabled = function(cb) {
  common   = this;
  logger   = this.logger;
  var opts = this.config.all();

  var instance = new CampfireDriver(opts);
  instance.connect(function(err, room) {
    if (err) return cb(new Error('Could not connect: ' + err.message));

    room.leave();
    cb();
  })
}

exports.load = function(cb) {
  common   = this;
  logger   = common.logger;
  hooks    = common.hooks;
  commands = common.commands;

  var opts = common.config.all()
  module.instance = new CampfireDriver(opts);
  module.instance.load(cb);
}

exports.unload = function() {
  if (module.instance)
    module.instance.unload();
}