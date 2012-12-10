@echo off

set dir=%~dp0

if "%1" == "config" (
  set script=\lib\conf\cli.js
  shift
) else if "%1" == "test" (
  set script=\node_modules\mocha\bin\mocha
  shift
) else (
  set script=\lib\agent\cli.js
)

REM -- Shift has no affect on the %* batch parameter.
set args=%1 %2 %3 %4 %5

@IF EXIST "%path%\node.exe" (
  "%dir%\node.exe" "%dir%\..\%script%" %args%
) ELSE (
  node "%dir%\..\%script%" %args%
)
