
@echo off
if [%1]==[] goto usage

set productVersion="%1"

if exist bundler.wixobj (
  del bundler.wixobj
)

:: Create Bundle
candle ^
-dProductVersion=%productVersion% ^
-ext WiXUtilExtension ^
-ext WixBalExtension ^
bundler.wxs

light ^
-ext WiXUtilExtension ^
-ext WixBalExtension ^
-out test-installer-%productVersion%.exe ^
bundler.wixobj

goto end

:usage
@echo Usage: %0 productVersion

:end

::del *.wixobj
