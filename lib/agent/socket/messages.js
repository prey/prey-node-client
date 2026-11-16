// @ts-check
const functionObject = {
  'location-get-location-native': {
    name: 'location',
    function: 'get-location-native',
  },
  'location-check-location-perms': {
    name: 'location',
    function: 'check-location-perms',
  },
  picture: {
    name: 'picture',
  },
  'screenshot-native': {
    name: 'screenshot',
    function: 'native',
  },
  'screenshot-agent': {
    name: 'screenshot',
    function: 'agent',
  },
  'wdutil-info': {
    name: 'wdutil',
    function: 'info',
  },
  'watcher-set-watcher': {
    name: 'watcher',
    function: 'set-watcher',
  },
  'migrate-migrate': {
    name: 'migrate',
    function: 'migrate',
  },
  'migrate-status': {
    name: 'migrate',
    function: 'status',
  },
};

const nameArray = [
  'location-get-location-native',
  'location-check-location-perms',
  'picture',
  'screenshot-native',
  'screenshot-agent',
  'wdutil-info',
  'watcher-set-watcher',
  'migrate-migrate',
  'migrate-status',
];

exports.functionObject = functionObject;
exports.nameArray = nameArray;
