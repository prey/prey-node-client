
var platform = Prey.common.os_name;
var data = {
  windows: {
    mac:"08:00:27:8D:55:F3",
    nic:"Local Area Connection"
  },
  linux: {
    mac:"00:1b:24:bc:b3:80",
    nic:"eth0"
  },
  mac: {


  }


};


exports.td = function(key) {
  var val = data[platform][key] ;

  if (!val)
    throw new Error("Don't have test key "+key+" for "+platform);

  return val;
}






