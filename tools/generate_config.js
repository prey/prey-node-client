const getset     = require('getset');
const baseOpts   = __dirname + '/../lib/agent/default.options';
const configFile = __dirname + '/../prey.conf.default';
const tempConfig = getset.load(baseOpts);

const is_empty = (val) => {
  return typeof val == 'undefined' || val === null;
}

const generate = (destination) => {

  tempConfig.path = destination;
  tempConfig.save(function(err){
    if (err) return console.log(err);
    else console.log("Config file saved in " + configFile);
  });

}

generate(configFile);
