var util = require('util'),
    http = require('http'),
    needle = require('needle'),
    Emitter = require('events').EventEmitter;

var Heartbeat = function(url, opts){
  var agent = new http.Agent;
  agent.maxSockets = 1;

  this.url = url;
  this.opts = opts || {};
  this.opts.agent = agent;

  this.delay; // = this.opts.delay || 20 * 60 * 1000; // 20 mins by default
  this.interval;
  this.before_handler = function(req_opts, next){
    next(req_opts);
  }
}

util.inherits(Heartbeat, Emitter);

Heartbeat.prototype.before = function(handler){
  this.before_handler = handler;
}

Heartbeat.prototype.start = function(){
  this.request();
}

Heartbeat.prototype.stop = function(err){
  this.emit('stopped', err);
}

Heartbeat.prototype.request = function(){

  var self = this,
      opts = this.opts;

  this.before_handler(opts, function(req_opts){

    needle.get(self.url, req_opts, function(err, resp, body){
      if (err) return self.stop(err);

      self.emit('message', body);
      resp.headers['x-request-in'] = 5000;

      var new_delay = parseInt(resp.headers['x-request-in']),
          new_url   = resp.headers['x-request-url'];

      if (!new_delay)
        return self.stop();

      if (new_url)
        self.url = new_url;

      self.delay = new_delay;

      setTimeout(function(){
        self.request();
      }, self.delay);

    })

  })

}

module.exports = Heartbeat;
