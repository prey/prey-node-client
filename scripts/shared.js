exports.run_script = function(script_name, callback){

  execFile(__dirname + '/' + script_name, function(err, stdout, stderr){

    if (stderr.length > 0) console.log(stderr.toString());
    if (stdout.length > 0) console.log(stdout.toString());
    callback(err);

  })

}
