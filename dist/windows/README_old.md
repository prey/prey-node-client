# MSI Installer Package Knowledge Base

## Make the `msi` file

### Get the source files

Being in a windows system, go to the directory [prey]/dist/windows and use the command:

````bash
$ make_msi_source <productVersion>
````

Where `productVersion` is the version we want to give to our installer. For example, `0.10.0`.

A built source will be at the directory `source-msi` inside `[prey]/dist/windows`. Don't forget to include the `node_modules` in yur build before!

### Execute `make_prey_msi.cmd`

You need to have installed the following software:

* [Paraffin](http://www.wintellect.com/Media/Default/Blogs/Files/paraffin/Paraffin-3.6.zip)

Paraffin is inside a .zip file. Uncompress it, and put the Paraffin.exe file found in the uncompressed `debug` folder inside a directory which you have `PATH` relationship. (Of course, you have to know which directory suits you, and how to configure `PATH` in windows, but that knowledge is outside the scopes of this tutorial).

* [Wix Tools](http://wix.codeplex.com/releases/view/99514)

This is a installer. So, once downloaded, double click on it, and follow the instructions. Remember to add the bin directory of Wix to the PATH variable.

Then, Just run the command (inside directory `[prey]/dist/windows`):

````bash
$ make_prey_msi <productVersion>
````

Where `productVersion` is the version we want to give to our installer. For example, `0.10.0`

### The `make_msi.cmd` file

* The first step taken is checking that the `productVersion` parameter is given.

* Then, we delete former versions of the files generated (if any)

* Next, we create a Wix fragment with Paraffin. This fragment will be used later in the compilation of the msi file.

* Paraffin is invoked using a couple of parameters:

````bash
Paraffin prey-msi.wxs ^
-nrd ^
-dir source-msi ^
-dirref INSTALLLOCATION ^
-alias source-msi ^
-groupname prey-msi
````

  - `nrd`: Do not include the root folder source-msi.
  - `dir`: The directory to be made a wix fragment.
  - `dirref`: It's necessary, since we are including the _MSI_ inside a bundle. From there we are making the `INSTALLLOCATION` User's choice.
  - `alias`: Is used to avoid the hard directory route written in the msi.
  - `groupname`: This is the reference for the fragment to be used inside the Wix main file.

* With the fragment done, we call `candle` and `light`. These programs belong to the WiX Tools Suite. While `candle` stands for _compiler_,`light` got its name from _linker_ (the initial _l_), .

* The parameters used to call `candle` and `light` are the following:

````bash
candle ^
-dProductVersion=%productVersion% ^
assets/wix_ui_install_dir_customized.wxs prey_msi_fragment.wxs prey_msi_main.wxs
````

  - `-d`: Assigns to the variable `ProductVersion` the version of the product.
  Following the files to be compiled:
    - A custom User Interface (We are just changing the font and colour of some dialogs).
    - The file containing the fragment of the components to be added, `prey-msi.wxs`.
    - The file containing the main instructions to create the _msi_ file, `main.wxs`. More note on this particular file, below, given its importance.

* Inmediately, we call `light`, so we link and produce the _msi_ file:

````bash
light ^
-ext WixUIExtension ^
-ext WixUtilExtension ^
-dWixUIDialogBmp=assets/prey-wizard.bmp ^
-dWixUIBannerBmp=assets/prey-wizard-2.bmp ^
-dWixUILicenseRtf=assets/license.rtf ^
-loc assets/wix_localization_en.wxl ^
-out prey-%productVersion%-win.msi ^
wix_ui_install_dir_customized.wixobj prey_msi_fragment.wixobj prey_msi_main.wixobj
````

  - `-ext WixUIExtension`: Enables the customizing of the UI.
  - `-ext WixUtilExtension`: Enables the use of a custom action at the end of the installing.
  - `-dWixUIDialogBmp`: Start and Finish .BMP Image
  - `-dWixUIBannerBmp`: Middle .BMP Image
  - `-dWixUILicenseRtf`: License File
  - `-loc assets/wix_localization_en.wxl`: Contains the UI Strings. Albeit at 20130704 we haven't changed the texts, we needed to change the typography.
  - `-out prey-%productVersion%-win.msi ^`: The actual _MSI_ file.
	Following the files already compiled, to be linked.

* The outputted file is `prey-%productVersion%-win.msi`, for example `prey-0.10.0-win.msi`. Note that this file is enough for installing a working copy of `prey` in your windows system. But is not enough if you want to make sure that the users have `.NET` version `2.0` in their machines. We need to issue a _bundle_ to accomplish that task.

#### The`prey_msi_main.wxs` file?

This file contains the WiX instructions to generate the `.msi` file which will install prey.

* Custom Actions

The installer executes two custom actions after copying the files: `config activate` and `config hooks post_install`. The code to accomplish these action is:

````xml
      <!-- CUSTOM ACTIONS
        * bin\prey.cmd config activate (ON INSTALLING)
        * bin\prey.cmd config hooks pre_uninstall (ON UNINSTALLING)
      -->

      <!-- bin\prey.cmd config activate -->
      <SetProperty  Id="CommandConfigActivate"
                    Before="AppSearch"
                    Value="&quot;[INSTALLLOCATION]versions\$(var.ProductVersion)\bin\prey.cmd&quot; config activate"/>
      <CustomAction Id="CommandConfigActivate"
                   BinaryKey="WixCA"
                   DllEntry="CAQuietExec"
                   Execute="deferred"
                   Impersonate="no"
                   Return="ignore"/>

      <!-- bin\prey.cmd config deactivate -->
      <Property Id="EXISTINGINSTALLDIR" Secure="yes">
        <RegistrySearch Id="Locate_EXISTINGINSTALLDIR"
                        Root="HKLM"
                        Key="Software\Prey"
                        Name="INSTALLDIR"
                        Type="directory" />
      </Property>
      <CustomAction Id="Set_CommandConfigDeactivate"
                    Execute="firstSequence"
                    Property="CommandConfigDeactivate"
                    Value="&quot;[EXISTINGINSTALLDIR]versions\$(var.ProductVersion)\bin\prey.cmd&quot; config deactivate" />
      <CustomAction Id="CommandConfigDeactivate"
                   BinaryKey="WixCA"
                   DllEntry="CAQuietExec"
                   Execute="deferred"
                   Impersonate="no"
                   Return="ignore"/>

      <!-- The action to be executed -->
      <InstallExecuteSequence>
         <Custom Action="CommandConfigActivate"
                 After="PublishProduct">NOT Installed</Custom>
         <Custom Action="Set_CommandConfigDeactivate"
                 After="InstallInitialize">Installed</Custom>
         <Custom Action="CommandConfigDeactivate"
                 After="Set_CommandConfigDeactivate">Installed</Custom>
      </InstallExecuteSequence>
````

As a child of the tag `Product`.

We need to use `SetProperty`, since the value of the executable needs the value of the property `INSTALLDIR`, failing to doing this way grants us a warning during the creation of the _msi_ file. Both CustomAction's uses `WixCA` and `CAQuietExec`, the elements of WiX able to do stealth custom actions, needs to be executed as `deferred` in order to access escalated privileges.

Inside the tag `InstallExecuteSequence`, we set the first action after `PublishProduct`, the last element before the event `InstallFinalize`, since we are running a deferred escalated action, and we make sure to execute these actions only when the product is `NOT INSTALLED`.

## Make the `bundle` file

The _bundle_ file will give us the possibility to include .NET as a requirement in our application. Given the user the chance to install it if they do not have it.

