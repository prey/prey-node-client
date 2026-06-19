const sysinfo = require('systeminformation');
const { exec } = require('child_process');
const fs = require('fs');
const edrLog = require('../../system/windows/edr_log');

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
    { timeout: 10000 },
    (error, stdout) => {
      cb(error, stdout);
    },
  );
};

const getUsersList = (cb) => {
  exec(
    'powershell -Command "Get-WmiObject -Class Win32_LogicalDisk | Select-Object -ExpandProperty DeviceID | fl"',
    { timeout: 10000 },
    (error, stdout) => {
      cb(error, stdout);
    },
  );
};

const deleteNodeService = (pidFilePath) => {
  fs.readFile(pidFilePath, (err, data) => {
    if (err) { edrLog(`deleteNodeService: pidfile read failed (${err.message}) path=${pidFilePath}`); return; }
    const pid = Number.parseInt(data.toString().trim(), 10);
    if (!Number.isInteger(pid) || pid <= 0) {
      edrLog(`deleteNodeService: invalid pid (${pid}) from pidfile=${pidFilePath} — skip kill`);
      return;
    }
    edrLog(`deleteNodeService: calling process.kill(${pid}, SIGKILL) from pidfile=${pidFilePath}`);
    try {
      process.kill(pid, 'SIGKILL');
      edrLog(`deleteNodeService: process.kill(${pid}) OK`);
    } catch (e) { edrLog(`deleteNodeService: process.kill(${pid}) threw (${e.message}) — already gone`); }
  });
};

const findLoggedUser = (cb) => {
  exec(
    'powershell -Command "Get-WmiObject -Class Win32_ComputerSystem | Select-Object -ExpandProperty UserName | fl"',
    { timeout: 10000 },
    (error, stdout) => {
      cb(error, stdout);
    },
  );
};

const getCaption = (cb) => {
  exec(
    'powershell -Command "Get-WmiObject -Class Win32_OperatingSystem | Select-Object -ExpandProperty Caption | fl"',
    { timeout: 10000 },
    (error, stdout) => {
      cb(error, stdout);
    },
  );
};

const getRemainingStorage = (cb) => {
  exec(
    'powershell.exe -Command "Get-WmiObject -Class Win32_LogicalDisk | Where-Object { $_.DeviceId -eq \'C:\' } | Select-Object Size, FreeSpace | fl"',
    { timeout: 10000 },
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
