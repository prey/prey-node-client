var cache = {};
var default_expires = 5000;

module.exports = function(key, val, expires_in) {

  if (!val && cache[key]) {

    if (cache[key].valid_until > Date.now())
      return cache[key].value;
    else
      delete cache[key];

  } else if (val) {

    cache[key] = {};
    cache[key].value = val;
    cache[key].valid_until = (Date.now() + (expires_in || default_expires));

  }

}
