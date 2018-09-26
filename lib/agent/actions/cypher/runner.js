#!/usr/bin/env node

var path      = require('path'),
    remove    = require('remover'),
    os_name   = require('./../../common').os_name,
    cp        = require('child_process'),
    wipe_path = path.join(__dirname, '..', 'wipe', os_name),
    os_wipe   = require(wipe_path),
    what      = process.argv;

var broker_binary = 'broker-' + os_name.replace('windows', 'win').replace('mac', 'osx'),
    broker_exe    = path.join(__dirname, os_name, broker_binary);

var last_err;
what.shift();
what.shift();

var to_wipe = [],
    to_kill = [];

var dirs_to_wipe  = what.pop(),  // 'Google Drive', 'Dropbox'
    tasks_to_kill = what.pop();

if (dirs_to_wipe != '')  to_wipe = to_wipe.concat(dirs_to_wipe.split(','))
if (tasks_to_kill != '') to_kill = to_kill.concat(tasks_to_kill.split(','))

os_wipe.killTasks(to_kill, (err) => {
  if (err) last_err = err;

  to_wipe.forEach(wipe_path => {
    remove(wipe_path, (err) => {
      if (err) last_err = err.message;
    })
  })
})

cp.exec(broker_exe + ' ' + what.join(' '), (err, stdout, stderr) => {
  if (stderr) {
    console.log(stderr);
    last_err = stderr;
  }
  console.log(stdout)
})

process.on('SIGTERM', () => {
  process.exit();
})

process.on('exit', (code) => {
  console.log('Cypher finished. Last error: ' + (last_err || 'none.'));
})
