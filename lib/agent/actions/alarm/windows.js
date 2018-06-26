var join      = require('path').join,
    unmute    = join(__dirname, 'bin', 'unmuter.exe'),
    voladjust = join(__dirname, 'bin', 'voladjust.exe');

exports.play = join(__dirname, 'bin', 'mpg123.exe');
exports.raise_volume = unmute + ' & ' + voladjust + ' 100';
