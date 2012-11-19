 /**
 * Used in debug_error for getting source file and line of error.
 **/
module.exports = function(e) {
  var m = e
        .stack
        .split("\n")[3]
        .trim()
        .match(/at (\S+) (\(([A-Z]:)?[^:]+):([0-9]+)/);

  return (m) ? {func:m[1], file:m[2], line:m[4]} : null;
};
