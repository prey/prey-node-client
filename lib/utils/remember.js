var cache = {};
var default_expires = 5000;

var get = function(key, val) {
  if (cache[key]) {
    if (cache[key].valid_until > Date.now())
      return cache[key].value;
    else
      delete cache[key];
  }

};

var set = function(key, val, expires_in) {
  if (!val) throw('No value passed');

  cache[key] = {};
  cache[key].value = val;
  cache[key].valid_until = (Date.now() + (expires_in || default_expires));
}

module.exports = function(fn, expires_in){

  var memoized = function(cb){
    var res = get(fn);
    if (res) {
      return cb(null, res);
    }

    fn(function(err, res){
      if (!err && res)
        set(fn, res, expires_in);

      cb(err, res);
    });
  }

  return memoized;

}
