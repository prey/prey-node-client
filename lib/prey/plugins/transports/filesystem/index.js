//////////////////////////////////////////
// Prey Filesystem Transport Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var FilesystemTransport = {

	init: function(options){
		console.log("Initializing Filesystem Transport");
	},

	send: function(data){
		console.log("Storing data in filesystem...");
	}

}

exports.send = function(data, options){
	FilesystemTransport.save(data);
	// return FilesystemTransport;
};
