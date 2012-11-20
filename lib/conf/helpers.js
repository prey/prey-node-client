/**
 * Make sure all parameters specified in array are available from command line
 * and have values.
 **/
var required = function(req) {
  var vals = [];
  var missing = [];
  req.forEach(function(p) {
    var val = get_parameter_value(p);
    if (!val)
      missing.push(p);
    else
      vals.push(val);
  });
  if (missing.length > 0) return {values:null,missing:missing};
  return {values:vals};
};
