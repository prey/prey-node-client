var registry = require('./registry'),
    reg_path = 'HKLM\\Software\\Prey';

exports.get = function(cb) {
  registry.get(reg_path, 'Delay', function(err, val){
    if (err) return cb();
    var obj = {
      value: val,
      one_hour: val == 60 * 60 * 1000
    }
    cb(obj);
  })
};

exports.set = function(new_delay, cb){
  registry.set(reg_path, 'Delay', new_delay, cb);
};

exports.unset = function(cb){
  registry.set(reg_path, 'Delay', '', cb);
}
