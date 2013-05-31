"use strict";

//////////////////////////////////////////
// Prey Process List Provider
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');
module.exports = require('./' + os_name);
