const fs     = require('fs'),
      common = require('../../common'),
      paths  = common.system.paths,
      join   = require('path').join,
      remove = require('remover');

/**
 * Entry point function of files deletion. 
 * It is responsible for deleting files with prey-config 
 * It’s called from the post-install script and applies for all OSs
 * To run it you must have administrator permissions
 * test in mac : ./prey config hooks post_install
 * After executing the command, the node client should continue to operate without problems.
 * @param {Function} cb - function 
 */
exports.start = function (cb) {

  var count,
    last_err,
    files_removed = [];

  var done = function (err) {
    if (err) last_err = err;
    --count || finished();
  }

    /**finish to remove files */
  var finished = function () {
    return cb()
  }

  /** get files with prey-config  */
  const files_not_delete = [".DS_Store"];

  var get_files_prey_in_temp = function (cb) {
    
    try {
      let files = fs.readdirSync(paths.temp);
     let files_to_delete = files.filter(x => x.includes("prey-config-")); //only remove files prey-config-%%%%%
     files_to_delete = files_to_delete.filter(x =>  !files_not_delete.includes(x) ); 
      if (files_to_delete.length == 0) return cb(null,[])
      else return cb(null, files_to_delete)
    } catch (err) {
      if (err) console.log(err);
      // Here you get the error when the file was not found,
      // but you also get any other error
      return cb(err);

    }
  
  }

  /**
* @param {Array} files -  list files to remove
 */
    /** remove files prey-config  */
  var remove_files = function (files) {
    files.forEach(element => {
      let file = join(paths.temp, element);
      fs.unlink(file, (err) => {
        if (err) console.log(err);
        if (err) return cb();
        files_removed.push(file);
        return done();
      })
    });
  }

  get_files_prey_in_temp(function (err, files) {
    if (err) console.log(err);
    if (err) return cb();
    if (files && files.length == 0) return cb();
    count = files.length;
    remove_files(files)
  })
} 