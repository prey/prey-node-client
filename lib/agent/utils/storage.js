var fs = require('fs');
var db_path;

var load = function(cb) {
  if (db) return cb();
  
  fs.readFile(db_path, 'utf8', function(err, data) {
    if (err || data.trim() == '') return cb(err);
    
    try {
      db = JSON.parse(data);
    } catch(e) {
      db = {};
      err = e;
    }
    cb(err);
  })
}

var save = function(cb) {
  var err, str = JSON.stringify(db, null, 0);
  try {
    fs.writeFileSync(db_path, str);
  } catch(e) {
    err = e;
  }
  cb(err);
}

exports.init = function(path) {
  db_path = path;
}

exports.set = function(key, data, cb) {
  load(function(err) {
    if (err) return cb(err);
    db[key] = data;
    save(cb);
  })
}

exports.get = function(key, cb) {
  load(function(err) {
    if (err) return cb(err);
    
    cb(null, db[key]);
  })
}

exports.all = function(cb) {
 load(function(err) {
   if (err) return cb(err);
   
   cb(null, db);
 }) 
}

exports.clear = function(cb) {
  db = {};

  fs.unlink(db_path, function(err){
    cb && cb(err);
  });
}
