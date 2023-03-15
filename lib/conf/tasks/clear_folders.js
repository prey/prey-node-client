const fs     = require('fs'),
      common = require('./../../common'),
      paths  = common.system.paths,
      join   = require('path').join,
      remove = require('remover');

/**
 * Entry point function of old folders deletion. 
 * It is responsible for deleting folders with old versions and keeping the folder with the current version
 * It’s called from the post-install script and applies for all OSs
 * To run it you must have administrator permissions
 * test in mac : ./prey config hooks post_install
 * After executing the command, the node client should continue to operate without problems.
 * @param {Function} cb - function 
 */
exports.start = function (cb) {

  var count,
    last_err,
    folders_removed = [];

  var done = function (err) {
    if (err) last_err = err;
    --count || finished();
  }

    /**finish to remove folders */
  var finished = function () {
    return cb()
  }

  /** get folders with versions olds */
  var get_folders_old_versions = function (cb) {
    
    try {
      let folders = fs.readdirSync(paths.versions);
      let folders_to_delete = folders.filter(x => x !== common.version); //only remove folders with old versions
      folders_to_delete = folders_to_delete.filter(x => x !== ".DS_Store"); //for test
      if (folders_to_delete.length == 0) return cb(null,[])
      else return cb(null, folders_to_delete)
    } catch (err) {
      if (err) console.log(err);
      // Here you get the error when the file was not found,
      // but you also get any other error
      return cb(err);

    }
  
  }

  /**
* @param {Array} folders - folder list to remove
 */
    /** remove olds folders  */
  var remove_folders = function (folders) {
    folders.forEach(element => {
      let folder = join(paths.versions, element);
      remove(folder, (err) => {
        if (err) console.log(err);
        if (err) return cb();
        folders_removed.push(folder);
        return done();
      })
    });
  }

  get_folders_old_versions(function (err, folders) {
    if (err) console.log(err);
    if (err) return cb();
    if (folders && folders.length == 0) return cb();
    count = folders.length;
    remove_folders(folders)
  })
}