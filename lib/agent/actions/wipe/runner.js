const wipe = require('./wipe');

const what = process.argv;
// variable to store last error
let lastErr;
// pad node binary and script path
what.shift();
what.shift();
// Get the cloud config dirs and processes
const toErase = what.pop().split(','); // 'Google Drive', 'Dropbox'
const toKill = what.pop().split(',');

what.pop();
what.pop();
// process each of the requested items to wipe
wipe.fetch_dirs(Array.isArray(what) ? what : [what], toErase, toKill, null, (err) => {
  if (err) lastErr = err;
  wipe.wipeout((errWipe) => {
    if (errWipe) lastErr = `\n${errWipe}`;
    process.exit();
  });
});
process.on('SIGTERM', () => {
  process.exit();
});

process.on('exit', () => {
  process.stderr.write(lastErr);
});
