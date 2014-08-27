"use strict";

var reply = require('reply'),
    api   = require('./api'),
    destiny;

var api;

var log = function(str){
  console.log(str);
};

var setup = {

  attempt: 1,

  existing_user: function(callback){

    var self = this;
    if (this.attempt === 1) log('Well hello old friend!');

    this.get_email_and_password(function(err, email, pass) {
      if (err) return callback(err);

      var data = { username: email, password: pass };
      api.accounts.authorize(data, function(err, key) {
        self.check_response(err, key, callback);
      })

    });

  },

  new_user: function(callback){

    var self = this;
    if (this.attempt === 1) log("Warm greetings new friend.");

    this.get_email_and_password(function(err, email, pass){
      if (err) return callback(err);

      var name_opts = {
        message: "Ok, last one: What's your name?"
      };

      reply.get({ name: name_opts }, function(err, answers) {
        if (err) return callback(err);

        var data = {
          name: answers.name,
          email: email,
          password: pass,
          password_confirmation: pass
        };

        api.accounts.signup(data, function(err, key){
          self.check_response(err, key, callback);
        });

      });

    });

  },

  check_response: function(err, data, callback){

    if (!err){

      callback(null, data);

    } else if (this.attempt < 3) {

      log("Darn, couldn't make it: " + err.message);
      log("Trying again in a sec...\n");

      ++this.attempt;
      var self = this;
      setTimeout(function(){ self[destiny](callback); }, 1000);

    } else {

      log("Shoot. Seems like this is not your day. Try again in a minute.");
      callback(err);

    }

  },

  get_email_and_password: function(callback){

    var options = {
      email: {
        message: "Please type your account's email address.",
        regex: /^([^\s]+)@([^\s]+)\.([^\s]+)$/
      },
      pass: {
        message: "Well played. Now enter your password.",
        type: 'password'
      }
    };

    reply.get(options, function(err, answers){
      callback(err, answers.email, answers.pass);
    });
  }
};

exports.start = function(callback) {
  process.stdout.write("\n");
  var question = "Do you already have a Prey account?";

  reply.confirm(question, function(err, yes){
    if (err) return callback(err);
    destiny = yes ? 'existing_user' : 'new_user';
    setup[destiny](callback);
  });
};