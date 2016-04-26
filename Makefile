NAME    		:= $(shell node -e "console.log(JSON.parse(require('fs').readFileSync('package.json', 'utf8')).name)")
VERSION 		:= $(shell node -e "console.log(JSON.parse(require('fs').readFileSync('package.json', 'utf8')).version)")
TARBALL 		:= $(NAME)-$(VERSION).tgz
FILES 			:= rho_push_install rho_push_uninstall rhoconnect-push.conf rhoconnect-push
REPORTER 		:= dot
MOCHA_OPTS	:= 
COMPILERS		:= coffee:coffee-script/register

cleanall: clean
	rm -f build/node-*.tar.gz
	rm -f build/*.rpm
	rm -f build/*.deb

clean:
	rm -rf vendor/ans2server-min.js bin/rhoconnect-push.js
	rm -rf node_modules/ *.tgz

dependencies:
	npm install

compress: dependencies
	touch vendor/ans2server-min.js
	node_modules/.bin/uglifyjs -mt -nc -o vendor/ans2server-min.js vendor/ans2server.js

package:
	npm install
	node_modules/.bin/coffee -c bin/rhoconnect-push
	echo '#!/usr/bin/env node' | cat - bin/rhoconnect-push.js > bin/rhoconnect-push.js.tmp
	mv bin/rhoconnect-push.js.tmp bin/rhoconnect-push.js
	npm pack

all: clean compress package

install: all
	npm install -g rhoconnect-push-$(VERSION).tgz

prepare: all
	mkdir -p /tmp/installdir
	cp rhoconnect-push-$(VERSION).tgz /tmp/installdir
	cd ./build; cp $(FILES) /tmp/installdir

test:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--require coffee-script/register \
		--compilers $(COMPILERS) \
		$(MOCHA_OPTS)

test-w:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--compilers $(COMPILERS) \
		--watch
		$(MOCHA_OPTS)

.PHONY: test test-w

# Build rpm package
# yum groupinstall "Development Tools" equals to --category "Development Tools"
rpm: prepare
	cd ./build; \
	fpm -s dir -t rpm -n $(NAME) -v $(VERSION) --iteration 2 -a noarch -C /tmp/installdir \
	--after-install /tmp/installdir/rho_push_install \
	--after-remove  /tmp/installdir/rho_push_uninstall \
	--prefix /opt/rhoconnect/installer \
	--description "RhoConnect Push Service" \
	--category "Development Tools" \
	./
	rm -rf /tmp/installdir

# Build deb package
deb: prepare
	cd ./build; \
	fpm -s dir -t deb -n $(NAME) -v $(VERSION) --iteration 2 -a all -C /tmp/installdir \
	-p rhoconnect-push-VERSION_ARCH.deb \
	--after-install /tmp/installdir/rho_push_install \
	--after-remove  /tmp/installdir/rho_push_uninstall \
	--prefix /opt/rhoconnect/installer \
	--description "RhoConnect Push Service" \
	-d "build-essential (>= 0)" \
	./
	rm -rf /tmp/installdir

# Build both rpm/deb packagees
build: prepare
	cd ./build; \
	fpm -s dir -t rpm -n $(NAME) -v $(VERSION) --iteration 2 -a noarch -C /tmp/installdir \
	-p rhoconnect-push-VERSION_ARCH.rpm \
	--after-install /tmp/installdir/rho_push_install \
	--after-remove  /tmp/installdir/rho_push_uninstall \
	--prefix /opt/rhoconnect/installer \
	--description "RhoConnect Push Service" \
	--category "Development Tools" \
	./
	cd ./build; \
	fpm -s dir -t deb -n $(NAME) -v $(VERSION) --iteration 2 -a all -C /tmp/installdir \
	-p rhoconnect-push-VERSION_ARCH.deb \
	--after-install /tmp/installdir/rho_push_install \
	--after-remove  /tmp/installdir/rho_push_uninstall \
	--prefix /opt/rhoconnect/installer \
	--description "RhoConnect Push Service" \
	-d "build-essential (>= 0)" \
	./
	rm -rf /tmp/installdir
