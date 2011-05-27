var Arguments = function(version){

	var opts = require('./../lib/js-opts');

	var options = [
		{ short       : 'v'
		, long        : 'version'
		, description : 'Show version and exit'
		, callback    : function () { console.log(version); process.exit(1); }
		},
		{ short       : 'c'
		, long        : 'check'
		, description : 'Run Prey in check mode'
		},
		{ short       : 'd'
		, long        : 'debug'
		, description : 'Show debugging info'
		},
	];

	opts.parse(options, true);
	return opts;

}

exports.init = function(version){
	return new Arguments(version);
}
