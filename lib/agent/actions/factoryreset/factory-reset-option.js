var time_execution  = () => {
  var now = new Date();
  now.setMinutes(now.getMinutes() + 2); //add two minuts
  now = new Date(now);
  return now.toISOString().slice(0, 19);
}

var time_creation  = () => {
  var now = new Date(); 
  now = new Date(now);
  return now.toISOString().slice(0, 19);
}

exports.format_file = `<?xml version="1.0" encoding="UTF-16" ?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
<RegistrationInfo>
  <Date>` + time_creation() + `</Date>
  <URI>\\Prey\\Factory Reset</URI>
</RegistrationInfo>
<Triggers>
  <TimeTrigger>
    <StartBoundary>` + time_execution() + `</StartBoundary>
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
  <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
  <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
  <StopIfGoingOnBatteries>true</StopIfGoingOnBatteries>
  <AllowHardTerminate>true</AllowHardTerminate>
  <StartWhenAvailable>false</StartWhenAvailable>
  <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
  <IdleSettings>    
    <StopOnIdleEnd>true</StopOnIdleEnd>
    <RestartOnIdle>false</RestartOnIdle>
  </IdleSettings>
  <AllowStartOnDemand>true</AllowStartOnDemand>
  <Enabled>true</Enabled>
  <Hidden>false</Hidden>
  <RunOnlyIfIdle>false</RunOnlyIfIdle>
  <WakeToRun>false</WakeToRun>
  <ExecutionTimeLimit>PT72H</ExecutionTimeLimit>
  <Priority>7</Priority>
</Settings>
<Actions Context="Author">
  <Exec>
    <Command>%SystemRoot%\\syswow64\\WindowsPowerShell\\v1.0\\powershell.exe</Command>
    <Arguments>-NoProfile -ExecutionPolicy Bypass -File C:\\Windows\\Prey\\current\\lib\\agent\\actions\\factoryreset\\bin\\factory-reset.ps1</Arguments>
  </Exec>
</Actions>
</Task>`