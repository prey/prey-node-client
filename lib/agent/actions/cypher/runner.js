#!/usr/bin/env node

var path      = require('path'),
    os_name   = require('./../../common').os_name,
    cp        = require('child_process'),
    wipe_path = path.join(__dirname, '..', 'wipe', os_name),
    os_wipe   = require(wipe_path),
    what      = process.argv;

var wipe_binary_name = 'wipe-' + os_name.replace('windows', 'win').replace('mac', 'osx'),
    wipe_exe         = path.join(wipe_path, wipe_binary_name),
    wipe_cmd         = wipe_exe + ' -secure -dir ',
    broker_path      = path.join(__dirname, os_name, 'broker');

var last_err;
what.shift();
what.shift();

var to_wipe = what.pop().split(','),  // 'Google Drive', 'Dropbox'
    to_kill = what.pop().split(',');

os_wipe.killTasks(tasks, (err) => {
  if (err) last_err = err;

  user_paths.forEach(user_path => {
    var dirs_wipe = filter_tasks(cloud, os_wipe.paths.clouds);
    dirs_wipe.forEach(cloud_path => {
      try {
        cp.execSync(wipe_cmd + `"${path.join(user_path, cloud_path)}"`)
      } catch(e) {
        last_err = e.message;   // REVISAR
     }
    })
  })
})

cp.exec(broker_path + ' ' + what.join(' '), (err, stdout, stderr) => {
  if (stderr) last_err = stderr;
})

process.on('SIGTERM', () => {
  process.exit();
})

process.on('exit', (code) => {
  console.log('Cypher finished. Last error: ' + (last_err || 'none.'));
})
