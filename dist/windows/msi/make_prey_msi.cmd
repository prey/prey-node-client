
:: Creates an MSI package for prey

@echo off
if [%1]==[] goto usage

set productVersion=%1

:: Create Files Fragments
Paraffin prey_msi_fragment_x86.wxs ^
-nrd ^
-dir ..\source-msi-x86 ^
-alias ..\source-msi-x86 ^
-groupname prey-msi

Paraffin prey_msi_fragment_x64.wxs ^
-nrd ^
-dir ..\source-msi-x64 ^
-alias ..\source-msi-x64 ^
-groupname prey-msi

:: Compile wxs bits

candle ^
-dProductVersion=%productVersion% ^
../assets/wix_ui_install_dir_customized.wxs ^
prey_msi_fragment_x86.wxs ^
prey_msi_fragment_x64.wxs ^
prey_msi_main.wxs

:: Create prey-windows-$version-$arch.msi

light ^
-ext WixUIExtension ^
-ext WixUtilExtension ^
-dWixUIDialogBmp=../assets/prey-wizard.bmp ^
-dWixUIBannerBmp=../assets/prey-wizard-2.bmp ^
-dWixUILicenseRtf=../assets/license.rtf ^
-loc ../assets/wix_localization_en.wxl ^
-out prey-windows-%productVersion%-x86.msi ^
wix_ui_install_dir_customized.wixobj ^
prey_msi_fragment_x86.wixobj ^
prey_msi_main.wixobj

light ^
-ext WixUIExtension ^
-ext WixUtilExtension ^
-dWixUIDialogBmp=../assets/prey-wizard.bmp ^
-dWixUIBannerBmp=../assets/prey-wizard-2.bmp ^
-dWixUILicenseRtf=../assets/license.rtf ^
-loc ../assets/wix_localization_en.wxl ^
-out prey-windows-%productVersion%-x64.msi ^
wix_ui_install_dir_customized.wixobj ^
prey_msi_fragment_x64.wixobj ^
prey_msi_main.wixobj

goto end

:usage
@echo Usage: %0 productVersion

:end