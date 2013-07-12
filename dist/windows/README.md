# MSI Installer Package Knowledge Base

## System Requirements

You need the following software in your windows machine to create the installer:

* [Paraffin](http://www.wintellect.com/Media/Default/Blogs/Files/paraffin/Paraffin-3.6.zip)

Paraffin is inside a .zip file. Uncompress it, and put the Paraffin.exe file found in the uncompressed `debug` folder inside a directory which you have `PATH` relationship. (Of course, you have to know which directory suits you, and how to configure `PATH` in windows, but that knowledge is outside the scopes of this tutorial).

* [Wix Tools](http://wix.codeplex.com/releases/view/99514)

This is a installer. So, once downloaded, double click on it, and follow the instructions. Remember to add the bin directory of Wix to the PATH variable.

* [](http://stahlworks.com/dev/unzip.exe)

Needed to unzip the packages prepared in the *nix machine. Put it in `C:\Windows`.

## Prepare source to be packaged

The first procedure must be done in a _*nix_ machine.

To start, we need to get the node binaries needed to build the platform specific packages:

````bash
   $ scripts/node_bins.sh fetch # downloads latest node binaries from nodejs.org
   $ scripts/node_bins.sh set latest # sets latest node binaries for use in ./bin/node
````

Once the node binaries are in place, we build the ZIP packages:

````bash
   $ scripts/build.sh
```

Now, these ZIP packages are in the directory `dist/<version>`:

* prey-windows-0.10.0-x64.zip
* prey-windows-0.10.0-x86.zip

## Creating a "standalone" Prey _MSI_ package

The following procedures are to be made inside a windows machine.

### Make the source directory

Go to `[Your Repo]\dist\windows\msi` and issue the command:

````bash
> make_source_msi <version>
````

Where `<version>` is the same version used at building the packages above.

This will put the contents of prey inside the directory `[Your Repo]\dist\windows\source-msi-x86` and `[Your Repo]\dist\windows\source-msi-x64`.

### make_prey_msi.cmd

Execute the command:

````bash
> make_prey_msi.cmd <version>
````

Where `<version>` is the same version used at building the packages above.

The resulting packages will be:

* prey-windows-<version>-<arch>.msi

With `version`, an x.y.z number and `arch`, the architecture (x86 or x64).

### Manually uninstalling Prey

Find the registry key `HKLM\Software\Prey\ProductCode`. You will find a _GUI_ inside curly braces. For example, `{EC9331C6-47F5-430A-98B5-0E2182573E9F}`. Call `msiexec.exe` this way:

````bash
> msiexec.exe /x{EC9331C6-47F5-430A-98B5-0E2182573E9F}
````

This will initiate the uninstalling process.

## Knowledge Resources

* [ORCA](http://msdn.microsoft.com/en-us/library/aa370557.aspx): Opens up your _MSI_ file to show you what's in it.

* A good resource that helped me (@hermanjunge) to understand a little bit more on Strings and localization is [this link](https://github.com/puppetlabs/puppet_for_the_win/blob/master/wix/localization/puppet_en-us.wxl).

* To get the <RemotePayload> Data (For the bundle information of the .NET file):

````bash
$ head payload dotnetfx.exe -out myFile.wxs
````

* The reason I found for the `Compressed = no` parameter in [this link](http://stackoverflow.com/questions/15205646/remotepayload-the-system-cannot-find-the-file-with-type).

* On "Why the property `NETFRAMEWORK20` won't work in my bundle file?". You can't use an MSI property in a burn expression.

````xml
<PropertyRef Id="NETFRAMEWORK20"/>
````
The above won't work. And you'll have to develop your custom way to get the value of .NET.

My source is [this link](http://stackoverflow.com/questions/14863905/wix-bundle-exepackage-detectcondition-is-always-false#comment20898210_14868068), and my workaround is based in [this link](http://neilsleightholm.blogspot.com/2012/05/wix-burn-tipstricks.html).
