var registry = require('./registry'),
    reg_path = 'HKLM\\Software\\Prey';

exports.get = function(cb) {
  registry.get(reg_path, 'Delay', cb)
};

exports.set = function(new_delay, cb){
  registry.set(reg_path, 'Delay', new_delay, cb)
};
