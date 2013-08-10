// by github.com/joshet19
// https://github.com/josher19/prey-node-client/commit/ee2730d4c0a819aa53e8aafff39736fd05259aa0

var help  = require('./help');

var debug = function(str) {
  if (process.env.DEBUG)
    console.log(str);
}

// Use completions from help.js where line starts with a space or tab.
module.exports = function(line, callback) {

  var completions = [
    'config ',
    'get ',
    'send ',
    'watch ',
    'unwatch ',
    'start ',
    'stop ',
    'on ',
    'help ',
    'quit'
  ];

  var hits = [];
  var partialLine = line;
  var words = line.split(/\s+/);
  var cmd = words[0];

  if (cmd === 'help') {

    partialLine = words[words.length-1];

  } else if (words.length > 1) {

    // might need more advanced matchers for `on` and `send`.
    help.show(cmd, function(str) {

      debug("---", JSON.stringify(str), "---", typeof str);

      var trimm = function(it) { return it.trim() + " "; }

      // Use each "help" line starting with a tab or space.
      completions = str.split("\n").filter(function(it) {
        return it.match(/^\s+\w+/)
      }).map(trimm);

      partialLine = words[words.length-1] || line;

      if ("send" === cmd || "on" === cmd) {
        completions.push("to ", "imgur ", "using ");
      }  else if ("config" === cmd) {
        completions.push("read ", "update ");
      }

      //~ completions.sort();
      debug(partialLine, completions, completions[completions.length-1].indexOf(partialLine));

      hits = completions.filter(function(c) {
        return c.indexOf(partialLine) == 0
      });

      //~ if (debug) console.log("#", partialLine, completions.length, typeof hits, hits);
      // show all completions if none found
      callback(null, [hits && hits.length ? hits : completions, partialLine]);
    });
    return; // don't call callback twice
  }
  hits = completions.filter(function(c) {
    return c.indexOf(partialLine) == 0
  });

  // show all completions if none found
  callback(null, [hits && hits.length ? hits : completions, partialLine]);
  return; // [hits && hits.length ? hits : completions, partialLine]
}
