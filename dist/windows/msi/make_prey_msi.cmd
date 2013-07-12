
:: Creates an MSI package for prey

@echo off
if [%1]==[] goto usage

set productVersion=%1

if exist prey_msi_fragment.wxs (
	del prey_msi_fragment.wxs
)
if exist main.wixobj (
	del *.wixobj
	del *.msi
	del *.wixpdb
)

:: Create Files Fragment
Paraffin prey_msi_fragment.wxs ^
-nrd ^
-dir ..\source-msi ^
-alias ..\source-msi ^
-groupname prey-msi

:: Create prey-x.y.z-win.msi
candle ^
-dProductVersion=%productVersion% ^
../assets/wix_ui_install_dir_customized.wxs prey_msi_fragment.wxs prey_msi_main.wxs

light ^
-ext WixUIExtension ^
-ext WixUtilExtension ^
-dWixUIDialogBmp=../assets/prey-wizard.bmp ^
-dWixUIBannerBmp=../assets/prey-wizard-2.bmp ^
-dWixUILicenseRtf=../assets/license.rtf ^
-loc ../assets/wix_localization_en.wxl ^
-out prey-%productVersion%-win.msi ^
wix_ui_install_dir_customized.wixobj prey_msi_fragment.wixobj prey_msi_main.wixobj

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