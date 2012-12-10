@echo off

set path=%~dp0

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
  "%path%\node.exe" "%path%\..\%script%" %args%
) ELSE (
  node "%path%\..\%script%" %args%
)
