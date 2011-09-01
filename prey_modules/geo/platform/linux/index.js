//////////////////////////////////////////
// Prey JS Network Module Linux Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

exports.mac_addresses_list = "/sbin/ifconfig | grep 'HWaddr' | awk '{print $5}'";
