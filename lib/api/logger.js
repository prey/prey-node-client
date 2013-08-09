var writer = console,
    prefix = '';

var logger = {
  info   : function(str) { writer.info(prefix + str)  },
  warn   : function(str) { writer.warn(prefix + str)  },
  error  : function(str) { writer.error(prefix + str) },
  prefix : function(pre) { prefix = pre }
}

module.exports = logger;

module.exports.prefix = function(str) {
  prefix = str;
}

module.exports.use = function(obj) {
  writer = obj;
}
