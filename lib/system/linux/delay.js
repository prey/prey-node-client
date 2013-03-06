var fs       = require('fs'),
    exec     = require('child_process').exec,
    paths    = require('./../').paths,
    bin_path = paths.current_bin,
    log_path = paths.log_file;

var random_between = function(from, to){
  return Math.floor(Math.random() * (to - from + 1) + from);
};

exports.get = function(callback) {

  var delay_value;

  exec('crontab -l', function(err, stdout){
    if (err) return callback();

    var lines = stdout.toString().trim().split("\n");

    lines.forEach(function(el){
      if (el.indexOf(bin_path) !== -1)
        delay_value = el.replace(/ \*.*/, ''); // .replace('*/', '');
    });

    if (!delay_value) return callback();

    var delay = {
      value: delay_value.replace('*/', ''),
      one_hour: delay_value.indexOf('*/') === -1
    };

    callback(delay);
  });

};

exports.set = function(new_delay, callback){
  var delay_string = parseInt(new_delay) == 60
      ? random_between(1, 59)
      : "*/" + new_delay;

  var cmd = 'crontab -l | grep -v "' + bin_path + '"; \
  echo "' + delay_string + " * * * * " + bin_path + '" | crontab -'

  exec(cmd, function(err){
    if (err) return callback(err);

    exec('crontab -l', function(err, stdout){
      if (err) return callback(err);

      var e = stdout.toString().match(bin_path) ? null : new Error('Crontab line not set!');
      callback(e);
    })
  });
};

exports.unset = function(cb){
  var cmd = 'crontab -l | grep -v "' + bin_path + '" | crontab -';
  exec(cmd, cb);
}
