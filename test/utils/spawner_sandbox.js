var fs = require('fs');

exports.put = function(file, deps, vars, cb) {

  if (typeof vars == 'function') {
    cb = vars;
    vars = {};
  }

  var serialize = function(obj) {
    return JSON.stringify(obj, function(key, val) {
      if (typeof val === 'function') {
        // return val.toString();
        return '____' + val + '____';
      }
      return val;
    });
  }

  var replace_deps = function(str, deps) {
    for (var name in deps) {
      var regex = new RegExp("require.*" + name + ".*\\)");
      if (str.match(regex)) {
        str = str.replace(regex, serialize(deps[name]));
      }
    }
    for (var name in vars) {
      for (var key in vars[name]) {
        str = name + '.' + key + ' = ' + serialize(vars[name][key]) + ";\n" + str;
      }
    }

    return str.replace(/\"?____\"?/g, '').replace(/\\n/g, '');
  }

  exports.release(file, function(err) {
    if (!err) console.log('Unclean previous execution.');

    fs.readFile(file, function(err, data) {
      if (err) return cb(err);

      var modified = replace_deps(data.toString(), deps);
      // console.log(modified);

      fs.rename(file, file + '.original', function(err) {
        if (err) return cb(err);

        fs.writeFile(file, modified, cb);
      })

    })
  })

  return {
    release: function(done) {
      exports.release(file, done);
    }
  }

}

exports.release = function(file, cb) {
  fs.exists(file + '.original', function(exists) {
    if (!exists)
      return cb(new Error('Original file not found.'));

    fs.unlink(file, function(err) {
      if (err) return cb(err);

      fs.rename(file + '.original', file, cb);
    })
  })
}
