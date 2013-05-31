var http = require('http'),
    Emitter = require('events').EventEmitter;

var app, emitter;

var createServer = function() {

  var done = function(res, err){
    var code = err ? 500 : 200;
    res.writeHead(code, {'Content-Type': 'text/html'});
    res.end('Alrighty.');
  };

  var server = http.createServer(function(req, res){
    console.log('Got request: ' + req.path, req.headers);

    if (req.path != '/command')
      return done(res);

     parseBody(req, function(err, body){
       if (err) return done(res, err);
       emitter.emit(req.path, body);
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
