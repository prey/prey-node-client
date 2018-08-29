"use strict"

var path = require('path'),
    notifier = require('node-notifier');

exports.notify = (opts) => {

  notifier.notify({
    title: opts.title || 'Prey',    
    // subtitle: 'Click here!',    
    message: opts.message,    
    icon: path.join(__dirname, 'prey_logo.png'),
    sound: true, // Only Notification Center or Windows Toasters     
    timeout: opts.timeout || 3,
    // time: 2000,
    wait: false
    }, (err, response) => {
    // Response is response from notification     
  });
  
  notifier.on('click', (notifierObject, options) => {
    console.log("CLICKED!!!") 
  });
}