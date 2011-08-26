var fs = require('fs');

GLOBAL.tempfile_path = function(filename){
	return os.temp_path + '/' + filename;
};

GLOBAL.save_file_contents = function(file_name, data){
	fs.writeFile(file_name, data, function (err) {
		if (err) throw err;
		// console.log(' -- File saved: ' + file_name);
	});
};
