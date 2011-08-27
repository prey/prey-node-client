//////////////////////////////////////////
// Prey Action Module Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		PreyModule = require('./prey_module');

function ActionModule(){

	PreyModule.call(this);
	var self = this;
	this.type = 'action';

};

sys.inherits(ActionModule, PreyModule);
module.exports = ActionModule;
