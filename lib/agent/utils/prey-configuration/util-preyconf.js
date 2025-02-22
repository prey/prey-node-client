exports.reqPreyConf = [
  {
    name: 'auto_connect',
    word: 'auto_connect',
    regex: /auto_connect =/,
    value: null,
    toSave: /auto_connect = (.+)/,
    default: false,
    possiblevalues: /^(true|false)$/,
  },
  {
    name: 'auto_update',
    word: 'auto_update',
    regex: /auto_update =/,
    value: null,
    toSave: /auto_update = (.+)/,
    default: true,
    possiblevalues: /^(true|false)$/,
  },
  {
    name: 'download_edge',
    word: 'download_edge',
    regex: /download_edge =/,
    value: null,
    toSave: /download_edge = (.+)/,
    default: false,
    possiblevalues: /^(true|false)$/,
  },
  {
    name: 'send_crash_reports',
    word: 'send_crash_reports',
    regex: /send_crash_reports =/,
    value: null,
    toSave: /send_crash_reports = (.+)/,
    default: true,
    possiblevalues: /^(true|false)$/,
  },
  {
    name: 'try_proxy',
    word: 'try_proxy',
    regex: /try_proxy =/,
    value: null,
    toSave: /try_proxy = (.+)/,
    default: null,
    possiblevalues: /.*/,
  },
  {
    name: 'api_key',
    word: 'api_key',
    regex: /api_key =/,
    value: null,
    toSave: /api_key = (.+)/,
    default: null,
    possiblevalues: /.*/,
  },
  {
    name: 'device_key',
    word: 'device_key',
    regex: /device_key =/,
    value: null,
    toSave: /device_key = (.+)/,
    default: null,
    possiblevalues: /.*/,
  },
  {
    name: 'control-panel',
    word: 'control-panel',
    regex: /^\[control-panel\]$/,
    value: null,
    toSave: null,
    default: null,
    possiblevalues: null,
  },
  {
    name: 'control-panel.host',
    word: 'host =',
    regex: /host =/,
    value: /host = (.+)/,
    toSave: /host = (.+)/,
    default: 'solid.preyproject.com',
    possiblevalues: /^(solid.preyproject.com|solid.preyhq.com)$/,
  },
  {
    name: 'control-panel.protocol',
    word: 'protocol =',
    regex: /protocol =/,
    value: /protocol = (.+)/,
    toSave: /protocol = (.+)/,
    default: 'https',
    possiblevalues: /^(http|https)$/,
  },
  {
    name: 'control-panel.api_key',
    word: 'api_key',
    regex: /api_key =/,
    value: /api_key = (.+)/,
    toSave: /api_key = (.+)/,
    default: null,
    possiblevalues: /.*/,
  },
  {
    name: 'control-panel.device_key',
    word: 'device_key',
    regex: /device_key =/,
    value: /device_key = (.+)/,
    toSave: /device_key = (.+)/,
    default: null,
    possiblevalues: /.*/,
  },
  {
    name: 'control-panel.send_status_info',
    word: 'send_status_info',
    regex: /send_status_info =/,
    value: null,
    toSave: /send_status_info = (.+)/,
    default: true,
    possiblevalues: /^(true|false)$/,
  },
  {
    name: 'control-panel.scan_hardware',
    word: 'scan_hardware',
    regex: /scan_hardware =/,
    value: null,
    toSave: /scan_hardware = (.+)/,
    default: false,
    possiblevalues: /^(true|false)$/,
  },
  {
    name: 'control-panel.location_aware',
    word: 'location_aware',
    regex: /location_aware =/,
    value: null,
    toSave: /location_aware = (.+)/,
    default: false,
    possiblevalues: /^(true|false)$/,
  },
];
