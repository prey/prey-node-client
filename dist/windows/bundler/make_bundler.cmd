
:: Creates an MSI package for prey and its bundler

@echo off
if [%1]==[] goto usage

set productVersion="%1"

if exist prey-%productVersion%-win-bundle.exe (
  del prey-%productVersion%-win-bundle.exe
)

if exist bundler.wixobj (
  del *.wixobj
  del *.msi
  del *.wixpdb
)

if exist prey_msi_fragment.wxs (
  del prey_msi_fragment.wxs
)

:: Create Files Fragment
Paraffin prey_msi_fragment.wxs ^
-nrd ^
-dirref INSTALLLOCATION ^
-dir ..\source-msi ^
-alias ..\source-msi ^
-groupname prey-msi

:: Create prey-x.y.z-win.msi
candle ^
  -dProductVersion=%productVersion% ^
  ../assets/wix_ui_bundle_customized.wxs prey_msi_fragment.wxs prey_msi_main.wxs

light ^
  -ext WixUIExtension ^
  -ext WixUtilExtension ^
  -dWixUIDialogBmp=../assets/prey-wizard.bmp ^
  -dWixUIBannerBmp=../assets/prey-wizard-2.bmp ^
  -dWixUILicenseRtf=../assets/license.rtf ^
  -loc ../assets/wix_localization_en.wxl ^
  -out prey-%productVersion%-win.msi ^
 wix_ui_bundle_customized.wixobj prey_msi_fragment.wixobj prey_msi_main.wixobj

:: Create Bundle
candle ^
  -dProductVersion=%productVersion% ^
  -ext WiXUtilExtension ^
  -ext WixBalExtension ^
  bundler.wxs

light ^
  -ext WiXUtilExtension ^
  -ext WixBalExtension ^
  -out prey-%productVersion%-win-bundle.exe ^
  bundler.wixobj

goto end

:usage
@echo Usage: %0 productVersion

:end
if exist prey_msi_fragment.wxs (
  del prey_msi_fragment.wxs
)
if exist prey_msi_main.wixobj (
  del *.wixobj
  del *.wixpdb
)
if exist prey-%productVersion%-win.msi (
  del *.msi
)
