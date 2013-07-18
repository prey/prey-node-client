
:: Builds the source package for the MSI file

@echo off
if [%1]==[] goto usage

set productVersion=%1

::
:: x86
::
rmdir /s /q ..\source-msi-x86
set directory=..\source-msi-x86\versions
mkdir %directory%
unzip ..\..\%productVersion%\prey-windows-%productVersion%-x86.zip -d %directory%
ren %directory%\prey-%productVersion% %productVersion%

::
:: x64
::
rmdir /s /q ..\source-msi-x64
set directory=..\source-msi-x64\versions
mkdir %directory%
unzip ..\..\%productVersion%\prey-windows-%productVersion%-x64.zip -d %directory%
ren %directory%\prey-%productVersion% %productVersion%

goto end

:usage
@echo Usage: %0 productVersion

:end