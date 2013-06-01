var http    = require('http'),
    qs      = require('qs');
    hooks   = require('./../../hooks'),
    Emitter = require('events').EventEmitter;

var app, emitter;

var parseBody = function(req, cb){

  var data = '';

  req.on('data', function(chunk) {
    data += chunk;
    if (data.length > 1e6) {
      data = '';
      var err = new Error('Request too long.');
      err.code = 413;
      return cb(err);
    }
  });

  req.on('end', function() {
    var obj = qs.parse(data);
    cb(null, obj);
  });

};

var createServer = function() {

  var done = function(res, err){
    var code = err ? 500 : 200;
    res.writeHead(code, {'Content-Type': 'text/html'});
    res.end('Alrighty.');
  };

  var server = http.createServer(function(req, res){
    console.log('Got request: ' + req.url);

    if (req.url != '/command')
      return done(res);

     parseBody(req, function(err, body){
       if (err) return done(res, err);
       // emitter.emit(req.path, body);
       
       if (body.command == 'run_once')
          hooks.trigger('woken');
       else
          emitter.emit('command', body);
  
       done(res);
     });

  });

  return server;

};

exports.listen = function(port, cb){
  app = createServer();
  app.listen(port, function(err){
    if (err) return cb(err);

    emitter = new Emitter();
    cb(null, emitter);
  });
};

exports.stop = function(cb){
  if (app) app.close(cb);
  if (emitter._events)
    emitter.removeAllListeners();
}
