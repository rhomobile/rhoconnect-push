assert              = require 'assert'
ans2server          = require '../vendor/ans2server'
exports.request     = require 'supertest'
exports.redis       = require('redis').createClient()
exports.nodeUuid    = require 'node-uuid'
exports.crypto      = require 'crypto'

exports.pushOptions =
  httpSecure:                 'n'
  appAuthHost:                'localhost'
  appAuthPort:                '8677'
  appAuthUrl:                 '/auth'
  userAuthHost:               'localhost'
  userAuthPort:               '8677'
  userAuthUrl:                '/auth'
  devAuthHost:                'localhost'
  devAuthPort:                '8677'
  devAuthUrl:                 '/auth'
  ansResponseTimeout:         '300000'
  ansServerHost:              'localhost'
  ansServerPort:              '8676'
  registrationTimeout:        '2592000'
  debugLevel:                 '-1'
  numClients:                 '3'
  clearDataBase:              'y'
  socketPoolSize:             '5'
  authCredentialCacheEnabled: 'n'
  authCredentialCacheSize:    '10'
  authCredentialLifetime:     '60000'
  redisToGoUrl:               process.env.REDISTOGO_URL || process.env.REDIS || 'redis://localhost:6379'

exports.instanceId        = null
exports.instanceCookie    = null
exports.registrationToken = null
exports.authCookie        = 'auth=authcookie:authcookie'
exports.goodAuth          = 'Basic ' + new Buffer('usermike:usermikepwd').toString 'base64'
exports.badAuth           = 'Basic ' + new Buffer('baduser:baduserpwd').toString 'base64'
exports.serverAuth        = 'Basic ' + new Buffer('app1mike:app1mikepwd').toString 'base64'
exports.clientHeaders     =
  'Cookie': exports.authCookie
  'Content-Type': 'application/json'
  'Authorization': exports.goodAuth
exports.serverHeaders     =
  'Content-Type': 'application/json'
  'Authorization': exports.serverAuth
exports.message           =
  'collapseid': 1
  'data':
    'message': 'Here is message 1'
    'count': 1

exports.testServer = ->
  http = require 'http'
  url = require 'url'
  server = http.createServer (req, res) ->
    status = null
    cookie = req.headers['cookie']
    auth = req.headers['authorization']
    status = if cookie and cookie.match(exports.authCookie) then 204 else 401

    if auth and auth.match(exports.goodAuth) or auth.match(exports.serverAuth)
      status = 204

    res.writeHead status, 'Content-Type': 'text/plain'
    res.end ''

  server.listen exports.pushOptions.appAuthPort
  server

exports.shouldBehaveLikeAPushTest = ->

  before (done) ->
    @url = 'http://localhost:8676'
    @pushServer = ans2server.startServer exports.pushOptions
    @pushServer.on 'listening', -> done()

  after (done) ->
    @pushServer.close()
    done()

  afterEach (done) ->
    exports.redis.flushdb()
    done()

exports.getInstanceId = (url, done) ->
  exports.request(url)
    .post('/instanceId')
    .set(exports.clientHeaders)
    .end (err, res) ->
      exports.instanceId = JSON.parse(res.text)['instance']
      done()

exports.getInstanceCookie = (url, done) ->
  exports.request(url)
    .get('/instanceId/' + exports.instanceId)
    .set(exports.clientHeaders)
    .end (err, res) ->
      exports.instanceCookie = res.headers['set-cookie'][0]
      done()

exports.getRegistration = () ->
  uuid = exports.nodeUuid.v4()
  hashed = exports.crypto
    .createHash('md5')
    .update('app1mike' + uuid + 'tokenSecret')
    .digest('hex')
  exports.registrationToken = uuid + ':' + hashed
  multi = exports.redis.multi()
  multi
    .sadd "reg:#{exports.instanceId}"
  , JSON.stringify({token: exports.registrationToken, appname: 'app1mike'})
  multi
    .set "tok:#{exports.registrationToken}", exports.instanceId
  multi.exec()

exports.addMessage = (url) ->
  exports.request(url)
    .post('/messageQueue/' + exports.registrationToken)
    .set(exports.serverHeaders)
    .send(JSON.stringify(exports.message))
    .end (err, res) ->
