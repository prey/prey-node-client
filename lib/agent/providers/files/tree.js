//#!/usr/bin/env node

/**
 * Traverses directories and return its content.
 * Needed as stand-alone in order to be ran as an specific user
 * due to read permissions in *nix systems.
 */

var fs = require('fs'),
  path = require('path'),
  walk = require('walkdir'),
  argv = process.argv,
  p = argv[2];

function letswalk(p) {
  var em = walk(p);

  em.on('path', function(path, stat, depth) {
    console.log(path);
  });
  em.on('end', function() {
    console.log("I'm done walking.");
  });
  em.on('error', function(path, err) {
    console.log(err);
  });
}

letswalk(p || '/');
