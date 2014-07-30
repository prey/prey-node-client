var http    = require('http'),
    qs      = require('qs'),
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
    res.end('Thanks. Now fly, my pretties, fly!');
  };

  var server = http.createServer(function(req, res) {

    if (req.url != '/command')
      return done(res);

     parseBody(req, function(err, body){
       if (err) return done(res, err);

       emitter.emit('request', req.headers, body);
       done(res);
     });

  });

  return server;

};

exports.listen = function(port, cb){
  app = createServer();

  app.on('error', function(e) {
    cb(e);
  })
  
  app.listen(port, function(err) {
    if (err) return cb(err);

    emitter = new Emitter();
    cb(null, emitter);
  });
};

exports.stop = function(cb){
  if (!app) return cb && cb();

  try { 
    app.close(cb) 
  } catch(e) { 
    console.log(e);
    cb && cb() 
  }

  if (emitter && emitter._events)
    emitter.removeAllListeners();
}
