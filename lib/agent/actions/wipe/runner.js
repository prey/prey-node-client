#!/usr/bin/env node

var wipe  = require('./wipe'),
    what  = process.argv;

var last_err;

what.shift();
what.shift();

wipe.output(process.stdout);

what.forEach(function(item) {
  console.log('Wiping: ' + item);
  wipe[item](function(err) {
    if (err) last_err = err;
  })
})

process.on('exit', function(code) {
  process.exit(last_err ? 1 : 0);
})
