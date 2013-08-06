
var exec    = require('child_process').exec;

var firewall = {};

firewall.add_rule = function (param, cb) {
  var command;
  if (parseFloat(release) >= 6.0) { // vista or higher
    command = 'netsh advfirewall firewall add rule name="' + param.desc + '" dir=in action=allow program="' + param.bin + '" enable=yes';
  } else {
    command = 'netsh firewall add allowedprogram "' + param.bin + '" "' + param.desc + '" ENABLE';
  }
  exec(command, cb);
}

firewall.remove_rule = function (param, cb) {
  var command;
  if (parseFloat(release) >= 6.0) {
    command = 'netsh advfirewall firewal delete rule name="' + param.desc + '"';
  } else {
    command = 'netsh firewall delete allowedprogram "' + param.bin +'"';
  }
  exec(command, cb);
}

module.exports = firewall;
