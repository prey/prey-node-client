let writer;

const logger = {
  write: (type, str) => { if (writer) writer[type](str); },
  debug: (str) => { logger.write('debug', str); },
  info: (str) => { logger.write('info', str); },
  warn: (str) => { logger.write('warn', str); },
  error: (str) => { logger.write('error', str); },
};

module.exports = logger;

module.exports.use = (obj) => {
  writer = obj;
};
