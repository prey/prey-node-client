
////////////////////////////////////////////////////////////
// Generates new config file based on each driver settings.
// Dumps new config file in root_path/prey.conf.default
////////////////////////////////////////////////////////////

var path    = require('path'),
    getset  = require('getset'),
    plugins = require('wink').init('./lib/agent/plugins'),
    version = require(__dirname + '/../package').version;

var base_opts   = __dirname + '/../lib/agent/default.options',
    config_file = __dirname + '/../prey.conf.default';

var temp_config = getset.load(base_opts);

function plugin_list() {
  var sort_method = function(a,b) { return a != 'control-panel' && a > b };
  var list = temp_config.get('plugin_list').sort(sort_method);
  return list;
}

function is_empty(val) {
  return typeof val == 'undefined' || val === null;
}

function merge_options(options, plugin_name) {
  var values   = {};
  var comments = {};

  for (var key in options) {
    values[key] = is_empty(options[key].default) ? '' : options[key].default;
    if (options[key].message) {
      comments[key] = options[key].message;
    }
  }

  // merge values
  temp_config.set(plugin_name, values);

  // now merge comments
  var obj = {};
  obj[plugin_name] = comments;
  temp_config.merge_data('meta', { comments: obj }, true);
}

function generate(destination) {

  plugin_list().forEach(function(plugin_name) {
    console.log('Getting options for ' + plugin_name)

    var options = plugins.get(plugin_name).options;
    if (options) {
      merge_options(options, plugin_name);
    }
  })

  temp_config.path = destination;

  temp_config.save(function(err){
    if (err) return console.log(err);
    else console.log("Config file saved in " + config_file);
  });

}

generate(config_file);
