set "cmd=%1"
shift

@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe" "%~dp0\..\%cmd" %*
) ELSE (
  node "%~dp0\..\%cmd" %*
)
