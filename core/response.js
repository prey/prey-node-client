var sys = require('sys'), command = require('command'), xml2js = require('../vendor/xml2js'), crypto = require('crypto');

var ResponseParser = {

	self: this,

	parse: function(data, callback){

		if(data.indexOf('<device>') == -1)
			this.decrypt_response(data, callback);
		else
			this.parse_xml(data, callback);

	},

	decrypt_response: function(data, callback){

		console.log(" -- Got encrypted response. Decrypting...")
		var key = crypto.createHash('md5').update(config.api_key).digest("hex");

//			var decipher = (new crypto.Decipher).init("bf-cbc", key);
//			var txt = decipher.update(data, 'base64', 'utf-8');
//			txt += decipher.final('utf-8');
//			log("RESULT: " + txt);

		var cmd_str = 'echo "' + data + '" | openssl aes-128-cbc -d -a -salt -k "' + key +'" 2> /dev/null'
		var cmd = command.run(cmd_str);

		cmd.on('error', function(message){
			quit("Couldn't decrypt response. This shouldn't have happened!")
		})

		cmd.on('return', function(output){
			xml = output.replace(/=([^\s>\/]+)/g, '="$1"'); // insert comments back on node attributes
			// console.log(xml);
			// return xml;
			self.parse_xml(xml, callback);
		})

	},

	parse_xml: function(data, callback){

		log(' -- Parsing XML...')

		var parser = new xml2js.Parser();

		parser.addListener('end', function(result) {
			log(' -- XML parsing complete.');
			callback(result);
		});

		parser.parseString(data);

	},

}

module.exports = ResponseParser;
