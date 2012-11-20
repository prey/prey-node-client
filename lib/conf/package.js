/**
 * Do a needle get to retrieve url, and then save it as a binary file 'to'.
 **/
var get_zip = function(url,to,callback) {
  var needle = require('needle');
  needle.get(url,to,function(err,resp,body) {
    if (err) return callback(_error(err));

    var fd = fs.openSync(to,'w');
    fs.writeSync(fd,body,0,body.length,0,0);
    callback(null);
  });
};

/**
 * Unzip file.
 **/
var unzip = function(from,to,callback) {
  var
    uz = require('unzip'),
    is = fs.createReadStream(from),
    extractor = uz.Extract({ path: to });

  extractor.on('end',function() { callback(null) ;});
  extractor.on('error', function(err) { callback(_error(err)); });
  is.pipe(extractor);
};

/**
 * Assume a zip file on the local disk.
 * Unzip it into a temporary dir then find out the name of the containing folder, and
 * query package.json for the version#.
 *
 * The containing folder is then copied and renamed to the version# and copied to the versions directory.
 * Finally configure is run on the new installations path to update the current symlink etc.
 **/
var install_core = function(zipFile,callback) {
  tmp.dir(function(err,explodePath) {
    if (err) return callback(_error(err));

    _tr('unzipping ...');
    unzip(zipFile,explodePath,function(err) {
      if (err) return callback(_error(err));

      var d = fs.readdirSync(explodePath),
      extracted = explodePath + '/' + d[0] ;

      read_package_info(extracted,function(err,info) {
        if (err) return callback(_error(err));

        var dest_dir = _versions_dir + '/' + info.version;
        _tr('copying files from '+extracted+' to '+dest_dir);
        cp_r(extracted,dest_dir,function() {
          configure(dest_dir,function(err) {
            if (err) return callback(_error(err));

            callback(null);
          });
        });
      });
    });
  });
};

/**
 * Install a new version from a uri pointing at a zip file.
 * If the uri contains an http then needle is used to download the file.
 * If no http then the zip is assumed to be local.
 * The zip file should expand to be the top level dir of a prey installation,
 * getting a zip from github is the canonical example of structure.
 **/
var install = function(uri,callback) {
  if (uri.substr(0,4) === 'http') {
    _tr('1:Installing from url ...');

    tmp.file(function(err, zipFile) {
      if (err) return callback(_error(err));
      _tr('retrieving zip ...');
      get_zip(uri,zipFile, function(err) {
        if (err) return callback(_error(err));
        install_core(zipFile,callback);
      });
    });
  } else {
    _tr('1:Installing from file ...');
    // assume zip is on the local drive ...
    install_core(uri,callback);
  }
};
