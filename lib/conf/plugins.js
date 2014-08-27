var shared = require('./shared');

/////////////////////////////////////////////////////////////////
// helpers

var pad = function(str, len, char) {
  return (new Array(len).join(char || ' ')+str).slice(-len);
}

var log = function(str) {
  shared.log(str);
}

/////////////////////////////////////////////////////////////////
// exports

exports.search = function(values, cb) {
  var query = values.positional[0];

  shared.plugin_manager.search(query, function(err, res) {
    if (err) return cb(err);

    log(res.toString());
  })
}

exports.list = function(values, cb) {
  var list    = shared.plugin_manager.installed(),
      enabled = shared.plugin_manager.enabled();

  log('\n List of available and enabled plugins:\n')

  // the list object is a special one, since it defines the name
  // of each plugin as a getter, not a key: val. luckily, we also
  // have a 'keys' getter that will return the list of keys, to enumerate.
  list.keys.forEach(function(name) {
    var plugin = list[name],
        status = (enabled.indexOf(name) === -1) ? '   ' : ' √ ';
    log(pad(name, 24) + status + '- ' + plugin.description);
  });

  log('\n');

}

exports.enable = function(values, cb) {
  var name = values.plugin_name;

  shared.plugin_manager.enable(name, function(err, res) {
    if (err) return cb(err);

    log('Succesfully enabled ' + name + ' plugin.');
  });
}

exports.disable = function(values, cb) {
  var name  = values.plugin_name,
      prune = values['-p'] === true;

  shared.plugin_manager.disable(name, function(err, res) {
    if (err) return cb(err);

    log('Succesfully disabled ' + name + ' plugin.');

    if (prune) shared.plugin_manager.prune(name, cb);
  });
};