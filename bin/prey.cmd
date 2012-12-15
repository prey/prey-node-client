@echo off

set dir=%~dp0

if "%1" == "config" (
  set script=\lib\conf\cli.js
) else if "%1" == "test" (
  set script=\node_modules\mocha\bin\mocha
) else (
  set script=\lib\agent\cli.js
)

@IF EXIST "%dir%\node.exe" (
  "%dir%\node.exe" "%dir%\..\%script%" %*
) ELSE (
  node "%dir%\..\%script%" %*
)
