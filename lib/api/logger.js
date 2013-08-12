var writer = console;

var logger = {
  info   : function(str) { writer.info(str)  },
  warn   : function(str) { writer.warn(str)  },
  error  : function(str) { writer.error(str) },
  prefix : function(pre) { if (logger.prefix) logger.prefix(pre) }
}

module.exports = logger;

module.exports.use = function(obj) {
  writer = obj;
}
