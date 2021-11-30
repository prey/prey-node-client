exports.includes = [
  'processor_info',
  'firmware_info',
  'network_interfaces_list',
  'ram_module_list',
  'storage_devices_list',
  'rp_module',
  ...(process.platform == 'win32' ? ['os_edition', 'winsvc_version']: [])
];