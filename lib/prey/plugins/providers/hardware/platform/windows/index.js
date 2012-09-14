
var wmic = require("./wmic"),
async = require("async"),
lang = require("../../../../../lang");

var nicCache;

var getNicObjects = function(cb) {
  if (nicCache) {
    cb(nicCache);
    return;
  }
    
 wmic.run('nic list full',function(data) {
   cb(nicCache = data
      .split(/\n\n|\n\r/g)
      .filter(function(block) { return block.length > 2; })
      .map(function(block) {
        return block
          .split(/\n+|\r+/)
          .filter(function(line) { return line.length > 0 ;})
          .reduce(function(o,line) {
            var kv = line.split("=");
            o[kv[0]] = kv[1];
            return o;
          },{});
      }));
 });
};

exports.mac_address = function(nic,cb){
  getNicObjects(function(nics) {
      var macs = nics.filter(function(n) { return n.NetConnectionID === nic; });
      cb((macs.length === 1) ? macs[0].MACAddress : null);
  });
};

var acquireInfo = function(type,callback) {
  var data = {};
  async.series(Object.keys(type).map(function(k) {
    return function(asyncCallback) {
      wmic.run(type[k],function(res) {
        data[k] = lang.chomp(res);
        asyncCallback(null,data[k]);
      });
    };
  }),function(err,ignore) {
    if (!err) {
      callback(data);
    }
  });
};

var cpuCmds = {
  model:"cpu get name",
  speed:"cpu get MaxClockSpeed",
  cores:"cpu get NumberOfCores"
};

var baseBoardCmds = {
  vendor_name:"baseboard get manufacturer",
  serial_number:"baseboard get serialnumber",
  model_name:"baseboard get product"
	// uuid:"UUID"
};

exports.get_firmware_info = function(callback){
  acquireInfo(cpuCmds,callback);
};
    

