/*
	HTTP fetcher, by Tomas Pollak
*/

var sys = require('sys'),
		fs = require('fs'),
		url = require('url'),
		http = require('http'),
		path = require('path'),
		util = require('util'),
		events = require('events');

exports.do = function(link){
	return new Download(link);
}

function Download(link){

	var self = this;

	var init = function(link){
		resolve_filename(link, arguments[1], function(filename){
			do_fetch(link, filename)
		});
	}

	var resolve_filename = function(link, local_path, callback){

		var filename = path.basename(link);

		if(!local_path){
			callback(filename);
		} else {
			path.exists(local_path, function(exists){
				if(exists) callback(local_path + "/" + filename); // dir provided, no file
				else {
					path.exists(path.dirname(local_path), function(exists){
						if(exists) callback(local_path);
					})
				}
			})
		}

	}

	var do_fetch = function(link, filename){

		console.log(" -- Downloading " + filename);

		var remote = url.parse(link)
		var headers = { "Host": remote.hostname + (remote.port || "") }

		var stream = fs.createWriteStream(filename, { mode : 0755 })

		stream.on("error", function (er) {
			console.log("Download error");
			fs.close(stream.fd, function(){
				fs.unlink(filename);
			})
			if (stream._ERROR) return;
			// self.emit('error', er);
		})

		stream.on("open", function(){
			fetch_and_write(remote, stream, headers)
		})

		stream.on("close", function(){
			if (stream._ERROR) return;
			console.log("Download complete.")
			var stats = {
				bytes: 10000,
				time: 2000,
			}
			self.emit('complete', filename, stats);
		})

	}

	var fetch_and_write = function(remote, stream, headers){

		var https = remote.protocol === "https:"
		var port = remote.port || (https ? 443 : 80)

		//console.log("Sending request to " + remote.hostname + "...")

		var request = http
			.createClient(port, remote.hostname, https)
			.request("GET", remote.pathname, headers)
			.on("response", function (response) {
				// console.log("Response: " + response.statusCode);
				if (response.statusCode !== 200) {
					return stream.emit("error", new Error(response.statusCode + " " + (sys.inspect(response.headers).replace(/\s+/, ' '))))
				}
				sys.pump(response, stream)
			})
			.end()

	}

	init(link);

}

sys.inherits(Download, events.EventEmitter);
