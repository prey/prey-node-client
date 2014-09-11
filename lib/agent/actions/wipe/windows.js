var os   = require('os'),
    join = require('path').join,
    exec = require('child_process').exec;

if (parseFloat(os.release()) > 5.2)
  var data_path = 'Application Data';
else
  var data_path = join('AppData', 'Local');

exports.paths = {
  keychains: [],
  documents: ['My Documents'],
  emails:    [
    join(data_path, 'Microsoft', 'Outlook'),
    join(data_path, 'Thunderbird', 'Profiles')
  ],
  browsers:  [
    join(data_path, 'Google', 'Chrome'),
    join(data_path, 'Mozilla', 'Firefox', 'Profiles'),
    join(data_path, 'Apple Computer', 'Safari')
  ]
}

/*
exports.clear_ie = function(cb) {

  var what = {
    passwords: 32,
    form_data: 16,
    temp_files: 8,
    cookies:    2,
    history:    1
  }

  var last_err,
      count = Object.keys(what).length;

  var remove_ie_data = function(number) {
    exec('RunDll32.exe InetCpl.cpl,ClearMyTracksByProcess ' + number, function(err, out) {
      if (err) last_err = err;
      --count || cb(last_err);
    });
  }

  Object.keys(what).forEach(function(item) {
    console.log('Removing ' + item);
    remove_ie_data(what[item]);
  })

}*/

// 255 deletes everything, so no need to go one by one
exports.clear_ie = function(cb) {
  exec('RunDll32.exe InetCpl.cpl,ClearMyTracksByProcess 255', cb);
}