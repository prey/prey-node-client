@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe" "%~dp0\..\lib\agent\cli.js" %*
) ELSE (
  node "%~dp0\..\lib\agent\cli.js" %*
)
