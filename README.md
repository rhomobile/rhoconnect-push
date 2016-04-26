RhoConnect Push Service
========
RhoConnect push is a node.js service which facilitates sending messages to devices.  It can be used as a peer technology to RhoConnect's support for Android C2DM, iOS APNS, and BlackBerry BES push.

## Packaging the NPM

	$ make clean
	$ make all

This will produce a .tgz file which you can install.

## Installation
After building the npm, run:


	$ npm install -g rhoconnect-push-<version-you-built>.tgz


## Usage
First install and start a [redis server](http://redis.io).  Then run the following command:


	$ rhoconnect-push -c <path-to-configuration-json-file>


For example:


	$ rhoconnect-push -c ./config.json


## Running tests
Start redis, then:

```bash
$ make test

  ․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․․
	
  93 passing (356 ms)
```

## Deploying packaged RhoConnect Push on Linux servers
You can create RhoConnect Push production environment on Linux servers by installing prepackaged software for Ubuntu (12.x) and CentOS (5.x/6.x). At this moment supported formats are Debian (deb) and Red Hat (rpm) packages.

Just in a few clicks you will have installed on your Linux server

* Node.js with Npm package manager
* RhoConnect Push service
* Upstart script to start, stop, and control service (for Ubuntu and CentOS 6.x)

Prerequisites:
    * Python 2.6 or 2.7

### Steps for Debian-Based Linux Users

Add the following line to the end of your `/etc/apt/sources.list`

	deb http://rhoconnect-repo.s3.amazonaws.com/packages/deb rhoconnect-repo main

Then update repo list and install RhoConnect Push

    $ sudo apt-get update
    $ sudo apt-get install rhoconnect-push


### Steps for RedHat-Based Linux Users

Node.js requires python 2.6 which is not available for CentOS 5 stock version.
For this flavor of linux you need to install EPEL repo and install python26 RPM out of it:

    $ wget http://mirror.chpc.utah.edu/pub/epel/5/i386/epel-release-5-4.noarch.rpm
    $ rpm -i epel-release-5-4.noarch.rpm 
    $ yum install python26

Now create a file named `rhoconnect-repo.repo` in the `/etc/yum.repos.d/` directory:

    $ sudo nano /etc/yum.repos.d/rhoconnect-repo.repo

Copy and paste these contents into the file

    [rhoconnect-push]
    name=Rhoconnect Push Service
    baseurl=http://rhoconnect-repo.s3.amazonaws.com/packages/rpm
    enabled=1
    gpgcheck=0

Once that is done, it is time to install RhoConnect Push service

    $ sudo yum install rhoconnect-push
 
