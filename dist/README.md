Prey Desktop Client Distribution
================================

To start, we need to get the node binaries needed to build the platform specific packages:

   $ scripts/node_bins.sh fetch # downloads latest node binaries from nodejs.org
   $ scripts/node_bins.sh set latest # sets latest node binaries for use in ./bin/node

Once the node binaries are in place, we build the ZIP packages: 

   $ scripts/build.sh

This will place the ZIP packages in ./dist/[version]. Once the ZIP packages are in place, 
we can build the native packages for each OS:

   $ dist/build_all.sh [version]

Or, if you just want to build for a specific OS:

   $ cd dist/mac && sh build.sh [version]

And voilá.
