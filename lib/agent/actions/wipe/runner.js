#!/usr/bin/env node

var wipe    = require('./wipe'),
    os_name = require('./../../common').os_name,
    os_wipe = require('./' + os_name),
    what    = process.argv;

// variable to store last error
var last_err;

// insert custom directories in the wipe paths
os_wipe.paths.directories = what.pop().split(',');

// pad node binary and script path
what.shift();
what.shift();

// set log output
wipe.output(process.stdout);

// process each of the requested items to wipe
wipe.fetch_dirs(what, function(err) {
  if (err) last_err = err;
  wipe.wipeout(function(err) {
    if (err) last_err = err;
  })
})

process.on('SIGTERM', function() {
  wipe.stop();
  process.exit();
})

process.on('exit', function(code) {
  console.log('Wipe finished. Last error: ' + (last_err || 'none.'));
})
