# MSI Installer Package Knowledge Base

## System Requirements

(TODO)

## Creating a "standalone" Prey _MSI_ package

### Make the source directory

(TODO)

### make_prey_msi.cmd

(TODO)

### prey_msi_main.wxs

(TODO)

### Uninstalling Prey

(TODO)

## Creating a "bundled" Prey _MSI_ package

### The differences with the _standalone_ package

(TODO)

### Make the source Directory

(TODO)

### make_bundler.cmd

(TODO)

### prey_msi_main.wxs

(TODO)

### bundler.wxs

(TODO)

### Uninstalling Prey

(TODO)

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
