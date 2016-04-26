// ANS server protocol
//////////////// Incoming requests //////////////////////
// /instanceID                                               POST       {}
// /instanceID/{instance}                                    GET
// /registrations/{instance}/{user}/{app}                    GET
// /registrations/{instance}/{user}/{app}                    PUT
// /registrations/{instance}/{user}/{app}                    DELETE
// /nextMessage/{instance}                                   GET
// /messageQueue/{token}                                     POST       {collapseID: '#', token: '#', messageBody: "Text"}

//////////////// Outgoing responses /////////////////////
// Response to /instanceId                                   POST       {instance:'#'}
// Response to /instanceID/{instance}                        GET        {}, header "set-cookie: instance=#"
// Response to /registrations/{instance}/{user}/{app}        GET        {token: '#'}
// Response to /registrations/{instance}/{user}/{app}        PUT        {token: '#'}
// Response to /registrations/{instance}/{user}/{app}        DELETE     {}
// Response to /nextMessage/{instance}                       GET        {id: '#', token: '#', data: 'Text'}
// Response to /messageQueue/{token}                         POST       {}

// System modules
var http = require('http');
var https = require('https');
var util = require('util');
var nodeUuid = require('node-uuid');
var crypto = require('crypto');
var fs = require('fs');
var client;

var assert = require('assert');

// Local modules
var validator = require('./json-schema-validator.js');

// Globals
var LOG_ERR = 0;
var LOG_OPS = 1;
var LOG_ALL = 3;

var responseObject = [];                // response object for a request whose response must be delayed
var timerHandle = [];                   // timer handle for timer associated with response object
var debugClientRequestCount = 0;
var expirationInterval = 0;
var configParsed = {};
var userAuthOptions = {};
var appAuthOptions = {};
var authCredentialCache = [];
var authCredentialCacheLength = 0;

