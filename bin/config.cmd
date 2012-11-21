@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe" "%~dp0\..\lib\conf\index.js" %*
) ELSE (
  node "%~dp0\..\lib\conf\index.js" %*
)
