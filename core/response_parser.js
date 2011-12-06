//////////////////////////////////////////
// Prey Response Parser
// (c) 2011, Fork Ltd. - http://forkhq.com
// Written by Tomas Pollak
// GPLv3 Licensed
//////////////////////////////////////////

var logger = require('./base').logger,
		Command = require('command'),
		xml2js = require('xml2js'),
		crypto = require('crypto');

var ResponseParser = {

	log: function(str){
		logger.info(str);
	},

	parse: function(data, options, callback){

		if(!options.decrypted && data.indexOf('config') == -1){
			this.decrypt_response(data, options.key, function(output){
				options.decrypted = true;
				ResponseParser.parse(output, options, callback);
			});
		} else if(options.type.indexOf('xml') != -1){
			this.parse_xml(data, callback);
		} else if(options.type.indexOf('js') != -1){
			callback(JSON.parse(data));
		} else {
			this.log("Unkown data data received.");
			callback(false);
		}

	},

	decrypt_response: function(data, key, callback){

		this.log(" -- Got encrypted response. Decrypting...")
		var key = crypto.createHash('md5').update(key).digest("hex");

		// console.log(data);

//		var buf = new Buffer(data, 'base64');
//		var raw = buf.toString('binary');
//
//		var pad = raw.slice(0, 8);
//		var salt = raw.slice(8, 15);
//		var raw = raw.slice(16);

//		console.log(pad);
//		console.log(salt);
//		console.log(raw);

//		var decipher = crypto.createDecipher('aes-128-cbc', key)
//		var dec = decipher.update(raw, 'binary', 'utf8')
//		dec += decipher.final('utf8');

		var cmd_str = 'echo "' + data + '" | openssl aes-128-cbc -d -a -salt -k "' + key +'" 2> /dev/null';
		var cmd = new Command(cmd_str);

		cmd.on('error', function(e){
			throw("OpenSSL returned error when decrypting: " + e.code);
		})

		cmd.on('return', function(output){
			// xml = output.replace(/=([^\s>\/]+)/g, '="$1"'); // insert comments back on node attributes
			// console.log(output)
			callback(output);
		})

	},

	parse_xml: function(data, callback){

		this.log(' -- Parsing XML...')
		var xml_parser = new xml2js.Parser();

		xml_parser.on('end', function(result) {
			callback(result);
		});

		xml_parser.on('error', function(result) {
			console.log(result);
			throw("Error parsing XML!")
		});

		xml_parser.parseString(data);

	},

}

module.exports = ResponseParser;
