const sysinfo = require('systeminformation');
const { exec } = require('child_process');

const networkInterfaceDefault = (cb) => {
  sysinfo.networkInterfaceDefault((defaultNetwork) => {
    cb(defaultNetwork);
  });
};

const system = (cb) => {
  sysinfo.system((stdoutsi) => {
    cb(stdoutsi);
  });
};

const mem = (cb) => {
  sysinfo.mem((stdoutsi) => {
    cb(stdoutsi);
  });
};

const bios = (cb) => {
  sysinfo.bios((stdoutsi) => {
    cb(stdoutsi);
  });
};

const baseboard = (cb) => {
  sysinfo.baseboard((stdoutsi) => {
    cb(stdoutsi);
  });
};

const battery = (cb) => {
  sysinfo.battery((stdoutsi) => {
    cb(stdoutsi);
  });
};

const osInfo = (cb) => {
  sysinfo.osInfo((stdoutsi) => {
    cb(stdoutsi);
  });
};

const users = (cb) => {
  sysinfo.users((stdoutsi) => {
    cb(stdoutsi);
  });
};

const getProcessList = (cb) => {
  exec(
    'powershell -Command "Get-CimInstance -ClassName Win32_Process -Filter \'UserModeTime != 0\' | Select-Object Caption, ParentProcessId, ProcessId, UserModeTime"',
    (error, stdout) => {
      cb(error, stdout);
    },
  );
};

const getUsersList = (cb) => {
  exec(
    'powershell -Command "Get-WmiObject -Class Win32_LogicalDisk | Select-Object -ExpandProperty DeviceID | fl"',
    (error, stdout) => {
      cb(error, stdout);
    },
  );
};

const deleteNodeService = () => {
  exec(
    'powershell -Command "Get-Process | Where-Object {$_.Path -eq \'C:\\Windows\\Prey\\current\\bin\\node.exe\'} | Stop-Process -Force"',
    () => {},
  );
};

const findLoggedUser = (cb) => {
  exec(
    'powershell -Command "Get-WmiObject -Class Win32_ComputerSystem | Select-Object -ExpandProperty UserName | fl"',
    (error, stdout) => {
      cb(error, stdout);
    },
  );
};

const getCaption = (cb) => {
  exec(
    'powershell -Command "Get-WmiObject -Class Win32_OperatingSystem | Select-Object -ExpandProperty Caption | fl"',
    (error, stdout) => {
      cb(error, stdout);
    },
  );
};

const getRemainingStorage = (cb) => {
  exec(
    'powershell.exe -Command "Get-WmiObject -Class Win32_LogicalDisk | Where-Object { $_.DeviceId -eq \'C:\' } | Select-Object Size, FreeSpace | fl"',
    (error, stdout) => {
      cb(error, stdout);
    },
  );
};

exports.networkInterfaceDefault = networkInterfaceDefault;
exports.system = system;
exports.mem = mem;
exports.bios = bios;
exports.baseboard = baseboard;
exports.battery = battery;
exports.osInfo = osInfo;
exports.users = users;
exports.getProcessList = getProcessList;
exports.getUsersList = getUsersList;
exports.deleteNodeService = deleteNodeService;
exports.findLoggedUser = findLoggedUser;
exports.getCaption = getCaption;
exports.getRemainingStorage = getRemainingStorage;
