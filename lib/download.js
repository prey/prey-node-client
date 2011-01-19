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

exports.file = function(link){
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

		console.log("Downloading: " + filename);

		var remote = url.parse(link)
		var headers = { "Host": remote.hostname + (remote.port || "") }

		var stream = fs.createWriteStream(filename, { mode : 0755 })

		stream.on("error", function (er) {
			fs.close(stream.fd, function () {})
			if (stream._ERROR) return
		})

		stream.on("open", function () {
			fetch_and_write(remote, stream, headers)
		})

		stream.on("close", function () {
			console.log("Download complete.")
			if (stream._ERROR) return;
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

		var request = http
			.createClient(port, remote.hostname, https)
			.request("GET", remote.pathname, headers)
			.on("response", function (response) {
				console.log("Response: " + response.statusCode);
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
