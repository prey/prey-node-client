
:: Builds the source package for the MSI file

@echo off
if [%1]==[] goto usage

rmdir /s /q ..\source-msi
set directory=..\source-msi\versions\%1%

mkdir %directory%

:: /bin directory contents
mkdir %directory%\bin
xcopy ..\..\..\bin %directory%\bin /s /i
copy ..\..\..\bin\prey.cmd %directory%\bin\.

:: /lib directory contents
mkdir %directory%\lib
xcopy ..\..\..\lib\agent %directory%\lib\agent /s /i
xcopy ..\..\..\lib\conf %directory%\lib\conf /s /i
mkdir %directory%\lib\system
copy ..\..\..\lib\system\* %directory%\lib\system
xcopy ..\..\..\lib\system\windows %directory%\lib\system\windows /s /i
xcopy ..\..\..\lib\utils %directory%\lib\utils /s /i
copy ..\..\..\lib\common.js %directory%\lib\common.js
copy ..\..\..\lib\index.js %directory%\lib\index.js

:: /node_modules
xcopy ..\..\..\node_modules\commander %directory%\node_modules\commander /s /i
xcopy ..\..\..\node_modules\getset %directory%\node_modules\getset /s /i
xcopy ..\..\..\node_modules\qs %directory%\node_modules\qs /s /i
xcopy ..\..\..\node_modules\needle %directory%\node_modules\needle /s /i
xcopy ..\..\..\node_modules\xml2js %directory%\node_modules\xml2js /s /i
xcopy ..\..\..\node_modules\dialog %directory%\node_modules\dialog /s /i
xcopy ..\..\..\node_modules\mime %directory%\node_modules\mime /s /i
xcopy ..\..\..\node_modules\reply %directory%\node_modules\reply /s /i
xcopy ..\..\..\node_modules\async %directory%\node_modules\async /s /i
xcopy ..\..\..\node_modules\underscore %directory%\node_modules\underscore /s /i
xcopy ..\..\..\node_modules\unzip %directory%\node_modules\unzip /s /i
xcopy ..\..\..\node_modules\campfire %directory%\node_modules\campfire /s /i
xcopy ..\..\..\node_modules\nodemailer %directory%\node_modules\nodemailer /s /i
xcopy ..\..\..\node_modules\connect %directory%\node_modules\connect /s /i
xcopy ..\..\..\node_modules\entry %directory%\node_modules\entry /s /i
xcopy ..\..\..\node_modules\triggers %directory%\node_modules\triggers /s /i

:: /scripts
xcopy ..\..\..\scripts %directory%\scripts /s /i

:: /
copy ..\..\..\index.js %directory%\index.js
copy ..\..\..\license.txt %directory%\license.txt
copy ..\..\..\package.json %directory%\package.json
copy ..\..\..\prey.conf.default %directory%\prey.conf.default
copy ..\..\..\README.md %directory%\README.md

:: Add nodejs to the mix
copy "C:\Program Files\nodejs\node.exe" %directory%\bin\node.exe

goto end

:usage
@echo Usage: %0 productVersion

:end