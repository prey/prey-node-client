var util = require('util'),
    needle = require('needle'),
    Emitter = require('events').EventEmitter,
    logger = require('./../../../common').logger;

var Heartbeat = function(url, opts){
  this.url = url;
  this.opts = opts || {};
  this.opts.parse = true;
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
  this.cancel_loop();
  this.emit('stopped', err);
}

Heartbeat.prototype.reset_loop = function(){
  this.cancel_loop();
  this.set_loop();
}

Heartbeat.prototype.cancel_loop = function(){
  if (this.interval) clearInterval(this.interval);
}

Heartbeat.prototype.set_loop = function(){
  var self = this, delay = this.delay;

  logger.debug('Setting loop to ' + delay/1000 + ' seconds!');

  this.interval = setInterval(function(){
    self.request();
  }, delay);
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

      if (new_delay != self.delay) {
        self.delay = new_delay;
        self.reset_loop();
      }

    })

  })

}

module.exports = Heartbeat;