// startServer
exports.startServer = function (configObj) {

    // initialize the server configuration parameters
    if (configObj==undefined) {
        console.log('No configuration parameters supplied, exiting');
        return;
    }

    // copy the configObj fields into a private, local object, so they can't be altered behind the
    // server's back. Also check for the presence of the necessary config fields, setting them
    //to a default, if not specified
    if (configObj.debugLevel==undefined) {
        configParsed.debugLevel = 0;
        debugLog('debugLevel not specified - setting to default 0', LOG_ERR);
    }
    else
        configParsed.debugLevel = Number(configObj.debugLevel);

    // http connectivity params
    if (configObj.httpSecure==undefined) {
        configParsed.httpSecure = 'y';
        debugLog('httpSecure not specified - setting to default "y"', LOG_ERR);
    }
    else
        configParsed.httpSecure = configObj.httpSecure;

    // http connectivity params for rhoconnect
    if (configObj.rcSecure==undefined) {
        configParsed.rcSecure = 'y';
        debugLog('rcSecure not specified - setting to default "y"', LOG_ERR);
    }
    else {
        configParsed.rcSecure = configObj.rcSecure;
	}
	if (configParsed.rcSecure == 'y') 
 		configParsed.protocol = https;
	else
 		configParsed.protocol = http;
	
		

    if (configParsed.httpSecure!='n') {
        if (configObj.keyFile==undefined) {
            configParsed.keyFile = 'privatekey.pem';
            debugLog('keyFile not specified - setting to default "privatekey.pem"', LOG_ERR);
        }
        else
            configParsed.keyFile = configObj.keyFile;

        if (configObj.certificateFile==undefined) {
            configParsed.certificateFile = 'certificate.pem';
            debugLog('certificateFile not specified - setting to default "certificate.pem"', LOG_ERR);
        }
        else
            configParsed.certificateFile = configObj.certificateFile;

        if (configObj.certificateAuthorityFile==undefined) {
            configParsed.certificateAuthorityFile = 'certificateauthority.pem';
            debugLog('certificateAuthorityFile not specified - setting to default "certificateauthority.pem"', LOG_ERR);
        }
        else
            configParsed.certificateAuthorityFile = configObj.certificateAuthorityFile;
    }
    else
        configParsed.certificateAuthorityFile = configObj.certificateAuthorityFile;

    // authorization host params
    if (configObj.appAuthHost==undefined) {
        configParsed.appAuthHost = 'localhost';
        debugLog('appAuthHost not specified - setting to default "localhost"', LOG_ERR);
    }
    else
        configParsed.appAuthHost = configObj.appAuthHost;

    if (configObj.appAuthPort==undefined) {
        configParsed.appAuthPort = '5002';
        debugLog('appAuthPort not specified - setting to default "5002"', LOG_ERR);
    }
    else
        configParsed.appAuthPort = configObj.appAuthPort;


    if (configObj.appAuthUrl==undefined) {
        configParsed.appAuthUrl = '/appAuthUrl';
        debugLog('appAuthUrl not specified - setting to default "/appAuthUrl"', LOG_ERR);
    }
    else
        configParsed.appAuthUrl = configObj.appAuthUrl;

    if (configObj.userAuthHost==undefined) {
        configParsed.uesrAuthHost = 'localhost';
        debugLog('userAuthHost not specified - setting to default "localhost"', LOG_ERR);
    }
    else
        configParsed.userAuthHost = configObj.userAuthHost;

    if (configObj.userAuthPort==undefined) {
        configParsed.userAuthPort = '5003';
        debugLog('userAuthPort not specified - setting to default "5003"', LOG_ERR);
    }
    else
        configParsed.userAuthPort = configObj.userAuthPort;


    if (configObj.userAuthUrl==undefined) {
        configParsed.userAuthUrl = '/userAuthUrl';
        debugLog('userAuthUrl not specified - setting to default "/userAuthUrl"', LOG_ERR);
    }
    else
        configParsed.userAuthUrl = configObj.userAuthUrl;

    // ANS server params
    if (configObj.ansServerPort==undefined) {
        configParsed.ansServerPort = '5000';
        debugLog('ansServerPort not specified - setting to default "5000"', LOG_ERR);
    }
    else
        configParsed.ansServerPort = configObj.ansServerPort;

    if (configObj.socketPoolSize==undefined) {
        configParsed.socketPoolSize = 5;
        debugLog('socketPoolSize not specified - setting to default "5"', LOG_ERR);
    }
    else
        configParsed.socketPoolSize = Number(configObj.socketPoolSize);

    if (configObj.ansResponseTimeout==undefined) {
        configParsed.ansResponseTimeout = 300000;
        debugLog('ansResponseTimeout not specified - setting to default "300000 (5 min)"', LOG_ERR);
    }
    else
        configParsed.ansResponseTimeout = Number(configObj.ansResponseTimeout);

    if (configObj.authCredentialCacheEnabled==undefined) {
        configParsed.authCredentialCacheEnabled = 'n';
        debugLog('authCredentialCacheEnabled not specified - setting to default "n"', LOG_ERR);
    }
    else
        configParsed.authCredentialCacheEnabled = configObj.authCredentialCacheEnabled;

    if (configObj.authCredentialCacheSize==undefined) {
        configParsed.authCredentialCacheSize = 10;
        debugLog('authCredentialCacheSize not specified - setting to default "10"', LOG_ERR);
    }
    else
        configParsed.authCredentialCacheSize = Number(configObj.authCredentialCacheSize);

    if (configObj.authCredentialLifetime==undefined) {
        configParsed.authCredentialLifetime = 60000;
        debugLog('authCredentialLifetime not specified - setting to default "60000 (ms)"', LOG_ERR);
    }
    else
        configParsed.authCredentialLifetime = Number(configObj.authCredentialLifetime);

    // REDIS params
    if (configObj.registrationTimeout==undefined) {
        configParsed.registrationTimeout = 2592000;
        debugLog('registrationTimeout not specified - setting to default 2592000 (30 days)', LOG_ERR);
    }
    else
        configParsed.registrationTimeout = Number(configObj.registrationTimeout);

    if (configObj.clearDataBase==undefined) {
        configParsed.clearDataBase = 'n';
        debugLog('clearDataBase not specified - setting to default "n"', LOG_ERR);
    }
    else
        configParsed.clearDataBase = configObj.clearDataBase;

    if (configObj.redisToGoUrl==undefined) {
        configParsed.redisToGoUrl = process.env.REDISTOGO_URL;
        debugLog('redisToGoUrl not specified - setting to value of environment variable REDISTOGOURL"', LOG_ERR);
    }
    else
        configParsed.redisToGoUrl = configObj.redisToGoUrl;

    debugLog('## Configuration settings', LOG_ALL);
    debugLog(util.inspect(configParsed), LOG_ALL);

    // expiration interval for persistent (REDIS) items
    expirationInterval = configParsed.registrationTimeout;

    client = require('redis-url').createClient(configParsed.redisToGoUrl);
    // listen for errors from the persistent store server
    client.on("error", function (err) {
        debugLog("REDIS ERROR " + err, LOG_ERR);
    });

    // flush the persistent store, if desired
    if (configParsed.clearDataBase=='y')
        client.flushdb();

    // Set up agents to be used to manage connections to the authorization server
    // options for http connection to authorization server
    userAuthOptions = {
        host: configParsed.userAuthHost,
        path: configParsed.userAuthUrl,
        port: configParsed.userAuthPort,
        method: 'GET',
        headers: {
            connection: 'keep-alive',
            'content-type': 'application/json'
        }
    };
    // set the agent in the options object
    if (configParsed.rcSecure=='y')
       userAuthOptions.agent = new https.Agent();
    else
       userAuthOptions.agent = new http.Agent();

    userAuthOptions.agent.maxSockets = configParsed.socketPoolSize;
    // modify the agent's free and addRequest methods
    enhancedKeepAliveReuse(userAuthOptions.agent);

debugLog("&&&& userAuthOptions : " + util.inspect(userAuthOptions), LOG_ALL);

    appAuthOptions = {
        host: configParsed.appAuthHost,
        path: configParsed.appAuthUrl,
        port: configParsed.appAuthPort,
        method: 'GET',
        headers: {
            connection: 'keep-alive',
            'content-type': 'application/json'
        }
    };
    // set the agent in the options object
    if (configParsed.rcSecure=='y')
       appAuthOptions.agent = new https.Agent();
    else
       appAuthOptions.agent = new http.Agent();
    appAuthOptions.agent.maxSockets = configParsed.socketPoolSize;
    // modify the agent's free and addRequest methods
    enhancedKeepAliveReuse(appAuthOptions.agent);

    ////////////////////////////////////////////////////////////////////////////////////
    // The root of it all - creation of the server
    ////////////////////////////////////////////////////////////////////////////////////
    // depending on whether server is to be secure or not, as specified in config params,
    // we need to start an http or https server
    if (configParsed.httpSecure=='n') {
        var server = http.createServer(function(request, response) {
            var requestMessage = '';

            // in this server, all data comes in one chunk
            request.addListener('close', function() {
                debugLog('Connection closed', LOG_ALL);
            });
            request.addListener('data', function(chunk) {
                requestMessage += chunk;
            });
            request.addListener('end', function() {
                handleEnd(request, response, requestMessage);
            });
        });
    }
    else {
        var options = {
            key: fs.readFileSync(configParsed.keyFile),
            cert: fs.readFileSync(configParsed.certificateFile),
            ca: fs.readFileSync(configParsed.certificateAuthorityFile)
        };

        var server = https.createServer(options, function(request, response) {
            var requestMessage = '';

            // in this server, all data comes in one chunk
            request.addListener('close', function() {
                debugLog('Connection closed', LOG_ALL);
            });
            request.addListener('data', function(chunk) {
                requestMessage += chunk;
            });
            request.addListener('end', function() {
                handleEnd(request, response, requestMessage);
            });
        });
    }

    server.addListener('request', function(req, res) {
        if (configParsed.ansResponseTimeout)
            // close idle service connection after ansResponseTimeout/60000 + 1 minutes
        req.connection.setTimeout(configParsed.ansResponseTimeout + 60000);
        else
            // close idle service connection after 5 minutes
        req.connection.setTimeout(300000);
    });

    server.addListener('connection', function(stream) {
        debugLog('## RhoConnect push server: New connection from ' + stream.remoteAddress, LOG_ALL);
        // close idle server connection after 2 hours
        stream.setTimeout(2 * 60 * 60 * 1000);
    });

    var port = process.env.PORT || configParsed.ansServerPort;
    server.listen(port);
    debugLog('## RhoConnect push server: Listening on port ' + port, LOG_ALL);
    return server;
}

