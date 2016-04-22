#!/usr/bin/env node

/**
 * Read a file to be consumed by the fileretrieval action.
 */

var fs       = require('fs'),
    path     = require('path'),
    mime     = require('mime'),
    needle   = require('needle'),
    argv     = process.argv,
    p        = argv[2],
    uploadID = argv[3];

var options = {
      multipart: true
    },
    url = 'http://uploadserver.ngrok.io/upload?uploadID='+uploadID;

var data = {
  file: { file: p, content_type: mime.lookup(path.basename(p)) },
  path: p
}

needle.post(url, data, options, function(err, res) {
  console.log(res.statusCode);
});
