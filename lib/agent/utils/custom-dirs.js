"use strict"

var fs        = require('fs'),
    path      = require('path'),
    common    = require('./../common'),
    osName   = common.osName,
    wipe_path = path.join(__dirname, '..', 'actions', 'wipe', osName),
    os_wipe   = require(wipe_path);

var clouds_paths = [];
os_wipe.tasks.clouds.forEach(task => {
  clouds_paths.push(Object.keys(task)[0])
})

var homes = {
  linux   : '/home',
  darwin  : '/Users',
  win32   : path.join(process.env.SystemDrive || 'C:', 'Users')
};

var filter_tasks = (tasks, paths) => {
  var array = [];
  tasks.forEach(task => {
    paths.map(x => {
      if (x[task]) array = array.concat(x[task]) 
    })
  })
  return array;
}

exports.validateCustomDirs = (dirs, should_be_home) => {
  if (!dirs) return false;
  let directories = [],
      cloud = {};

  dirs = dirs.split(/[\n,]+/);
  dirs.forEach((dir, index) => {
    dirs[index] = dir.trim();

    // Check the path format and if it's an user path, for wipe any absolute path and for cypher just users paths
    if (path.isAbsolute(dirs[index]) && (!should_be_home || should_be_home && dirs[index].startsWith(homes[process.platform]))) {
      let cloud_app = null,
          user = dirs[index].split(path.sep)[2];

      clouds_paths.map(app => { if (dirs[index].includes(app)) cloud_app = app })
      
      // Add cloud app to the list if it's included in the path
      if (cloud_app || dirs[index].split(path.sep).length <= 3) {
        let user_path = path.join(homes[process.platform], user)
        if (!cloud[user_path])
          cloud[user_path] = [];
        
        cloud[user_path] = cloud[user_path].concat(cloud_app);
      }

      directories.push(dirs[index]);
    }
  })

  if (directories.length == 0) return false;
  return [directories.join(','), cloud];
}

exports.collect_wipe_paths = (cloud) => {
  let dirs_to_wipe = [];
  Object.keys(cloud).forEach((item) => {
    let array   = [],
        to_wipe = filter_tasks(cloud[item], os_wipe.paths.clouds);
    
    to_wipe.map((line) => { array.push(path.join(item, line)) });
    dirs_to_wipe = dirs_to_wipe.concat(array) 
  })
  return dirs_to_wipe;
}

exports.get_tasks = (cloud) => {
  let tasks_to_kill = [];
  Object.keys(cloud).forEach((item) => {
    let to_kill = filter_tasks(cloud[item], os_wipe.tasks.clouds);
    to_kill.map((line) => {
      if (tasks_to_kill.indexOf(line) == -1) tasks_to_kill.push(line) 
    });
  })
  return tasks_to_kill;
}

exports.get_users_dirs = () => {
  let users_dirs = [],
      root  = homes[process.platform];

  try {
    let list = fs.readdirSync(root)
    list.forEach((user) => {
      users_dirs.push(path.join(root, user));
    })
    return users_dirs;
  } catch(e) {
    return [];
  }
}

exports.clouds_paths = clouds_paths;
