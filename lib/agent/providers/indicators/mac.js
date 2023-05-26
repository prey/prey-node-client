var exec = require('child_process').exec;

// when battery is charging, time remaining is actually
// what remains until the battery is full.
exports.get_battery_status = function(callback){

  exec('pmset -g batt', function(err, stdout){
    if (err) return callback(err);

    var time_remaining, output = stdout.toString();

    try {
      var percentage_remaining = output.match(/(\d+)%;/)[1];
      var state = output.match(/%;\s+(\w+)/)[1];
    } catch (err) {
      return callback(new Error('No battery found.'))
    }

    // when plugged, for a second the status is 'AC attached, not charging'
    if (state == 'AC') state = 'charging';

    if (time_value = output.match(/;\s+(\d+:\d+)/))
      time_remaining = time_value[1];

    var data = {
      percentage_remaining: percentage_remaining,
      time_remaining: time_remaining,
      state: state
    }

    callback(null, data);

  });

};


exports.get_remaining_storage = function(callback) {

  exec("df -kh / | tail -1", function(err, stdout){
    if (err) return callback(err);

    var data = stdout.toString().trim().split(/\s+/);

    var info = {
      total_gb: data[1],
      free_gb: data[3],
      used:    data[4]
    };

    callback(null, info);
  });
};
