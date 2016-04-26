## 1.2.4 (2015-07-14)
* Support for Node 12.x platform
* https protocol support from rhoconnect-push to rhoconnect server 

## 1.2.3 (2013-12-04)
* Additional tests added for nextMessage route
* Fixed CLI number switches (#61911428)

## 1.2.2 (2013-07-30)
* B-112695 - close pending nextMessage connection on delete registration
* Updated node to version 0.10.13 for rpm/deb packages

## 1.2.1 (2013-06-07)
* Fix --ignore-leaks issue with latest mocha
* Set default value of option 'authCredentialCacheEnabled' to yes
* Update path to handle application credentials to '/rc/v1/system/rps_login' route
* Don't hang auth requests (need to handle data event)

## 1.2.0 (2013-03-19)
* B-100241 - Support 'rhoconnect-push' on RHEL 5 platform
* B-97829 - Original ANS Server test cases ported over to rhoconnect-push project (implemented in tests/ directory)
* B-102908 - Auth routes updated to latest rhoconnect auth routes

## 1.1.1 (2012-11-12)
* Refactor `rhoconnect-push` cli to include common args
* Import of 9-28 server tag

## 1.1.0 (2012-10-01)
* Import of 9-04 server tag

## 1.0.2 (2012-07-25)
* updated vendor'ed ans2server

## 1.0.1 (2012-07-16)
* include vendor/ folder in package

## 1.0.0 (2012-07-13)
* initial release
