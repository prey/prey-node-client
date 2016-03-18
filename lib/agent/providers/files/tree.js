#!/usr/bin/env node

/**
 * Traverses directories and return its content.
 * Needed as stand-alone in order to be ran as an specific user
 * due to read permissions in *nix systems.
 */

var fs = require('fs'),
  path = require('path'),
  mime = require('mime'),
  argv = process.argv,
  p = argv[3],
  d = argv[2] || 1,
  cd = 1,
  os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

var directoryTreeToObj = function(dir, current_depth, depth, done) {
  var resultsDir = [];
  var resultsFile = [];

  fs.readdir(dir, function(err, list) {
    if (err)
      return done(err);

    var pending = list.length;

    if (!pending){
      if (pending <= 0){
        return done(null, resultsDir.concat(resultsFile));
      }
      else{
        return done(null, {
          name: path.basename(dir),
          type: 'folder',
          children: resultsDir.concat(resultsFile)
        });
      }
    }
    list.forEach(function(file) {
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory() && current_depth < depth) { 
          directoryTreeToObj(file, current_depth + 1, depth, function(err, res) {
            var dirname = path.dirname(file),
                name = path.basename(file),
                p = path.join(dirname, name);

            checkIfHiddenFile(p, name, function(isHidden) {
              var newFile = {
                name: name,
                path: p,
                isFile: stat.isFile(),
                hidden: isHidden,
                children: res
              };
              resultsDir.push(newFile);

              if (!--pending)
                done(null, resultsDir.concat(resultsFile));
            });

          });
        } else if (stat) {
          var dirname = path.dirname(file),
              name = path.basename(file),
              p = path.join(dirname, name);

          checkIfHiddenFile(p, name, function(isHidden) {
            var newFile = {
              name: name,
              path: p,
              mimetype: mime.lookup(file),
              size: stat.size,
              isFile: stat.isFile(),
              hidden: isHidden
            };
           
            if (stat.isFile())
              resultsFile.push(newFile);
            else
              resultsDir.push(newFile);

            if (!--pending)
              console.log();
              done(null, resultsDir.concat(resultsFile));
              
          });

        }
      });
    });
  });
};

directoryTreeToObj(p, cd, d, function(err, res) {
  if (err)
    console.error(err);

  console.log(JSON.stringify(res));
});

var checkIfHiddenFile = function(path, name, cb){
  if (os_name == "windows") {
    var exec = require('child_process').exec,
        cmd = 'attrib '+ path;
    exec(cmd, function(err, stdout) {
      if (err)
        return cb(false);
      var stdout2 = stdout.split("\ ");
      if (stdout2.indexOf("SH") != -1)
        return cb(true);
      else if (stdout2.indexOf("H") != -1)
        return cb(true);
      else
        return cb(false);
    });
  }
  else {
    return cb((/(^|\/)\.[^\/\.]/g).test(name));
  }
}
