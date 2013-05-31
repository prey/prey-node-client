var hooks = require('./hooks'),
    endpoints = {},
    senders = [];

var send = function(key, data) {
  senders.forEach(function(sender){
    console.log('Sending data via ' + sender);
    // sender.send(key, data)
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

endpoints.set = function(list) {
  senders = list;
//  console.log('Loaded transports: ' + list);
}

module.exports = endpoints;
