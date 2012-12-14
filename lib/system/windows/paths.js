var os = require('os');

exports.bin      = 'prey.cmd';
exports.config   = process.env.WINDIR + '\\Prey'; // __dirname + '/../../../'
exports.temp     = os.tmpDir();
exports.log      = exports.config;
exports.log_file = exports.log + '\\prey.log'
