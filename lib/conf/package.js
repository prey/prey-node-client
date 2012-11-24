var fs     = require('fs'),
    path   = require('path'),
    needle = require('needle'),
    unzip  = require('./../utils/unzip'),
    system = require('./../system');

var releases_url = 'http://localhost:8000/',
    package_format = '.zip';

var package = module.exports;

package.check_latest_version = function(cb){
  console.log('Checking latest version...');
  needle.get(releases_url + 'latest/version.txt', function(err, resp, body){
    if (err) return cb(err);

    cb(null, '0.8.1');
  })
}

package.get_latest = function(current_version, dest, cb){

  package.check_latest_version(function(err, upstream_version){
    if (err || upstream_version == current_version)
      // return cb(err); // if err is empty, the process will set and the latest version IS set
      return cb(err || new Error('Latest version already installed.'));

      if (fs.existsSync(path.join(dest, upstream_version)))
        return cb(new Error('Version ' + upstream_version + ' already installed'));

    package.get_version(upstream_version, dest, function(err){
      console.log(err);
      cb(err, upstream_version);
    });
  })

};

package.get_version = function(version, dest, cb){
  console.log('Fetching version ' + version);
  package.download_release(version, function(err, file){
    if (err) return cb(err);
    package.install(file, dest, cb);
  });
}

package.download_release = function(version, cb){
  var package_url = releases_url + 'prey-' + version + package_format;
  package.download(package_url, cb);
}

package.download = function(url, cb){
  console.log('Downlading package: ' + url);
  var file = system.tempfile_path(path.basename(url));

  needle.get(url, { output: file }, function(err, resp, data){
    if (err || resp.statusCode != 200)
      return cb(err || new Error('Unexpected response: \n\n' + data.toString()));

    return cb(null, file);
  });
}

package.install = function(zip, dest, cb){
  console.log('Unpacking ' + zip + ' to ' + dest);
  unzip(zip, dest, cb);
}
