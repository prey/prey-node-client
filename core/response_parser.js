var sys = require('sys'),
		Command = require('../lib/command'),
		xml2js = require('xml2js'),
		crypto = require('crypto');

var ResponseParser = {

	parse: function(data, callback){

		if(typeof data == 'string' && data.indexOf('<device>') != -1)
			this.parse_xml(data, callback);
		else if(data instanceof Object)
			callback(data);
		else
			this.decrypt_response(data, callback);

	},

	decrypt_response: function(data, callback){

		var self = this;

		console.log(" -- Got encrypted response. Decrypting...")
		var key = crypto.createHash('md5').update(config.api_key).digest("hex");

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

		var cmd_str = 'echo "' + data + '" | openssl aes-128-cbc -d -a -salt -k "' + key +'" 2> /dev/null'
		var cmd = new Command(cmd_str);

		cmd.on('error', function(message){
			quit("Couldn't decrypt response. This shouldn't have happened!")
		})

		cmd.on('return', function(output){
			// xml = output.replace(/=([^\s>\/]+)/g, '="$1"'); // insert comments back on node attributes
			// console.log(output)
			self.parse_xml(output, callback);
		})

	},

	parse_xml: function(data, callback){

		log(' -- Parsing XML...')

		var parser = new xml2js.Parser();

		parser.addListener('end', function(result) {
			log(' -- XML parsing complete.');
			callback(result);
		});

		parser.addListener('error', function(result) {
			quit("Error parsing XML!")
		});

		parser.parseString(data);

	},

}

module.exports = ResponseParser;
