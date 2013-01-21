var registry = require('./registry'),
    reg_path = 'HKLM\\Software\\Prey';

exports.get = function(cb) {
  registry.get(reg_path, 'Delay', function(err, val){
    if (err) return cb();
    var obj = {
      value: val,
      one_hour: val == (60 * 60 * 1000)
    }
    cb(obj);
  })
};

exports.set = function(new_delay, cb){
  var number = new_delay * 60 * 1000; // delay is passed in minutes
  registry.set(reg_path, 'Delay', number, cb);
};

exports.unset = function(cb){
  registry.del(reg_path, 'Delay', cb);
}
