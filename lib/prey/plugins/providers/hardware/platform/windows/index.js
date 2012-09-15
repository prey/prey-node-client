
var wmic = require("./wmic"),
    async = require("async"),
    lang = require("../../../../../lang"),
    Cache = require("../../../../../cache"), 
    cache = Cache.create();


exports.mac_address = function(nic,cb){
  cache.value('nics',false,function(nics) {
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


cache.set("nics",wmic.nicListFull);
cache.set("cpu",function(cb) { acquireInfo(cpuCmds,cb); });
cache.set("baseBoard",function(cb) { acquireInfo(baseBoardCmds,cb); });

exports.get_firmware_info = function(callback){
  cache.value("cpu",false,callback);
};
    

