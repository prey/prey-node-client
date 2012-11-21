@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe" "%~dp0\.\agent.js" %*
) ELSE (
  node "%~dp0\.\agent.js" %*
)
