var join = require('path').join;

exports.play = join(__dirname, 'bin', 'mpg123.exe');
exports.raise_volume = '"' + join(__dirname, 'bin', 'nircmdc.exe') + '" changesysvolume 65535 & "' + join(__dirname, 'bin', 'nircmd.exe') + '" mutesysvolume 0';
