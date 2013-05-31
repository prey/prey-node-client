var hooks    = require('./hooks'),
    triggers = {};

triggers.watch = function(list) {
  console.log('Watching: ' + list.join(', '));
}

triggers.stop = function() {
  console.log('Stopping triggers.');
}

module.exports = triggers;
