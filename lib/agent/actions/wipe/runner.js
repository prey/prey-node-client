#!/usr/bin/env node

var wipe    = require('./wipe'),
    what    = process.argv;
  
// variable to store last error
var last_err;

// pad node binary and script path
what.shift();
what.shift();

// Get the cloud config dirs and processes
var to_erase = what.pop().split(','),  // 'Google Drive', 'Dropbox'
    to_kill  = what.pop().split(',');

// process each of the requested items to wipe
wipe.fetch_dirs(what, to_erase, to_kill, function(err) {
  if (err) last_err = err;
  wipe.wipeout(function(err) {
    if (err) last_err = err;
    process.exit();
  })
})

process.on('SIGTERM', function() {
  process.exit();
})

process.on('exit', function(code) {
  console.log('Wipe finished. Last error: ' + (last_err || 'none.'));
})
