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
  p = argv[2],
  d = argv[3] || 1,
  cd = 1;

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
                h = (/(^|\/)\.[^\/\.]/g).test(file);

            var newFile = {
              name: name,
              path: p,
              isFile: stat.isFile(),
              hidden: h,
              children: res
            };
            if (stat.isFile())
              resultsFile.push(newFile);
            else
              resultsDir.push(newFile);

            if (!--pending)
              done(null, resultsDir.concat(resultsFile));
          });
        } else if (stat) {
          var dirname = path.dirname(file),
              name = path.basename(file),
              p = path.join(dirname, name);
              h = (/(^|\/)\.[^\/\.]/g).test(file);

          var newFile = {
            name: name,
            path: p,
            mimetype: mime.lookup(file),
            size: stat.size,
            isFile: stat.isFile(),
            hidden: h
          };
          if (stat.isFile())
            resultsFile.push(newFile);
          else
            resultsDir.push(newFile);

          if (!--pending)
            done(null, resultsDir.concat(resultsFile));
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
