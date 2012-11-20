exports.error = function(err, context) {
  // check if first parameter is already an error object
  if (typeof err === 'object') {
    if (err.msg)
       return err;
    else
      return {msg: 'External Error', context: err} ;
  }

//  return new Error(msg);
  return {msg: err, context: context};
};

exports.tr = function(msg){
  //
}


if (process.env.DEBUG) {
  var debug = require('./utils').debug;
  debug.enable();
}
