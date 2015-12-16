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
  current_depth = 0;

var directoryTreeToObj = function(dir, depth, done) {
  var results = [];

  current_depth++;

  fs.readdir(dir, function(err, list) {
    if (err)
      return done(err);

    var pending = list.length;

    if (!pending)
      return done(null, {
        name: path.basename(dir),
        type: 'folder',
        children: results
      });

    list.forEach(function(file) {
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory() && current_depth <= depth) {
          directoryTreeToObj(file, depth, function(err, res) {
            var dirname = path.dirname(file),
                name = path.basename(file),
                p = path.join(dirname, name);
            results.push({
              name: name,
              path: p,
              isFile: stat.isFile(),
              children: res
            });
            if (!--pending)
              done(null, results);
          });
        } else if (stat) {
          var dirname = path.dirname(file),
              name = path.basename(file),
              p = path.join(dirname, name);

          results.push({
            name: name,
            path: p,
            mimetype: mime.lookup(file),
            size: stat.size,
            isFile: stat.isFile()
          });
          if (!--pending)
            done(null, results);
        }
      });
    });
  });
};

directoryTreeToObj(p, d, function(err, res) {
  if (err)
    console.error(err);

  console.log(JSON.stringify(res));
});
