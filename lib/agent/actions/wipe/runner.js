#!/usr/bin/env node

var wipe    = require('./wipe'),
    os_name = require('./../../common').os_name,
    os_wipe = require('./' + os_name),
    what    = process.argv;

// variable to store last error
var last_err;

// pad node binary and script path
what.shift();
what.shift();

// 
var to_erase = what.pop().split(','),  // 'Google Drive', 'Dropbox'
    to_kill  = what.pop().split(',');

// set log output
wipe.output(process.stdout);

// process each of the requested items to wipe
wipe.fetch_dirs(what, to_erase, to_kill, function(err) {
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
