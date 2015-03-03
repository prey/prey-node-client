var join = require('path').join;

exports.play = join(__dirname, 'bin', 'mpg123.exe');
exports.raise_volume = '"' + join(__dirname, 'bin', 'voladjust.exe') + '" 100 ';
