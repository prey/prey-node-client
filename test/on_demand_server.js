var fs = require('fs'),
		tls = require('tls'),
		http = require('http'),
		common = require('./../lib/prey/common').load_config();

var tcp_port = 9000;
var http_port = 9001;

var client = null;
var connected_at = null;

// var schema = require('./../spec/fixtures/response_schema');

var getHTML = function(){
	var html = "<h1>Client connected since " + connected_at.toUTCString() + "</h1><ul>";
	html += "<li><a href='/start_action'>Start action</a></li>";
	html += "<li><a href='/stop_action'>Stop action</a></li>";
	html += "<li><a href='/get_trace'>Get trace</a></li>";
	html += "<li><a href='/update_setting'>Update setting</a></li></ul>";
	return html;
}

var sendCommand = function(command, data){
	console.log("Sending " + command + " command to client");
	var msg = JSON.stringify({command: command, data: data || {}});
	client.write(msg);
}

var http_server = http.createServer(function(req, res){
  console.log("Got request: " + req.url);

  res.writeHead(200, {'Content-Type': 'text/html'});

	if(!client)
		return res.end("Client not connected");
	
	if(req.url == '/'){
		return res.end(getHTML());
	} else {
		switch(req.url.replace('/', '')){
			case 'start_action':
				sendCommand("start_action", {name: "alarm", options: {"sound_file": 'alarm.mp3'}});
				break;
			case 'stop_action':
				sendCommand("stop_action", {name: "alarm"});
				break;
			case 'get_trace':
				sendCommand("get_trace", {name: 'modified_files'});
				break;
			case 'update_setting':
				sendCommand("update_setting", {key: 'auto_connect', value: false, save: true});
				break;
			default: 
				var msg = "Unknown request: " + req.url;
				console.log(msg);
				return res.end(msg);
		}

	}
	
	res.end("Command sent. " + "<a href='/'>Back</a>")
	
}).listen(http_port);

var options = {
  key: fs.readFileSync(common.private_key_path),
  cert: fs.readFileSync(common.certificate_path),

  // This is necessary only if using the client certificate authentication.
  // requestCert: true,

  // This is necessary only if the client uses the self-signed certificate.
  // ca: [ fs.readFileSync('client-cert.pem') ]
};

var tcp_server = tls.createServer(options, function(stream) {
	
  console.log(' - New connection, ', stream.authorized ? 'authorized' : 'unauthorized');
  stream.setEncoding('utf8');

	client = stream;
	connected_at = new Date();
	
	sendCommand('welcome')

	stream.on('secureConnect', function(){
		console.log(" - Connection succesfully handshaked");
	})
	
	stream.on('data', function(data){
		console.log(" - Got data: " + data.toString());
	})
	
	stream.on('close', function(err){
		console.log(" - Connection closed");
		client = null;
		connected_at = null;
	})

  // stream.pipe(cleartextStream);
});

tcp_server.listen(tcp_port);

console.log("TCP server listening on port " + tcp_port);
console.log("HTTP server listening on port " + http_port);
