const exec = require('child_process').exec;

const cmd = 'powershell -Command "Get-WmiObject -Class Win32_LogicalDisk | Select-Object -ExpandProperty DeviceID | fl"';
   
module.exports.get_users_list = function(cb) {
  exec(cmd, (err, stdout) => {
    cb(err, stdout.trim().replaceAll('\r', '').split('\n'));
  });
};