/////////////////////////
// Handle the "end" event of the server
/////////////////////////
function handleEnd(request, response, requestMessage) {
    var url = request.url;
    var method = request.method;

    // Log receipt of a request and parse the request message, if any
    if (method=='GET' || method=='PUT') {
        debugLog('\n\n***** ' + debugClientRequestCount + ' ' + method + ' ' + url, LOG_ALL);
    }
    else {
        if (requestMessage=='')
            requestMessage = '{}';
        debugLog('\n\n***** ' + debugClientRequestCount + ' ' + method + ' ' + url + ' ' + requestMessage, LOG_ALL);
    }

    debugClientRequestCount++;

    // Parse pathname in header and call proper handling function
    if (url=='/instanceId' && method=='POST')
        handleCreateInstanceID(request, response);
    else if (url.search(/\/instanceId\//)==0) {
        if (method=='GET')
            handleGetCookie(request, response);
        else if (method=='DELETE')
            handleDeleteInstance(request, response);
        else {
            debugLog('Unsupported operation', LOG_ERR);
            response.writeHead(403);
            response.end();
        }
    }
    else if (url.search(/\/registrations\//)==0) {
        if (method=='GET' || method=='PUT' || method=='DELETE')
             handleRegistration(request, response);
        else {
             debugLog('Unsupported operation', LOG_ERR);
             response.writeHead(403);
             response.end();
       }
    }
    else if (url.search(/\/nextMessage/)==0 && method=='GET')
        handleNextMessage(request, response);
    else if (url.search(/\/messageQueue/)==0 && method=='POST') {
        // back off debugClientRequestCount as this is a request from the app server
        debugClientRequestCount--;
        // messageQueue POST includes a JSON message, so validate request content-type.
        var reqContentType = request.headers['content-type'];
        if(!reqContentType || reqContentType != 'application/json') {
            response.writeHead(400); response.end();
            return;
        }

        handleMessageQueue(request, requestMessage, response);
    }
    else {
        debugLog('Malformed url or unsupported operation', LOG_ERR);
        response.writeHead(403);
        response.end();
    }
}

/////////////////////////
// Generate instance ID
/////////////////////////
function handleCreateInstanceID(request, response) {
    debugLog('## handleCreateInstanceID header(s) ' + JSON.stringify(request.headers), LOG_OPS);

    // authenticate user credentials supplied in header
    var options = userAuthOptions;

    if (request.headers.cookie!=undefined)
        options.headers.cookie = request.headers.cookie;
    else
        options.headers.cookie = '';

    if (request.headers.authorization!=undefined)
        options.headers.authorization = request.headers.authorization;
    else
        options.headers.authorization = '';

    var authReq = configParsed.protocol.request(options,
        function(authRes) {
            authRes.on('data', function (chunk) {
                debugLog('## userAuth received: ' + chunk);
            });
            authRes.setEncoding('utf8');
            authRes.on('end', function() {
                if (authRes.statusCode==204) {
                    // create a new instanceID
                    var username = getNameFromCredentials(request);
                    var instanceID = generateInstanceID(username);
                    // respond with new instanceID
                    debugLog('## Created new instance ID', LOG_ALL);
                    debugLog('## InstanceID ' + instanceID, LOG_ALL);
                    response.writeHead(200, {'Content-Type': 'application/json'});
                    response.end(JSON.stringify({ instance: instanceID }), 'utf8');
                }
                else {
                    debugLog('Invalid authentication credentials', LOG_ERR);
                    debugLog('Credentials ' + request.headers.authorization, LOG_ERR);
                    response.writeHead(401);
                    response.end();
                }
            });
        }
    );
    authReq.on('error', function(args) {
        debugLog('User authorization server unavailable ' + util.inspect(args), LOG_ERR);
        response.writeHead(503);
        response.end();
    });

    authReq.end();
    return 1;
}

/////////////////////////
// Generate cookie from the instanceID supplied in url of the request.
// Must authenticate user credentials before doing so
/////////////////////////
function handleGetCookie(request, response) {
    debugLog('## handleGetCookie header(s) ' + JSON.stringify(request.headers), LOG_OPS);

    var UrlObject = new Object();

    // check to see if cookie corresponds to instanceID and url is well-formed
    if (!getUrlFieldsCookieAndCheck(request, UrlObject, 2, false, response))
        return 0;

    var instanceID = UrlObject.fields[2];
    var username = getNameFromCredentials(request);

    // authenticate user credentials supplied in header
    var options = userAuthOptions;

    if (request.headers.cookie!=undefined)
        options.headers.cookie = request.headers.cookie;
    else
        options.headers.cookie = '';

    if (request.headers.authorization!=undefined)
        options.headers.authorization = request.headers.authorization;
    else
        options.headers.authorization = '';

    var authReq = configParsed.protocol.request(options,
        function(authRes) {
            authRes.on('data', function (chunk) {
                debugLog('## userAuth received: ' + chunk);
            });
            authRes.setEncoding('utf8');
            authRes.on('end', function() {
                if (authRes.statusCode==204) {
                    // verify that this instanceID was created with this authorized username
                    if (verifyInstanceID(instanceID, username)) {
                        // generate the cookie
                        var cookie = generateCookie(instanceID);
                        debugLog('## Created new cookie', LOG_ALL);
                        debugLog('## Cookie ' + cookie, LOG_ALL);
                        response.writeHead(204, {'Set-Cookie': 'instance=' + cookie, Secure: true, HttpOnly: true });
                        response.end();
                    }
                    else {
                        debugLog('InstanceID cannot be generated from user name in credentials', LOG_ERR);
                        debugLog('instanceID ' + instanceID + ' username ' + username, LOG_ERR);
                        response.writeHead(404);
                        response.end();
                    }
                }
                else {
                    debugLog('Invalid authentication credentials', LOG_ERR);
                    debugLog('Credentials ' + request.headers.authorization, LOG_ERR);
                    response.writeHead(401);
                    response.end();
                }
            });
        }
    );
    authReq.on('error', function() {
        debugLog('User authorization sever unavailable', LOG_ERR);
        response.writeHead(503);
        response.end();
    });

    authReq.end();
    return 1;
}


/////////////////////////
// Delete all queue-related data associated with this instanceID, effectively
// making this instanceID invalid.
/////////////////////////
function handleDeleteInstance(request, response) {
    debugLog('## handleDeleteInstance header(s)' + JSON.stringify(request.headers), LOG_OPS);

    var UrlObject = new Object();

    // check to see if cookie corresponds to instanceID and url is well-formed
    if (!getUrlFieldsCookieAndCheck(request, UrlObject, 2, false, response))
        return 0;

    var instanceID = UrlObject.fields[2];

    // authenticate user credentials supplied in header
    var options = userAuthOptions;

    if (request.headers.cookie!=undefined)
        options.headers.cookie = request.headers.cookie;
    else
        options.headers.cookie = '';

    if (request.headers.authorization!=undefined)
        options.headers.authorization = request.headers.authorization;
    else
        options.headers.authorization = '';
	//console.log (util.inspect (options.headers));

    var authReq = configParsed.protocol.request(options,
        function(authRes) {
            authRes.on('data', function (chunk) {
                debugLog('## userAuth received: ' + chunk);
            });
            authRes.setEncoding('utf8');
            authRes.on('end', function() {
                if (authRes.statusCode==204) {
                    // delete all tokens associated with this instanceID
                    client.smembers('reg:' + instanceID, function(err, reply) {
                        if (reply==undefined || reply==null || reply.length==0) {
                            debugLog('InstanceID registration not found', LOG_ERR);
                            debugLog('instanceID ' + instanceID, LOG_ERR);
                            response.writeHead(404); response.end();
                        }
                        else {
                            var tokApp;
                            // ATOMIC operation
                            var multi = client.multi();
                            for (var i=0, lim = reply.length; i<lim; i++) {
                                tokApp = JSON.parse(reply[i]);
                                multi.del('tok:' + tokApp.token);
                            }

                            // delete all the *:instanceID keys
                            multi.del('cnt:' + instanceID);
                            multi.del('reg:' + instanceID);
                            multi.del('col:' + instanceID);
                            multi.del('que:' + instanceID);
                            multi.exec(function (err, replies) {
                               debugLog("## Multi reply to delete instance " + replies, LOG_ALL);
                            });
                            // END ATOMIC

                            debugLog('## Deleted all data structures for instanceID ' + instanceID, LOG_ALL);
                            response.writeHead(204);
                            response.end();
                        }
                    });
                }
                else {
                    debugLog('Invalid authentication credentials', LOG_ERR);
                    debugLog('Credentials ' + request.headers.authorization, LOG_ERR);
                    response.writeHead(401);
                    response.end();
                }
            });
        }
    );
    authReq.on('error', function() {
        debugLog('User authorization sever unavailable', LOG_ERR);
        response.writeHead(503);
        response.end();
    });

    authReq.end();
    return 1;
}

/////////////////////////
// Get the token associated with this instanceID/app combo.
// Must authenticate user credentials.
// If no token exists, then this instanceID/app must not be registered
/////////////////////////
function handleRegistration(request, response) {
    debugLog('## handleRegistration header(s)' + JSON.stringify(request.headers), LOG_OPS);
    var method = request.method;
    var UrlObject = new Object();

    // check to see if cookie corresponds to instanceID and url is well-formed
    if (!getUrlFieldsCookieAndCheck(request, UrlObject, 4, true, response))
        return 0;

    var instanceID = UrlObject.fields[2];
    var username = UrlObject.fields[3];
    var appname = UrlObject.fields[4];

    // authenticate app credentials supplied in header
    var options = userAuthOptions;

    if (request.headers.cookie!=undefined)
        options.headers.cookie = request.headers.cookie;
    else
        options.headers.cookie = '';

    if (request.headers.authorization!=undefined)
        options.headers.authorization = request.headers.authorization;
    else
        options.headers.authorization = '';

    var authReq = configParsed.protocol.request(options,
        function(authRes) {
            authRes.on('data', function (chunk) {
                debugLog('## userAuth received: ' + chunk);
            });
            authRes.setEncoding('utf8');
            authRes.on('end', function() {
                if (authRes.statusCode==204) {
                    // find the token associated with this instanceID and appname
                    if (request.headers.authorization==undefined  || username==getNameFromCredentials(request)) {
                        client.smembers('reg:' + instanceID, function(err, reply) {
                            var tokApp;

                            if (reply==undefined || reply==null)
                                var lim = 0;
                            else
                                var lim = reply.length;

                            for (var i=0; i<lim; i++) {
                                tokApp = JSON.parse(reply[i]);
                                if (tokApp.appname==appname) {
                                    break;
                                }
                            }

                            if (i<lim) {
                                var token = tokApp.token;

                                if (method=='GET' || method=='PUT') {
                                    debugLog('## Found registration for instanceID-appname', LOG_ALL);
                                    debugLog('## instanceID ' + instanceID + ' appname ' + appname, LOG_ALL);
                                    // ATOMIC operation
                                    var multi = client.multi();
                                    multi.expire('cnt:' + instanceID, expirationInterval);
                                    multi.expire('reg:' + instanceID, expirationInterval);
                                    multi.expire('tok:' + token, expirationInterval);
                                    multi.expire('col:' + instanceID, expirationInterval);
                                    multi.expire('que:' + instanceID, expirationInterval);
                                    multi.exec(function (err, replies) {
                                        debugLog("## Multi reply to update expire times " + replies, LOG_ALL);
                                        logStateOfMappings(instanceID, token);
                                    });
                                    // END ATOMIC

                                    if (method=='GET')
                                        response.writeHead(200, {'Content-Type': 'application/json'});
                                    else
                                        response.writeHead(201, {'Content-Type': 'application/json'});

                                    response.end(JSON.stringify({ token: token }), 'utf8');
                                }
                                else {
                                    // this is a delete registration operation
                                    if (lim==1) {
                                        // this token is the only one registered with this instanceID, so
                                        // delete the *:instanceID keys
                                        debugLog('## This is the only registration - deleting instance', LOG_OPS, LOG_ALL);
                                        debugLog('## InstanceID ' + instanceID, LOG_ALL);
                                        // ATOMIC operation
                                        var multi = client.multi();
                                        multi.del('cnt:' + instanceID);
                                        multi.del('reg:' + instanceID);
                                        multi.del('col:' + instanceID);
                                        multi.del('que:' + instanceID);
                                        multi.del('tok:' + token);
                                        multi.exec(function (err, replies) {
                                            debugLog("## Multi reply to delete last registration " + replies, LOG_ALL);
                                            response.writeHead(204); response.end();
                                            logStateOfMappings(instanceID, token);
                                        });
                                        // END ATOMIC
                                        var oldConnection = responseObject[instanceID];
                                        if(oldConnection) {
                                          debugLog("## Closing existing connections on delete.", LOG_ALL);
                                          oldConnection.writeHead(410);
                                          oldConnection.end();
                                        }
                                        delete responseObject[instanceID];
                                        delete timerHandle[instanceID];
                                    }
                                    else {
                                        // this token is one of several registered with this instanceID, so
                                        // delete it's entry in the registration list and on the tok:token list
                                        // ATOMIC operation
                                        var multi = client.multi();
                                        multi.del('tok:' + token);
                                        var regString = JSON.stringify({ token: token, appname: appname });
                                        multi.srem('reg:' + instanceID, regString);
                                        multi.exec(function (err, replies) {
                                            debugLog("## Multi reply to delete a registration " + replies, LOG_ALL);
                                            response.writeHead(204); response.end();
                                            logStateOfMappings(instanceID, token);
                                        });

                                        // now remove any messages on queue that belong to this app, which is now deregistered
                                        debugLog('## About to remove messages from the queue which belong to deleted token', LOG_ALL);
                                        client.zrange('col:' + instanceID, 0, -1, function(err, reply) {
                                            for (var i = reply.length-1; i>=0; i--) {
                                                value = reply[i].split(':');
                                                // if this element belongs to the app being deregistered, then delete this
                                                // element and its corresponding element in the que list
                                                // need to remove elements starting at the top, so that indices of lower
                                                // elements are not affected
                                                if (value[1]==appname) {
                                                    debugLog('## About to remove element ' + i + ' from queue', LOG_ALL);
                                                    var multi = client.multi();
                                                    multi.zremrangebyrank('col:' + instanceID, i, i);
                                                    multi.zremrangebyrank('que:' + instanceID, i, i);
                                                    multi.exec(function (err, replies) {
                                                        debugLog("## Multi reply to delete a message from message queue " + replies, LOG_ALL);
                                                    });
                                                }
                                            }
                                        });

                                        // END ATOMIC
                                        debugLog('## Removed registration:' + regString, LOG_ALL);
                                    }
                                }
                            }
                            else {
                                if (method=='GET' || method=='DELETE') {
                                    debugLog('InstanceID-appname registration not found', LOG_ALL);
                                    debugLog('instanceID ' + instanceID + ' appname ' + appname, LOG_ALL);
                                    response.writeHead(404);
                                    response.end();
                                }
                                else {
                                    // this is a create registration operation
                                    debugLog('## InstanceID-appname registration not found - generating new token', LOG_ALL);
                                    debugLog('## instanceID ' + instanceID + ' appname ' + appname, LOG_ALL);
                                    var token = generateToken(appname);
                                    // create message counter for this instance and token->instanceID map
                                    // ATOMIC operation
                                    var multi = client.multi();
                                    multi.set('cnt:' + instanceID, 0);
                                    multi.sadd('reg:' + instanceID, JSON.stringify({ token: token, appname: appname }));
                                    multi.set('tok:' + token, instanceID);

                                    multi.expire('cnt:' + instanceID, expirationInterval);
                                    multi.expire('reg:' + instanceID, expirationInterval);
                                    multi.expire('tok:' + token, expirationInterval);
                                    multi.exec(function (err, replies) {
                                        debugLog("## Multi reply to create a registration " + replies, LOG_ALL);
                                        responseObject[instanceID] = null;
                                        timerHandle[instanceID] = null;

                                        debugLog('## Created registration for instanceID ' + instanceID + ' and token ' + token, LOG_ALL);
                                        response.writeHead(201, {'Content-Type': 'application/json'});
                                        response.end(JSON.stringify({ token: token }), 'utf8');
                                        logStateOfMappings(instanceID, token);
                                    });
                                    // END ATOMIC
                                }
                            }
                        });
                    }
                    else {
                        debugLog('Username in url does not match username in authentication credentials', LOG_ERR);
                        debugLog('URL username ' + username + ' Auth username ' + getNameFromCredentials(request), LOG_ERR);
                        response.writeHead(401);
                        response.end();
                    }
                }
                else {
                    debugLog('Invalid authentication credentials', LOG_ERR);
                    debugLog('Credentials ' + request.headers.authorization, LOG_ERR);
                    response.writeHead(401);
                    response.end();
                   }
            });
        }
    );
    authReq.on('error', function() {
        debugLog('User authorization sever unavailable', LOG_ERR);
        response.writeHead(503);
        response.end();
    });

    authReq.end();
    return 1;
}


/////////////////////////
// Get next message from the queue, delay response if one is not present
/////////////////////////
function handleNextMessage(request, response) {
    debugLog('## handleNextMessage header(s): ' + JSON.stringify(request.headers), LOG_OPS);

    var UrlObject = new Object();

    // check to see if cookie corresponds to instanceID and url is well-formed
    if (!getUrlFieldsCookieAndCheck(request, UrlObject, 2, true, response))
        return 0;

    var instanceID = UrlObject.fields[2];
    var lastMessageIDValue = UrlObject.query;

    // check for the existance of this instance
    client.exists('reg:' + instanceID, function(err, reply1) {
        if (reply1==1) {
            // this instance has at least one app registered with it
            debugLog('## Remove messages from queue with messageID<=' + lastMessageIDValue, LOG_ALL);
            // remove entries from queue with messageID's <= lastMessageIDValue
            // ATOMIC operation
            var multi = client.multi();
            multi.zremrangebyscore('que:' + instanceID, 0, lastMessageIDValue);
            multi.zremrangebyscore('col:' + instanceID, 0, lastMessageIDValue);
            multi.exec(function (err, replies) {
                debugLog("## Multi reply to remove received messages from queue " + replies, LOG_ALL);
            });
            // END ATOMIC

            logStateOfQueue(instanceID);
            // get the message on the bottom of the queue, i.e. index 0
            // zrange returns a list of message object(strings)
            client.zrange('que:' + instanceID, 0, 0, function(err, reply2) {
                var reply2String = reply2[0];

                if (reply2String!=undefined) {
                    // queue is not empty
                    // respond to requester (client) with messageID, token, and message
                    debugLog('## CLIENT RESPONDED TO WITH MESSAGE ' + reply2String, LOG_ALL);
                    response.writeHead(200, {'Content-Type': 'application/json'});
                    response.end(reply2String, 'utf8');
                }
                else {
                    // queue is empty, so store response object
                    responseObject[instanceID] = response;
                    debugLog('## Queue is empty, so storing response object for later retrieval by client', LOG_ALL);
                    debugLog('## RESPONSE OBJECT: ' + responseObject[instanceID], LOG_ALL);
            // start timer so that ANS server responds before HTTP/TCP link is torn down
            // due to inactivity. Client will have to send new request for data
            // if a timer already exists for this response object, clear it and restart
                    if (configParsed.ansResponseTimeout) {
                if (timerHandle[instanceID]!=null)
                clearTimeout(timerHandle[instanceID]);

                        timerHandle[instanceID] = setTimeout(handleTimer, configParsed.ansResponseTimeout, instanceID);
                    }
                }

                // update expiration of token -> instanceID mapping for this token (app server)
                // as well as all client-related queue info for the instanceID associated with this token
                // ATOMIC operation
                var multi2 = client.multi();
                multi2.expire('cnt:' + instanceID, expirationInterval);
                multi2.expire('reg:' + instanceID, expirationInterval);
                multi2.expire('col:' + instanceID, expirationInterval);
                multi2.expire('que:' + instanceID, expirationInterval);
                multi2.smembers('reg:' + instanceID, function(err, reply) {
                    var tokApp;

                    for (var i=0, lim = reply.length; i<lim; i++) {
                        tokApp = JSON.parse(reply[i]);
                        client.expire('tok:' + tokApp.token, expirationInterval);
                    }
                });
                multi2.exec(function (err, replies) {
                    debugLog("## Multi reply to update expire times " + replies, LOG_ALL);
                });
                // END ATOMIC
            });
        }
        else {
            debugLog('InstanceID registration not found', LOG_ERR);
            debugLog('InstanceID ' + instanceID, LOG_ERR);
            response.writeHead(404);
            response.end();
        }
    });

    return 1;
}


/////////////////////////
// Put a message from app server onto the queue, issue delayed response, if a prior
// request is waiting. Must authenticate app credentials and make sure appname in
// credentials can be used to regenerate token supplied in url.
/////////////////////////
function handleMessageQueue(request, reqMsg, response) {
    debugLog('## handleMessageQueue header(s): ' + JSON.stringify(request.headers), LOG_OPS);
    var messageSchema = { 'collapseId?': 1, data: {} };

    var count;
    var instanceID;
    var collapseID;

    // check request message to ensure it is in JSON format and has the expected fields
    try {
        var parsedReqMsg = JSON.parse(reqMsg);
    }
    catch (e) {
        response.writeHead(400); response.end();
        return;
    }

    var valid = validator.validate(messageSchema, parsedReqMsg);
    debugLog('## message from app server ' + util.inspect(parsedReqMsg), LOG_ALL);

    if(!valid[0]) {
        debugLog('Invalid messageQueue message: ' + valid[1], LOG_ERR);
        response.writeHead(400); response.end();
        return 0;
    }

    var UrlObject = new Object();

    // check to see if cookie corresponds to instanceID and url is well-formed
    if (!getUrlFieldsCookieAndCheck(request, UrlObject, 2, false, response))
        return 0;

    var token = UrlObject.fields[2];
    var msgCollapseID = parsedReqMsg.collapseId;
    var msgData = parsedReqMsg.data;

    // set msgCollapseID = -2 when none specified, so it won't match the collapseID of
    // any messages stored on the collapseID queue, even one's that have none (they are
    // assigned a collapseID of -1
    if (msgCollapseID==undefined || msgCollapseID<0)
        msgCollapseID==-2;

    // get the credentials from the authorization field of the request header.
    // cache these credentials for a limited time
    // if they already exist in the cache, then assume app is authorized without
    // going to the auth server
    if (request.headers.authorization==undefined)
        var credentialsStripped = '';
    else {
        var encoding = request.headers.authorization.split(' ')[0];
        var credentialsStripped = request.headers.authorization.split(' ')[1];
    }

    if (credentialsStripped!=undefined && credentialsStripped!='' && encoding=='Basic') {
        var timeStamp = authCredentialCache[credentialsStripped];
        var currentTime = new Date().getTime();

        if (timeStamp!=undefined && timeStamp>(currentTime - configParsed.authCredentialLifetime) && configParsed.authCredentialCacheEnabled=='y') {
            // credentials exist in credential cache and are still valid, ie. not too old, update them
            debugLog("## CACHE - credentials valid", LOG_ALL);
            addMessageToQueue(request, response, token, instanceID, msgCollapseID, msgData);
            authCredentialCache[credentialsStripped] = currentTime;
            logCredCache();
        }
        else {
            // either credentials don't exist in cache or are too old, either way they need to be
            // authenticated
            var options = appAuthOptions;
            options.headers.authorization = request.headers.authorization;

            // authenticate app credentials supplied in header
            var authReq = configParsed.protocol.request(options,
                function(authRes) {
                    authRes.on('data', function (chunk) {
                        debugLog('## appAuth received: ' + chunk);
                    });
                    authRes.setEncoding('utf8');
                    authRes.on('end', function() {
                        if (authRes.statusCode==204) {
                            // credentials authenticated
                            addMessageToQueue(request, response, token, instanceID, msgCollapseID, msgData);

                            if (configParsed.authCredentialCacheEnabled=='y') {
                                if (timeStamp!=undefined) {
                                    // credential exists in cache, so just update it
                                    debugLog("## CACHE - updating existing credential after reauthorization", LOG_ALL);
                                    authCredentialCache[credentialsStripped] = currentTime;
                                }
                                else {
                                    // credential is new, so add to cache
                                    if (authCredentialCacheLength >= configParsed.authCredentialCacheSize) {
                                        // cache full, need to delete an existing entry - delete oldest ***
                                        debugLog("## CACHE - credentials new - delete oldest", LOG_ALL);
                                        var oldestTime = currentTime;
                                        var oldestCredential = '';

                                        for (var i in authCredentialCache) {
                                            if (authCredentialCache[i]<oldestTime) {
                                                oldestTime = authCredentialCache[i];
                                                oldestCredential = i;
                                            }
                                        };

                                        debugLog("## CACHE - deleting oldest credential " + oldestCredential);
                                        delete authCredentialCache[oldestCredential];
                                        authCredentialCacheLength--;
                                    }

                                    // add credentials to cache
                                    debugLog("## CACHE - adding authenticated credential", LOG_ALL);
                                    authCredentialCache[credentialsStripped] = currentTime;
                                    authCredentialCacheLength++;
                                }

                                logCredCache();
                            }
                        }
                        else {
                            debugLog('Invalid authentication credentials ', LOG_ERR);
                            debugLog('Credentials ' + request.headers.authorization, LOG_ERR);
                            response.writeHead(401); response.end();
                        }
                    });
                }
            );

            authReq.on('error', function() {
                debugLog('App authorization sever unavailable', LOG_ERR);
                response.writeHead(503);
                response.end();
            });

            authReq.end();
            return 1;
        }
    }
    else {
        debugLog('Invalid authentication credentials ', LOG_ERR);
        debugLog('Credentials ' + request.headers.authorization, LOG_ERR);
        response.writeHead(401); response.end();
    }
}

//////////////////////
// add a message to the queue for this token
//////////////////////
function addMessageToQueue(request, response, token, instanceID, msgCollapseID, msgData) {
    var appname = getNameFromCredentials(request);

    // verify token belongs to app
    if (verifyToken(token, appname)) {
        // get instanceID associated with this token
        client.get('tok:' + token, function(err, instanceID) {
            if (instanceID!=null) {
                debugLog('## About to add message to queue with token: ' + token + ' and instanceID ' + instanceID, LOG_ALL);
                // app server specified a collapseID, so collapse messages
                // find the score (msgID) of the message on the queue with the same collapseID
                // if a message exists on the queue with the same collapseID, replace it
                // zscore returns a string
                client.zscore('col:' + instanceID, msgCollapseID + ':' + appname, function(err, msgID) {
                    if (msgID!=null) {
                    // message with this collapseID already exists on queue, so replace
                    // it with the new message. Message count will not be changed.
                    debugLog('## A message DOES exist on queue with collapseID ' + msgCollapseID, LOG_ALL);
                    debugLog('## Remove existing message, add new message', LOG_ALL);
                    // ATOMIC operation
                    var multi = client.multi();
                    multi.zremrangebyscore('que:' + instanceID, Number(msgID), Number(msgID));
                    var messageTextString = JSON.stringify({ id: Number(msgID), token: token, data: msgData });
                    debugLog('## Message added to queue ' + messageTextString, LOG_ALL);
                    multi.zadd('que:' + instanceID, Number(msgID), messageTextString);
                    multi.exec(function (err, replies) {
                        debugLog("## Multi reply to collapse msgs " + replies, LOG_ALL);
                    });
                    // END ATOMIC
                    logStateOfQueue(instanceID);

                    debugLog('## Message successfully enqueued for later delivery', LOG_ALL);
                    response.writeHead(204);
                    response.end();
                }
                else {
                    debugLog('## A message DOES NOT exist on queue with collapseID ' + msgCollapseID, LOG_ALL);
                    // no message exists on queue with the same collapseID, so update
                    // message count, add message to the message queue, and add an entry
                    // to the collapseID queue
                    client.incr('cnt:' + instanceID, function(err, msgIDcnt) {
                        if (msgCollapseID==-2)
                            msgcollapseID = -1;

                            var messageTextString = JSON.stringify({ id: msgIDcnt, token: token, data: msgData });

                            // add message to queue and add entry in collapseID queue
                            debugLog('## Add message to queue, add collapseID to queue', LOG_ALL);
                            debugLog('## Message added to queue ' + messageTextString, LOG_ALL);
                            // ATOMIC operation
                            var multi = client.multi();
                            multi.zadd('que:' + instanceID, msgIDcnt, messageTextString);
                            multi.zadd('col:' + instanceID, msgIDcnt, msgCollapseID + ':' + appname);
                            multi.exec(function (err, replies) {
                                // if responseObject is non-null then send this message to
                                // the client and clear the timer
                                if (responseObject[instanceID]!=null) {
                                    logStateOfQueue(instanceID);

                                    debugLog('## Client responded to with message ' + messageTextString, LOG_ALL);
                                    responseObject[instanceID].writeHead(200, {'Content-Type': 'application/json'});
                                    responseObject[instanceID].end(messageTextString, 'utf8');
                                    responseObject[instanceID] = null;

                                    if (timerHandle[instanceID]!=null)
                                        clearTimeout(timerHandle[instanceID]);

                                    timerHandle[instanceID] = null;
                                }

                                debugLog("## Multi reply to add msg to queue " + replies, LOG_ALL);
                            });
                            // END ATOMIC
                            debugLog('## Message successfully enqueued for later delivery', LOG_ALL);
                            response.writeHead(204);
                            response.end();
                        });
                    }
                });

                // update expiration of token -> instanceID mapping for this token (app server)
                // as well as all client-related queue info for the instanceID associated with this token
                // ATOMIC operation
                multi = client.multi();
                multi.expire('cnt:' + instanceID, expirationInterval);
                multi.expire('reg:' + instanceID, expirationInterval);
                multi.expire('col:' + instanceID, expirationInterval);
                multi.expire('que:' + instanceID, expirationInterval);
                multi.expire('tok:' + token, expirationInterval);
                multi.exec(function (err, replies) {
                    debugLog("## Multi reply to update expire times " + replies, LOG_ALL);
                });
                // END ATOMIC
            }
            else {
                debugLog('No registration for specified token', LOG_ERR);
                debugLog('Token ' + token, LOG_ERR);
                response.writeHead(404); response.end();
            }
        });
    }
    else {
        debugLog('Token was not generated using appname', LOG_ERR);
        debugLog('Token ' + token + ' appname ' + appname, LOG_ERR);
        response.writeHead(401); response.end();
    }
}
//////////////////////
// Invalidate response object and tell client that there is no message
//////////////////////
function handleTimer(instanceID) {
    var ro = responseObject[instanceID];

    if (ro!=null) {
    console.log('Connection timer has fired. Wait for next message was too long');
        console.log('    instanceID: ' + instanceID);
        ro.writeHead(204);
        ro.end();
        ro = null;
    }
}



//////////////////////
// instance ID, cookie, message ID, and token generation/retrieval functions
//////////////////////
// Generate a unique instance ID.
// Always assume username is defined.
function generateInstanceID(username) {

    var uuid = nodeUuid.v4();
    var hashed = crypto.createHash('md5').update(username + uuid + 'instanceSecret').digest('hex');
    debugLog('## Generated instanceID for ' + username + ' = ' + uuid + ':' + hashed, LOG_ALL);
    return(uuid + ':' + hashed);
}


// Verify that username can be used to generate instanceID
function verifyInstanceID(instanceID, username) {

    if (instanceID==undefined || username==undefined)
        return 0;

    var uuid = instanceID.split(':')[0];
    var hashed = crypto.createHash('md5').update(username + uuid + 'instanceSecret').digest('hex');
    var generatedInstanceID = uuid + ':' + hashed;

    if (generatedInstanceID==instanceID)
        return 1;
    else
        return 0;
}


// Generate cookie.
// Always assume instanceID is defined.
function generateCookie(instanceID) {

    var uuid = nodeUuid.v4();
    var hashed = crypto.createHash('md5').update(instanceID + uuid + 'cookieSecret').digest('hex');

    debugLog('## Generated cookie for ' + instanceID + ' = ' + uuid + ':' + hashed, LOG_ALL);
    return(uuid + ':' + hashed);
}


// Verify that instanceID can be used to create cookie.
function verifyCookie(cookie, instanceID) {

    if (cookie==undefined || instanceID==undefined)
        return 0;

    var uuid = cookie.split(':')[0];
    var hashed = crypto.createHash('md5').update(instanceID + uuid + 'cookieSecret').digest('hex');
    var generatedCookie = uuid + ':' + hashed;

    if (generatedCookie==cookie)
        return 1;
    else
        return 0;
}


// Generate token from app name.
// Always assume appname is defined.
function generateToken(appname) {

    var uuid = nodeUuid.v4();
    var hashed = crypto.createHash('md5').update(appname + uuid + 'tokenSecret').digest('hex');
    debugLog('## Generated token for ' + appname + ' = ' + uuid + ':' + hashed, LOG_ALL);
    return(uuid + ':' + hashed);
}


// Verify that token can be generated from appname.
function verifyToken(token, appname) {

    if (token==undefined || appname==undefined)
        return 0;

    var uuid = token.split(':')[0];
    var hashed = crypto.createHash('md5').update(appname + uuid + 'tokenSecret').digest('hex');
    var generatedToken = uuid + ':' + hashed;

    if (generatedToken==token)
        return 1;
    else
        return 0;
}


// Get fields (strings between /'s in url) up to fieldsToGet index from url and cookie from
// header. Ensure they are well-formed.
function getUrlFieldsCookieAndCheck(request, urlFields, fieldsToGet, checkCookie, response) {
    // extract instanceID from request url
    var parsedUrl = require('url').parse(request.url, true);
    urlFields.fields = parsedUrl.pathname.split('/');
    var query = Number(parsedUrl.query.lastMessage);
    urlFields.query = query;

    // if the highest numbered field is defined, then all fields are defined. if not, then trouble
    // if more fields are defined than "fieldsToGet", then this is also trouble
    if (urlFields.fields.length!=(fieldsToGet+1) || urlFields.fields[fieldsToGet]=='') {
        debugLog('Malformed url', LOG_ERR);
        response.writeHead(403);
        response.end();
        return 0;
    }

    if (isNaN(query) || query<0) {
        urlFields.query = 0;
    }

    // extract cookie from header, if cookie exists
    if (request.headers.cookie!=undefined)
        var cookieField = request.headers.cookie.match(/instance=[a-z|A-Z|0-9|\-|:]+/i);
    else
        var cookieField = null;

    if (cookieField!=null) {
        var cookie = cookieField.toString().split('=')[1];
        // remove the ANS-specific cookie, leaving only non-ANS-specific cookies
        request.headers.cookie.replace(/instance=[a-z|A-Z|0-9|\-|:]+;{0,1};/i, '');
    }

    // check the cookie
    if (checkCookie) {
        var instanceID = urlFields.fields[2];

        if (cookieField==null || cookie==undefined || !verifyCookie(cookie, instanceID)) {
            debugLog('Invalid authentication credentials - cookie not generated from instanceID', LOG_ERR);
            response.writeHead(401); response.end();
            return 0;
        }
    }

    return 1;
}

// get name from the authorization credentials in the http header
function getNameFromCredentials(request) {

    if (request.headers.authorization==undefined)
        var credentialsStripped = '';
    else {
        var encoding = request.headers.authorization.split(' ')[0];
        var credentialsStripped = request.headers.authorization.split(' ')[1];
    }

    if (credentialsStripped!=undefined && credentialsStripped!='' && encoding=='Basic') {
        var credentials = new Buffer(credentialsStripped, 'base64');
        debugLog('## Decoded credentials ' + credentials, LOG_ALL);
        var credName = credentials.toString('utf8').split(':')[0];
    }
    else
        var credName = '';

    return credName;
}


// log state of message queue
function logStateOfQueue(instanceID) {
    client.zrange('que:' + instanceID, 0, -1,'WITHSCORES', function(err, reply) {
        debugLog('\n## STATE OF MESSAGE QUEUE ' + instanceID, LOG_ALL);
        debugLog('## MessageID / Message ', LOG_ALL);
        for (var i = 0, lim = reply.length; i<lim; i += 2) {
            debugLog('## ' + reply[i+1] + '\t     ' + reply[i], LOG_ALL);
        }

        client.zrange('col:' + instanceID, 0, -1,'WITHSCORES', function(err, reply) {
            debugLog('\n## STATE OF COLLAPSE ID QUEUE ' + instanceID, LOG_ALL);
            debugLog('## MessageID / CollapseID ', LOG_ALL);
            for (var i = 0, lim = reply.length; i<lim; i += 2) {
                debugLog('## ' + reply[i+1] + '\t     ' + reply[i], LOG_ALL);
            }
        });
    });
}

// log state of token->instanceID and instanceID->token:appname mappings
function logStateOfMappings(instanceID, token) {
    client.get('tok:' + token, function(err, reply) {
        debugLog('\n## STATE OF TOKEN->INSTANCEID mapping ' + instanceID, LOG_ALL);
        debugLog('## Token / InstanceID', LOG_ALL);
        debugLog('## ' + token + '\t' + reply, LOG_ALL);

        client.smembers('reg:' + instanceID, function(err, reply) {
            debugLog('\n## STATE OF INSTANCEID->TOKEN:APPNAME mapping ' + instanceID, LOG_ALL);
            debugLog('## InstanceID \t\t\t\t\t\t\t\tTOKEN:APPNAME', LOG_ALL);
            for (var i = 0, lim = reply.length; i<lim; i++) {
                debugLog('## ' + instanceID + '   ' + reply[i], LOG_ALL);
            }
        });
    });
}

// log state of credential cache and queue
function logCredCache() {
    var decodedCredentials;

    debugLog("## CREDENTIAL CACHE: ", LOG_ALL);
    for (var i in authCredentialCache) {
        decodedCredentials = new Buffer(i, 'base64').toString('utf8');
        debugLog("## " + decodedCredentials + " " + authCredentialCache[i], LOG_ALL);
    }
}

// modify agent so it hangs on to sockets for awhile before releasing them
// sockets[] - list of sockets in use by this agent
// freeSocketQueue[] - list of sockets which are available for use to fulfill an http request, and will
//   be removed after 10s
// requests[] - list of outstanding http requests waiting for a socket to be free
function enhancedKeepAliveReuse(agent) {
    // Make sure freeSocketQueue does not exist as a field of agent
    assert.ok(!agent.freeSocketQueue);
    agent.freeSocketQueue = [];
    // Remove old listener on free
    agent.removeAllListeners('free');

    //agent.on('free', function(socket, host, port) {
    agent.on('free', function(socket, options) {
        var name = '';
	if (typeof options === 'string') {
		host = options;
		port = arguments[2];
        	name = host + ':' + port;
	}
	else 
		name = this.getName(options);
//        debugLog('==== FREE for agent ' + util.inspect(this, false, null, true), LOG_ALL);
        if (this.requests[name] && this.requests[name].length) {
//            debugLog('==== There is an outstanding request for a socket, use this freed socket to fulfill it', LOG_ALL);
//            debugLog('==== Free socket to be used - name: ' + name, LOG_ALL);
            this.requests[name].shift().onSocket(socket);
        } else {
            // save the socket for at least a little while
            var socketDescriptorObject = { socket: socket };
//            debugLog('==== Add socket to free list and schedule for removal - name: ' + name, LOG_ALL);
            socketDescriptorObject.timeoutId = setTimeout(function(sdo, agt) {
                 var idx = agt.freeSocketQueue[name].indexOf(sdo);
                // Remove socketDescriptorObject from free_socket list
//                debugLog('==== Step 2 - Timer fired so remove socket from free list - name: ' + name, LOG_ERR);
                agt.freeSocketQueue[name].splice(idx, 1);
                socket.destroy();
            }, 10000, socketDescriptorObject, agent);
            if (!this.freeSocketQueue[name]) {
                this.freeSocketQueue[name] = [];
            }
//            debugLog('==== Step 1 - Add socket to free list', LOG_ALL);
            this.freeSocketQueue[name].push(socketDescriptorObject);
        }
//        debugLog('==== Updated agent ' + util.inspect(this, false, null, true), LOG_ALL);
    });

    agent.addRequest = function(req, options) {
        var name = '';
	var oldNode = false;
	if (typeof options === 'string') {
        	name = options + ':' + arguments[2];
		options = {
		host: options,
		port: arguments[2],
		path: arguments[3] 
		};
		oldNode = true;
	}
	else 
		name = this.getName(options);

//        debugLog('==== ADDREQUEST for agent ' + util.inspect(this, false, null, true), LOG_ALL);
        if (this.freeSocketQueue[name] && this.freeSocketQueue[name].length) {
//            debugLog('==== Has a free socket so use it to satisfy the request', LOG_ALL);
            // Has a free socket, use it
            var socketDescriptorObject = this.freeSocketQueue[name].shift();
            clearTimeout(socketDescriptorObject.timeoutId);
            req.onSocket(socketDescriptorObject.socket);
        } else {
//            debugLog('==== No free socket', LOG_ALL);
            if (!this.sockets[name])
                this.sockets[name] = [];

            if (this.sockets[name].length < this.maxSockets) {
//                debugLog('==== Under max sockets so we satisfy request by creating a new one', LOG_ALL);
                // If we are under maxSockets create a new one.
		if (oldNode)
                	req.onSocket(this.createSocket(name, options.host, options.port));
		else {
                	req.onSocket(this.createSocket(req, options));
			}
            } else {
//                debugLog('==== Over max socket so we add request to the queue', LOG_ALL);
                // We are over limit so we'll add it to the queue.
                if (!this.requests[name]) {
//                    debugLog('What is this? ' + util.inspect(this), LOG_ALL);
                    this.requests[name] = [];
                }
                this.requests[name].push(req);
            }
        }
//        debugLog('==== Updated agent: ' + util.inspect(this, false, null, true), LOG_ALL);
    };
}


function debugLog(message, level) {
    if (level<=configParsed.debugLevel)
        console.log(message);
}




