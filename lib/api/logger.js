var writer;

var logger = {
  write  : function(type, str) { if (writer) writer[type](str) },
  info   : function(str) { this.write('info', str)  },
  warn   : function(str) { this.write('warn', str)  },
  error  : function(str) { this.write('error', str) }
}

module.exports = logger;

module.exports.use = function(obj) {
  writer = obj;
}
