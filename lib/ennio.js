var fs      = require('fs'),
    join    = require('path').join,
    resolve = require('path').resolve;

var bosses  = {};

var module_not_found = function(path) {
  var err = new Error('Cannot find module ' + path);
  err.code = 'MODULE_NOT_FOUND';
  return err;
}

var require_lazy = function(directory) {
  var result = {},
      files = fs.readdirSync(directory);
  
  var list  = files.map(function(file) {
    if (file.substr(-3) !== '.js')
      return file;

    return file.substr(0, file.length - 3);
  })

  list.forEach(function(file) {
    Object.defineProperty(result, file, {
      get: function() {
        return result[file] = require(resolve(directory, file, 'package.json'));
      }
    });
  });

  Object.defineProperty(result, 'keys', { 
    get: function() {
      return list;
    }
  })

  return result;
};

//////////////////////////
// functions

var Boss = function(path) {

  var list = null;

  var load_metas = function() {
    if (list !== null) return list;
    list = require_lazy(path);
    return list;
  }

  var req = function(plugin_name) {
    try {
      return require(join(path, plugin_name));
    } catch(e) {
      // console.log(e);
    }
  }

  // calls the given method from a plugin
  // checks whether the function has a callback defined
  // returns false if no method called, or true if called 
  var invoke = function(plugin_name, method, obj, cb) {
    var module = req(plugin_name);
    if (!module) {
      cb && cb(module_not_found(plugin_name));
      return false;
    }

    if (typeof module[method] !== 'function') {
      cb && cb();
      return false;
    }

    var arity = module[method].length;

    if (arity == 0) {
      var res = module[method].call(obj);
      cb(null, res);
    }  else {
      module[method].call(obj, cb);
    }

    return true;
  } 

  return {
    all: function() {
      return load_metas();
    },
    get: function(plugin_name) {
      return load_metas()[plugin_name];
    },
    reload: function() {
      list = null;
      return this;
    },
    require: function(plugin_name) {
      return req(plugin_name);
    },
    invoke: function(plugin_name, method, obj, cb) { 
      return invoke(plugin_name, method, obj, cb);
    }
  }
}

//////////////////////////
// exports

exports.init = function(dir) {
  var path = resolve(dir);
  if (bosses[path])
    return bosses[path];

  bosses[path] = new Boss(path);
  return bosses[path];
}