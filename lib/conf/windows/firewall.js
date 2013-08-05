
var exec    = require('child_process').exec,
    release = require('os').release(),
    join    = require('path').join,
    system  = require(join(__dirname, '..', '..', 'system')),

var firewall = {};

firewall.add_rule = function (cb) {
  var bin_path = join(system.paths.current, 'bin', 'node.exe'),
      command;
  if (parseFloat(release) >= 6.0) { // vista or higher
    command = 'netsh advfirewall firewall add rule name="Prey Agent" dir=in action=allow program="' + bin_path + '" enable=yes';
  } else {
    command = 'netsh firewall add allowedprogram "' + bin_path +'" "Prey Agent" ENABLE';
  }
  exec(command, cb);
}

firewall.remove_rule = function (cb) {
  var command;
  if (parseFloat(release) >= 6.0) {
    command = 'netsh advfirewall firewal delete rule name="Prey Agent';
  } else {
    command = 'netsh firewall delete allowedprogram "' + bin_path +'"';
  }
  exec(command, cb);
}

module.exports = firewall;
