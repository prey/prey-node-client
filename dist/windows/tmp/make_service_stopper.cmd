
:: Creates the "service stopper" for Prey
::

@echo off
if [%1]==[] goto usage

set productVersion=%1

if exist service_stopper.wixobj (
  del *.wixobj
  del *.wixpdb
)

:: Create service_stopper.msi
candle ^
-dProductVersion=%productVersion% ^
service_stopper.wxs

light ^
-ext WixUtilExtension ^
-out service_stopper.msi ^
service_stopper.wixobj

goto end

:usage
@echo Usage: %0 productVersion

:end
:: Cleanup
if exist service_stopper.wixobj (
  del *.wixobj
  del *.wixpdb
)
