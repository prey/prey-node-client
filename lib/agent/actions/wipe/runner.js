const wipe = require('./wipe');

const what = process.argv;
// variable to store last error
let last_err;
// pad node binary and script path
what.shift();
what.shift();
// Get the cloud config dirs and processes

const fillOnly = what.pop();
const keepRoot = what.pop();
const threePass = what.pop();
const to_erase = what.pop().split(','); // 'Google Drive', 'Dropbox'
const to_kill = what.pop().split(',');

what.pop();
what.pop();
// process each of the requested items to wipe

wipe.wipeConfiguration(fillOnly, keepRoot, threePass);
wipe.fetch_dirs(Array.isArray(what) ? what : [what], to_erase, to_kill, null, (err) => {
  if (err) last_err = err;
  wipe.wipeout((err, out) => {
    if (err) last_err = err;
    console.log(out);
    process.exit();
  });
});
process.on('SIGTERM', () => {
  process.exit();
});
process.on('exit', (code) => {
  console.log(`Wipe finished. Last error: ${last_err || 'none.'}`);
});
