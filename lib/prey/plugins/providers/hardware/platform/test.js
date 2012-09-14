
var w= require("./windows");

/*
w.mac_address("Local Area Connection",function(data) {
  console.log(data);
});
*/

w.get_firmware_info(function(data) {
  console.log(data);
});