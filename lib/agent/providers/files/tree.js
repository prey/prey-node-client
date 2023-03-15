// #!/usr/bin/env node

//////////////////////////////////////////
// Prey JS FileRetrieval
// (C) 2019 Prey, Inc.
// by Mauricio Schneider and Javier Acuña - http://preyproject.com
// GPLv3 Licensed
//////////////////////////////////////////

/**
 * Traverses directories and return its content.
 * Needed as stand-alone in order to be ran as an specific user
 * due to read permissions in *nix systems.
 */

var fs      = require('fs'),
    path    = require('path'),
    mime    = require('mime'); 

var argv    = process.argv,
    p       = argv[3],
    d       = argv[2] || 1,
    cd      = 1,
    os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

var directoryTreeToObj = function(dir, current_depth, depth, done) {
  var resultsDir  = [],
      resultsFile = [];

  if (os_name == 'windows') dir = dir + '\\';

  fs.readdir(dir, function(err, list) {
    if (err)
      return done(err);

    var pending = list.length;
    if (!pending) {
      if (pending <= 0) {
        return done(null, resultsDir.concat(resultsFile));
      } else {
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
        // Documents and Setting folder on Windows is not accesible because is a link for
        // compatibility between the OS versions, so it shouldn't be visible in FR.
        if (err || (os_name == "windows" && path.basename(file) == "Documents and Settings")) {
          pending--;
        } else {
          if (stat && stat.isDirectory() && current_depth < depth) { 
            directoryTreeToObj(file, current_depth + 1, depth, function(err, res) {
              var dirname = path.dirname(file),
                  name = path.basename(file),
                  p = path.join(dirname, name),
                  newFile = {
                    name: name,
                    path: p,
                    isFile: stat.isFile(),
                    children: res
                  };

              resultsDir.push(newFile);
              if (!--pending)
                done(null, resultsDir.concat(resultsFile));

            });
          } else if (stat) {
            var dirname = path.dirname(file),
                name = path.basename(file),
                p = path.join(dirname, name),
                newFile = {
                  name: name,
                  path: p,
                  mimetype: mime.lookup(file),
                  size: stat.size,
                  isFile: stat.isFile(),
                };
             
              if (stat.isFile())
                resultsFile.push(newFile);
              else
                resultsDir.push(newFile);
              if (!--pending)
                done(null, resultsDir.concat(resultsFile));

          }
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
