var fs = require('fs'),
    path = require('path');
var subject = '"/C=US/ST=California/L=Locality/O=Company/OU=Unit/CN=common.name.com"';

exports.generate = function(opts, callback){

	var cmd1, cmd2, cmd3;
	var key  = opts.private_key;
	var cert = opts.certificate;
	var csr  = path.join(path.dirname(key), 'ssl.csr');

	fs.exists(key, function(exists){

		if (exists) return callback(null, true);

		cmd1  = ['genrsa', '-out', key, '2048'];
		cmd2  = ['req', '-new', '-key', key, '-out', csr, '-subj', subject];
		cmd3  = ['x509', '-req', '-in', csr, '-signkey', key, '-out', cert]

		var exec = require('child_process').exec;

		console.log("Generating private key and certificate...")
		exec('openssl ' + cmd1.join(' '), function(err){
			if (err) return callback(err);

			// console.log("Generating certificate sign request...");
			exec('openssl ' + cmd2.join(' '), function(err){
				if (err) return callback(err);

				// console.log("Generating certificate...");
				exec('openssl ' + cmd3.join(' '), function(err, out){
					if (err) return callback(err);

					fs.exists(cert, function(yes){
						callback(yes ? null : new Error("Failed to generate: " + out.toString()));
					});
				})
			})
		})
	})

}
