//////////////////////////////////////////
// Prey Data Dispatcher
// Written by Tomas Pollak
// (c) 2011 - Fork Ltd. - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common  = require('./common'),
    inspect = require('util').inspect,
    logger  = common.logger,
    loader  = require('./loader');

var Dispatcher = function(){

	var self = this;

	this.log = function(str){
		logger.info("[dispatcher] " + str);
	};

	this.send = function(endpoint_name, data, options, callback){

                logger.debug(inspect(data));

		loader.load_transport(endpoint_name, function(err, transport){

			if (err) return callback && callback(err);

			transport.send(data, options, function(err, response){
				callback && callback(err, response);
			});

		})

	}

}

module.exports = new Dispatcher();
