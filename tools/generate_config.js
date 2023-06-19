
////////////////////////////////////////////////////////////
// Generates new config file based on each driver settings.
// Dumps new config file in root_path/prey.conf.default
////////////////////////////////////////////////////////////

const getset = require('getset');

const baseOpts = __dirname + '/../lib/agent/default.options';
const configFile = __dirname + '/../prey.conf.default';
const tempConfig = getset.load(baseOpts);

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
  tempConfig.set(plugin_name, values);

  // now merge comments
  var obj = {};
  obj[plugin_name] = comments;
  tempConfig.merge_data('meta', { comments: obj }, true);
}

function generate(destination) {
  tempConfig.path = destination;

  tempConfig.save(function(err){
    if (err) return console.log(err);
    else console.log("Config file saved in " + configFile);
  });

}

generate(configFile);
