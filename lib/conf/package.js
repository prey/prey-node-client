var needle = require('needle'),
    unzip = require('./../utils/unzip'),
    releases_url = 'http://localhost:8888/';

var package = module.exports;

package.get_latest = function(current_version, dest, cb){
  package.check_latest_version(function(err, upstream_version){
    if (err || upstream_version == current_version)
      // return cb(err); // if err is empty, the process will set and the latest version IS set
      return cb(err || new Error('Latest version already installed.'));

    package.get_version(upstream_version, dest, function(err){
      callback(err, version);
    });
  })

};

package.get_version = function(version, dest, cb){
  package.download_release(version, function(err, file){
    if (err) return cb(err);
    package.install(file, dest, cb);
  });
}

package.download_release = function(version, cb){
  var package_url = releases_url + version;
  package.download(package_url, cb);
}

package.download = function(url, cb){
  var file = system.tempfile_path(path.basename(url) + '.zip');

  needle.get(url, { output: file }, function(err, resp, data){
    if (err) return cb(err);
    return cb(null, file);
  });
}

package.install = function(zip, dest, cb){
  unzip(zip, dest, cb);
}
