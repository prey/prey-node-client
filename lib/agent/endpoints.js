var loader    = require('./loader'),
    hooks     = require('./hooks'),
    logger    = require('./common').logger.prefix('endpoints'),
    endpoints = {},
    senders   = [];

var send = function(key, data) {
  senders.forEach(function(endpoint){
    console.log('Sending data to ' + endpoint.name);
    endpoint.send(key, data, {}, function(err, resp){
      if (err)
        return hooks.emit('error', err);

      var str = resp.body ? resp.body.toString() : resp.statusCode;
      logger.info('Response from ' + endpoint.name + ': ' + str);
      hooks.emit('response', resp);
    })
  })
}

endpoints.notify_action = function(name, status, err){
  console.log('Action: ' + name);
  var body = {
    name: name,
    status: status
  }
  if (err) body.reason = err.message;
  send('action', body);
}

endpoints.notify_event = function(name, data){
  var body = {
    name: name,
    info: data
  }
  send('events', body);
}

endpoints.send_data = function(name, data) {
  var body = {};
  body[name] = data;
  send('data', body);
}

endpoints.send_report = function(name, data) {
  var body = {};
  body[name] = data;
  send('report', body);
}

endpoints.init = function(list, cb) {

  if (!list || !list[0])
    return cb && cb(new Error('No endpoints found'));

  var error, count = list.length;

  var done = function(err, endpoint){
    if (err)
      error = err;
    else
      senders.push(endpoint);

    --count || (cb && cb(error));
  }

  var load = function(name) {
    loader.load_endpoint(name, function(err, endpoint){
      if (err) return done(err);

      endpoint.name = name;
      endpoint.init(function(err){
        done(err, endpoint);
      });
    })
  };

  list.forEach(load);
}

module.exports = endpoints;
