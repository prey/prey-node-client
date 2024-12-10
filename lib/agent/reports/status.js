exports.includes = [
  'uptime',
  'logged_user',
  'active_access_point',
  'battery_status',
  ...(process.platform === 'win32' ? ['osquery_running'] : []),
  ...(process.platform === 'darwin' ? ['osquery_running'] : []),
]
