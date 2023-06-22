// var common    = require('./../../common'),
//     config    = common.config,
//     plugins   = common.plugins,
//     reply     = require('reply');

// ///////////////////////////////////////////////////
// // helpers

// // merges plugin default options with existing values in config
// function merge_options(obj, options) {
//   // if no current options, just return the default ones.
//   if (!obj) return options;

//   for (var key in options) {
//     var current = obj[key];
//     if (current && current != '') {
//       options[key].default = current;
//     }
//   }
//   return options;
// }

// function store_options(plugin_name, options, values, cb) {
//   var comments = {};

//   for (var key in options) {
//     if (options[key].message) {
//       comments[key] = options[key].message; 
//     }
//   }

//   // merge values
//   config.set(plugin_name, values);

//   // now merge comments
//   var obj = {};
//   obj[plugin_name] = comments;
//   config.merge_data('meta', { comments: obj }, true);

//   config.save(cb);
// }

// ///////////////////////////////////////////////////
// // exports

// exports.search = function(query, cb) {
//   return cb(new Error('Not implemented yet. :)'));
// }

// /*

// function get_name(name) {
//   return 'prey-plugin-' + name;
// }

// exports.install = function(plugin_name, cb) {
//   exec('npm install ' + get_name(plugin_name), cb);
// }

// exports.remove = function(plugin_name, cb) {
//   exec('npm remove ' + get_name(plugin_name), cb);
// }
// */

// exports.setup = function(name, cb) {

//   var plugin_options;

//   var done = function(err, values) {
//     if (!err && values) 
//       return store_options(name, plugin_options, values, cb);

//     cb(err, values);
//   }

//   installed.setup(name, function(err, opts) {
//     if (err || opts) return done(err, opts); 

//     // ok, no custom setup function. let's check if it has options in its package.json
//     plugin_options = plugins.get(name).options || {};
//     if (!plugin_options || Object.keys(plugin_options).length == 0)
//       return done();

//     // we got options, so let's prompt the user
//     // but before let's check if any existing values are found
//     var merged_opts = merge_options(config.get(name), plugin_options);
//     reply.get(merged_opts, done);
//   });

// }

// exports.enable = function(name, cb) {
//   if (!name)
//     return cb(new Error('Plugin name required.'));

//   var rollback = function(err) {
//     // dont remove config if failed. it might have been triggered
//     // because he/she pressed Ctrl-C when going through the wizard.
//     return cb(err);

//     exports.prune(name, function(e) {
//       cb(err);
//     });
//   }

//   if (plugins.is_enabled(name))
//     return cb(new Error('Plugin already enabled: ' + name));

//   if (!plugins.exists(name))
//     return cb(new Error('Plugin not found: ' + name));

//   // setup plugin options
//   exports.setup(name, function(err) {
//     if (err) return rollback(err);

//     // load plugin and notify activation
//     installed.enabled(name, function(err) {
//       if (err) return rollback(err);

//       // if all good, then add to config
//       plugins.add(name, function(err) {
//         return err ? rollback(err) : cb();
//       });
//     })
//   })
// }

// exports.disable = function(name, cb) {
//   if (!name)
//     return cb(new Error('Plugin name required.'));

//   if (!plugins.is_enabled(name))
//     return cb(new Error('The ' + name + ' plugin does not appear to be enabled.'));
//   else if (plugins.get_enabled().length == 1)
//     return cb(new Error('Cannot disable. At least one plugin is required!'))

//   installed.disabled(name, function(err) {
//     if (err) return cb(err);

//     // remove plugin from list
//     plugins.remove(name, cb);
//   })
// }

// exports.prune = function(name, cb) {
//   config.update(name, null, cb);
// }

// exports.disable_all = function(cb) {
//   var count, last_error;

//   var done = function(err) {
//     if (err) last_error = err;
//     --count || cb(last_error);
//   }

//   var disable = function(name) {
//     installed.disabled(name, function(err) {
//       done(err);
//       // remove_from_config(name, done);
//     })
//   }

//   var list  = plugins.get_enabled(),
//       count = list.length;

//   list.forEach(disable);
// }

// exports.enabled   = plugins.get_enabled;
// exports.installed = plugins.all;
// exports.force_enable = plugins.add;
