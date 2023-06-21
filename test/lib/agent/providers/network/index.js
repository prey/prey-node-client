var osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');

require('./access_points_list/' + osName);

