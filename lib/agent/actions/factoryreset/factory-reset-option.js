/**
 * Convert a UTC date to a local date.
 *
 * @param {Date} date - The UTC date to be converted.
 * @return {Date} The converted local date.
 */
const convertUTCDateToLocalDate = (date) => {
  const newDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return newDate;
};
/**
 * Returns the execution date two minutes from the current time.
 *
 * @return {string} The execution date in the format "YYYY-MM-DDTHH:mm:ss".
 */
const getExecutionDate = () => {
  let now = new Date();
  now.setMinutes(now.getMinutes() + 2); // add two minuts
  now = new Date(now);
  return convertUTCDateToLocalDate(now).toISOString().slice(0, 19);
};
/**
 * Returns the current creation date and time as a string in the format "YYYY-MM-DDTHH:MM:SS".
 *
 * @return {string} The current creation date and time.
 */
const getCreationDate = () => {
  const now = new Date();
  return convertUTCDateToLocalDate(now).toISOString().slice(0, 19);
};

exports.format_file = `<?xml version="1.0" encoding="UTF-16" ?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Date>${getCreationDate()}</Date>
    <URI>\\Prey\\Factory Reset</URI>
  </RegistrationInfo>
  <Triggers>
    <TimeTrigger>
      <StartBoundary>${getExecutionDate()}</StartBoundary>
      <Enabled>true</Enabled>
    </TimeTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>S-1-5-18</UserId>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>StopExisting</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>    
      <StopOnIdleEnd>true</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>true</WakeToRun>
    <ExecutionTimeLimit>PT72H</ExecutionTimeLimit>
    <Priority>0</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>%SystemRoot%\\syswow64\\WindowsPowerShell\\v1.0\\powershell.exe</Command>
      <Arguments>-NoProfile -ExecutionPolicy Bypass -File C:\\Windows\\Prey\\current\\lib\\agent\\actions\\factoryreset\\bin\\factory-reset.ps1</Arguments>
    </Exec>
  </Actions>
</Task>`;
