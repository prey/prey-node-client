#!/usr/bin/env node

var wipe  = require('./wipe'),
    what  = process.argv;

// variable to store last error
var last_err;

// pad node binary and script path
what.shift();
what.shift();

// set log output
wipe.output(process.stdout);

// process each of the requested items to wipe
what.forEach(function(item) {
  console.log('Wiping: ' + item);
  wipe[item](function(err, removed) {
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
