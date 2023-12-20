exports.includes = [
  'processor_info',
  'firmware_info',
  'network_interfaces_list',
  'ram_module_list',
  'model_name',
  'vendor_name',
  ...(process.platform === 'win32'
    ? ['os_edition', 'winsvc_version', 'rp_module', 'check_full_wipe']
    : []),
  ...(process.platform === 'darwin' ? ['prey_user_version'] : []),
];
