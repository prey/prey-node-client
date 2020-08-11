var fs           = require('fs'),
    join         = require('path').join,
    real_path    = join(__dirname, '/../../../../../'),
    default_path = process.env.WINDIR + '\\Prey';

var files = ['prey.conf', 'commands.db', 'prey.log'];
if (real_path != default_path) {
  files.forEach(file => {
    if (!fs.existsSync(join(real_path, file))) {
      try { fs.copyFileSync(join(default_path, file), join(real_path, file)) }
      catch(e) { /* no problem */}
    }
  });
}

exports.bin      = 'prey.cmd';
exports.config   = real_path;
exports.temp     = process.env.WINDIR + '\\Temp';
exports.log      = exports.config;
exports.log_file = exports.log + '\\prey.log';