exports.includes = [
  'processor_info',
  'firmware_info',
  'network_interfaces_list',
  'ram_module_list',
  // 'storage_devices_list',
  'model_name',
  'vendor_name',
  ...(process.platform == 'win32'
    ? ['os_edition', 'winsvc_version', 'rp_module']
    : []),
  ...(process.platform == 'darwin'? ['prey_user_version']:[])
];
