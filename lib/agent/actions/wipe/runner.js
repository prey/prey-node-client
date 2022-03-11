#!/usr/bin/env node

var wipe    = require('./wipe'),
    what    = process.argv;

// variable to store last error
var last_err;

// pad node binary and script path
what.shift();
what.shift();

// Get the cloud config dirs and processes
var to_erase = what.pop().split(','),  // 'Google Drive', 'Dropbox'
    to_kill  = what.pop().split(',');

console.log('what is what?');
console.log(what);
console.log('what is what?');
//Realmente lo que pasa aqui es que en la instruccion que llega de documents
//llega con 3 argumentos solamente y no 5
//what por lo tanto es un arreglo de length 3
//y al hacer shift 2 veces y luego
//por 4 veces (incluyendo los que comente)
//el arreglo queda vacio. Para esto quiza deberias
//hacer que en la funcion fetch_dirs, el primer argumento sea 'documents'
//como string para hacer la prueba


//what.pop();
//what.pop();

// process each of the requested items to wipe

wipe.fetch_dirs(what, to_erase, to_kill, null, (err) => {
  if (err) last_err = err;
  wipe.wipeout((err, out) => {
    if (err) last_err = err;
    console.log(out)
    process.exit();
  })
})

process.on('SIGTERM', () => {
  process.exit();
})

process.on('exit', (code) => {
  console.log('Wipe finished. Last error: ' + (last_err || 'none.'));
})
