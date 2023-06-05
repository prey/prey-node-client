var os_name = process.platform.replace('win32', 'windows').replace('darwin', 'mac');

require('./access_points_list/' + os_name);

