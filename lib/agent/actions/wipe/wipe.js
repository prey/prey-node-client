var fs       = require('fs'),
    join     = require('path').join,
    remove   = require('remover'),
    os_name  = process.platform.replace('win32', 'windows').replace('darwin', 'mac'),
    os_wipe  = require('./' + os_name),
    paths    = os_wipe.paths;

require('graceful-fs');

var output   = null,
    remover  = null;

//////////////////////////////////////////////////
// paths

function get_windows_drive() {
  return process.env.SystemDrive || 'C:';
}

var homes = {
  linux   : '/home',
  darwin  : '/Users',
  win32   : join(get_windows_drive(), 'Users')
}

if (process.platform == 'win32' && parseFloat(require('os').release()) < 6) {
  homes.win32 = join(get_windows_drive(), 'Documents and Settings')
}

//////////////////////////////////////////////////
// helpers

var write = function(str) {
  if (output)
    output.write(str + '\n');
}

//////////////////////////////////////////////////
// exports

exports.output = function(stream) {
  output = stream;
  remove.output(stream);
}

exports.documents = function(cb) {
  wipe('documents', cb)
}

exports.emails = function(cb) {
  wipe('emails', cb)
}

exports.passwords = function(cb) {
  wipe('keychains', cb)
}

exports.cookies = function(cb) {
  wipe('browsers', function(err) {
    if (os_name != 'windows')
      return cb(err);

    // if os is windows, do IE-specific stuff before returning
    os_wipe.clear_ie(function(err, out) {
      if (err) write('Error removing IE data: ' + out.toString());

      cb();
    })
  })
}

exports.stop = function() {
  remover.stop();
}

var wipe = function(what, cb) {
  var last_err,
      dirs  = 0,
      root  = homes[process.platform];

  var done = function(err, removed) {
    if (err)
      write('Error while removing dir: ' + err.message);

    if (err && err.code != 'ENOENT') {
      last_err = err;
    }

    --dirs || cb(last_err, removed);
  }

  fs.readdir(root, function(err, list) {
    if (err) return cb(err);

    list.forEach(function(user) {
      paths[what].forEach(function(dir) {
        dirs++;
        remover = remove(join(root, user, dir, '*'), done)
      })
    });

  });

}
