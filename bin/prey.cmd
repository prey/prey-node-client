@echo off

set path=%~dp0

if "%1" == "config" (
  set script=\lib\conf\cli.js
) else if "%1" == "test" (
  set script=\node_modules\mocha\bin\mocha
) else (
  set script=\lib\agent\cli.js
  if not "%1" == "" (
    set no_shift=0
  )
)

if not "%1" == "" (
  if not "%no_shift" == "0" (
    shift
 )
)

@IF EXIST "%path%\node.exe" (
  "%path%\node.exe" "%path%\..\%script%" %*
) ELSE (
  node "%path%\..\%script%" %*
)
