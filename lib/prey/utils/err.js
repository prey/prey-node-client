
var errs = {};

exports.when = "fast";

exports.set = function(code,msg,failType,handler) {
  if (!code || !msg) {
    throw new Error("You must provide a code and a message for an error");
  }
  
  if (!failType) {
    failType = "fast";
  } else {
    if (typeof failType === "function") {
      handler = failType;
      failType = "fast";
    }
  }
  
  errs[code] = {msg:msg,failType:failType,handler:handler};
};

exports.check = function(code,extra,cb) {
  
  var e = errs[code];
  
  if (!e) {
    throw "Don't know that error: "+code;
  }

  if (exports.when == "fast") {
    throw new Error(e.msg+(extra) ? ":"+extra : "");
  }

  if (exports.when = "optional") {
    if (e.failType == "optional") {
      logger.log(t.msg);
    } else {
      throw new Error(e.msg+(extra) ? ":"+extra : "");
    }
  }
  
  if (cb)
    cb(code);
  
  return true;
};