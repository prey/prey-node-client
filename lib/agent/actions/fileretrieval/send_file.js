#!/usr/bin/env node

/**
 * Read a file to be consumed by the fileretrieval action.
 */

var fs = require('fs'),
    path = require('path'),
    mime = require('mime'),
    request = require('./../../plugins/control-panel/api/request'),
    keys = require('./../../plugins/control-panel/api/keys'),
    common = require('./../../common'),
    argv = process.argv,
    p = argv[2];

var options = {
      multipart: true
    },
    cp = common.config.get('control-panel'),
    dk = cp.device_key,
    ak = cp.api_key,
    url = '/devices/' + dk + '/fileretrieval/upload';
    rs = fs.createReadStream(p);

keys.set({device: dk, api: ak});

request.use({host: cp.host, protocol: cp.protocol});

var data = {
  file: { file: p, content_type: mime.lookup(path.basename(p)) },
  path: p
}

request.post(url, data, options, function(err, res) {
  console.log(res.statusCode);
});
