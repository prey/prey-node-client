var join    = require('path').join,
    nir_exe = join(__dirname, 'bin', 'nircmd.exe');

exports.play = join(__dirname, 'bin', 'mpg123.exe');
exports.raise_volume = '"' + nir_exe + '" setsysvolume 65535 & ' + '"' + nir_exe + '" mutesysvolume 0';
