
var errs = {};
var logger;

/*
  Assumes a logger with a log/info/warn etc.
*/
exports.setLogger = function(lgr) {
  logger = lgr;
};

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

exports.check = function(code,err,extra) {

  if (!err)
    return true;
  
  var e = errs[code];  
  
  if (!e) {
    throw "Don't know error: "+code;
  }

  if (exports.when === "fast") {
    throw new Error(e.msg+(extra) ? ":"+extra.trim() : "");
  }

  if (exports.when === "optional") {
    if (e.failType === "optional") {
      logger.log(e.msg);
    } else {
      throw new Error(e.msg+(extra) ? ":"+extra.trim() : "");
    }
  }
  
  return true;
};