shared      = require './shared'
request     = shared.request
superagent  = require 'superagent'
redis       = shared.redis

describe 'RhoConnect Push Client', ->

  shared.shouldBehaveLikeAPushTest()

  before (done) ->
    @badCookie = 'auth=baduser:baduserpwd'
    @authServer = shared.testServer()
    @authServer.on 'listening', -> done()

  after (done) ->
    @authServer.close()
    done()

  describe 'nextMessage', ->

    before (done) ->
      shared.getInstanceId(@url, done)

    beforeEach (done) ->
      shared.getInstanceCookie(@url, done)

    it 'should get a message (GET)', (done) ->
      shared.getRegistration()
      shared.addMessage(@url)
      expected = {
        id: 1
        token: shared.registrationToken
        data: shared.message.data
      }
      request(@url)
        .get('/nextMessage/' + shared.instanceId)
        .set('Cookie', shared.instanceCookie)
        .expect 200, expected, done

    it 'should close nextMessage on delete registration (DELETE)', (done) ->
      shared.getRegistration()
      request(@url)
        .get('/nextMessage/' + shared.instanceId)
        .set('Cookie', shared.instanceCookie)
        .expect 410, done   
      request(@url)
        .del('/registrations/' + shared.instanceId + '/usermike/app1mike')
        .set('cookie', "#{shared.instanceCookie}; #{shared.authCookie}")
        .set('authorization', shared.goodAuth)
        .end (err, res) ->   

  describe 'nextMessage errors', ->

    before (done) ->
      shared.getInstanceId(@url, done)

    beforeEach (done) ->
      shared.getInstanceCookie(@url, done)

    it 'should receive error with no auth provided (PUT)', (done) ->
      request(@url)
        .put('/nextMessage/')
        .expect(403, done)

    it 'should receive error with no auth provided (DELETE)', (done) ->
      request(@url)
        .del('/nextMessage/')
        .expect(403, done)

    it 'should receive error with no auth provided (POST)', (done) ->
      request(@url)
        .post('/nextMessage/')
        .expect(403, done)

    it 'should receive error with no auth provided (GET)', (done) ->
      request(@url)
        .get('/nextMessage/')
        .set('cookie', shared.instanceCookie)
        .expect(403, done)

    it 'should receive error with malformed url, not enough fields (GET)', (done) ->
      request(@url)
        .get('/nextMessage/')
        .set('cookie', shared.instanceCookie)
        .expect(403, done)

    it 'should receive error with malformed url, too many fields (GET)', (done) ->
      request(@url)
        .get('/nextMessage/' + shared.instanceId + '/extrafield')
        .set('cookie', shared.instanceCookie)
        .set('authorization', '')
        .expect(403, done)

    it 'should receive error with empty cookie (GET)', (done) ->
      request(@url)
        .get('/nextMessage/' + shared.instanceId)
        .set('authorization', '')
        .expect(401, done)

    it 'should receive error with bad cookie (GET)', (done) ->
      request(@url)
        .get('/nextMessage/' + shared.instanceId)
        .set('cookie', @badCookie)
        .set('authorization', '')
        .expect(401, done)

    it 'should receive error with extra body in request (GET)', (done) ->
      request(@url)
        .get('/nextMessage/' + shared.instanceId)
        .set('cookie', shared.instanceCookie)
        .set('authorization', shared.goodAuth)
        .send(
          JSON.stringify
            text: 'Some useless message'
        ).expect(404, done)

    it 'should receive error with no token being registered (GET)', (done) ->
      request(@url)
        .get('/nextMessage/' + shared.instanceId + '?lastMessage=undefined')
        .set('cookie', "#{shared.instanceCookie}; #{shared.authCookie}")
        .set('authorization', shared.goodAuth)
        .expect(404, done)

  describe 'registrations', ->

    before (done) ->
      shared.getInstanceId(@url, done)

    beforeEach (done) ->
      shared.getInstanceCookie(@url, done)

    it 'should register application (PUT)', (done) ->
      request(@url)
        .put('/registrations/' + shared.instanceId + '/usermike/app1mike')
        .set('cookie', "#{shared.instanceCookie}; #{shared.authCookie}")
        .set('authorization', shared.goodAuth)
        .expect(201, done)

    it 'should delete registration (DELETE)', (done) ->
      shared.getRegistration()
      request(@url)
        .del('/registrations/' + shared.instanceId + '/usermike/app1mike')
        .set('cookie', "#{shared.instanceCookie}; #{shared.authCookie}")
        .set('authorization', shared.goodAuth)
        .expect(204, done)

    it 'should not get a token without a cookie (GET)', (done) ->
      request(@url)
        .get('/registrations/' + shared.instanceId + '/usermike/app1mike')
        .set('cookie', '')
        .set('authorization', shared.goodAuth)
        .expect(401, done)

    it 'should not register without a cookie (PUT)', (done) ->
      request(@url)
        .put('/registrations/' + shared.instanceId + '/usermike/app1mike')
        .set('cookie', '')
        .set('authorization', shared.goodAuth)
        .expect(401, done)

    it 'should not delete without a cookie (DELETE)', (done) ->
      request(@url)
        .del('/registrations/' + shared.instanceId + '/usermike/app1mike')
        .set('cookie', '')
        .set('authorization', shared.goodAuth)
        .expect(401, done)

    it 'should not get without a cookie (DELETE)', (done) ->
      request(@url)
        .get('/registrations/' + shared.instanceId + '/usermike/app1mike')
        .set('cookie', '')
        .set('authorization', shared.goodAuth)
        .expect(401, done)

    it 'should receive missing error when no tokens are registered (GET)', (done) ->
      request(@url)
        .get('/registrations/' + shared.instanceId + '/usermike/appmike')
        .set('cookie', "#{shared.instanceCookie}; #{shared.authCookie}")
        .set('authorization', shared.goodAuth)
        .expect(404, done)

    it 'should not delete an unregistered token', (done) ->
      request(@url)
        .del('/registrations/' + shared.instanceId + '/usermike/app1mike')
        .set('cookie', "#{shared.instanceCookie}; #{shared.authCookie}")
        .set('authorization', shared.goodAuth)
        .expect(404, done)

    it 'should get the registration token (GET)', (done) ->
      shared.getRegistration()
      request(@url)
        .get('/registrations/' + shared.instanceId + '/usermike/app1mike')
        .set('cookie', "#{shared.instanceCookie}; #{shared.authCookie}")
        .set('authorization', shared.goodAuth)
        .expect(200, {'token': shared.registrationToken}, done)

    it 'should delete the registration token (DELETE)', (done) ->
      shared.getRegistration()
      request(@url)
        .del('/registrations/' + shared.instanceId + '/usermike/app1mike')
        .set('cookie', "#{shared.instanceCookie}; #{shared.authCookie}")
        .set('authorization', shared.goodAuth)
        .expect(204, done)

  describe 'registrations errors', ->

    it 'should receive error with no auth provided (POST)', (done) ->
      request(@url)
        .post('/registrations/')
        .expect(403, done)

    it 'should receive malformed URL - not enough fields (GET)', (done) ->
      request(@url)
        .get('/registrations/')
        .expect(403, done)

    it 'should receive malformed URL - too many fields (GET)', (done) ->
      request(@url)
        .get('/registrations/')
        .set('path', '/registrations/faketoken/extrafield')
        .expect(403, done)

    it 'should receive error on missing authorization cookie (GET)', (done) ->
      request(@url)
        .get('/registrations/undefined/usermike/app1mike')
        .set('cookie', 'instance=')
        .expect(401, done)

    it 'should receive error on empty authorization cookie (GET)', (done) ->
      request(@url)
        .get('/registrations/undefined/usermike/app1mike')
        .expect(401, done)

    it 'should receive error on bad authorization cookie (GET)', (done) ->
      request(@url)
        .get('/registrations/undefined/usermike/app1mike')
        .set('cookie', 'instance=; ' + @badCookie)
        .expect(401, done)

    it 'should receive error on missing authorization cookie and authorization (GET)', (done) ->
      request(@url)
        .get('/registrations/undefined/usermike/app1mike')
        .set('cookie', 'instance=')
        .set('authorization', '')
        .expect(401, done)

    it 'should receive error on missing authorization cookie and bad authorization (GET)', (done) ->
      request(@url)
        .get('/registrations/undefined/usermike/app1mike')
        .set('cookie', 'instance=')
        .set('authorization', shared.badAuth)
        .expect(401, done)

    it 'should receive error on unused body (GET)', (done) ->
      request(@url)
        .get('/registrations/undefined/usermike/app1mike')
        .set(shared.clientHeaders)
        .send(
          JSON.stringify
            text: 'Some useless message'
        ).expect(401, done)

    it 'should receive error on missing cookie with authorization (GET)', (done) ->
      request(@url)
        .get('/registrations/undefined/usermike/app1mike')
        .set('authorization', shared.goodAuth)
        .expect(401, done)

    it 'should receive error for bad instance cookie (GET)', (done) ->
      request(@url)
        .get('/registrations/undefined/usermike/app1mike')
        .set('cookie', 'instance=badCookie:badCookie')
        .set('authorization', shared.goodAuth)
        .expect(401, done)

    it 'should receive error for bad username (GET)', (done) ->
      request(@url)
        .get('/registrations/undefined/badUser/app1mike')
        .set('cookie', 'instance=' + shared.authCookie)
        .set('authorization', shared.goodAuth)
        .expect(401, done)

    it 'should receive error on not enough fields (PUT)', (done) ->
      request(@url)
        .put('/registrations/')
        .set(shared.clientHeaders)
        .expect(403, done)

    it 'should receive error on too many fields (PUT)', (done) ->
      request(@url)
        .put('/registrations/undefined/usermike/app1mike/extrafield')
        .set(shared.clientHeaders)
        .expect(403, done)

    it 'should receive error on no authorization cookie (PUT)', (done) ->
      request(@url)
        .put('/registrations/undefined/usermike/app1mike')
        .set('cookie', 'instance=')
        .expect(401, done)

    it 'should receive error on empty authorization cookie (PUT)', (done) ->
      request(@url)
        .put('/registrations/undefined/usermike/app1mike')
        .set('cookie', 'instance=; auth=')
        .expect(401, done)

    it 'should receive error on bad authorization cookie (PUT)', (done) ->
      request(@url)
        .put('/registrations/undefined/usermike/app1mike')
        .set('cookie', 'instance=; ' + @badCookie)
        .expect(401, done)

    it 'should receive error on no authorization cookie and empty authorization (PUT)', (done) ->
      request(@url)
        .put('/registrations/undefined/usermike/app1mike')
        .set('cookie', 'instance=')
        .set('authorization', '')
        .expect(401, done)

    it 'should receive error on no authorization cookie and bad authorization (PUT)', (done) ->
      request(@url)
        .put('/registrations/undefined/usermike/app1mike')
        .set('cookie', 'instance=')
        .set('authorization', shared.badAuth)
        .expect(401, done)

    it 'should receive error on not enough fields (DELETE)', (done) ->
      request(@url)
        .del('/registrations/')
        .set(shared.clientHeaders)
        .expect(403, done)

    it 'should receive error on too many fields (DELETE)', (done) ->
      request(@url)
        .del('/registrations/undefined/usermike/app1mike/extrafield')
        .set(shared.clientHeaders)
        .expect(403, done)

    it 'should receive error on no authorization cookie (DELETE)', (done) ->
      request(@url)
        .del('/registrations/undefined/usermike/appmike')
        .set('cookie', 'instance=')
        .expect(401, done)

    it 'should receive error on empty authorization cookie (DELETE)', (done) ->
      request(@url)
        .del('/registrations/undefined/usermike/appmike')
        .set('cookie', 'instance=; auth=')
        .expect(401, done)

    it 'should receive error on bad authorization cookie (DELETE)', (done) ->
      request(@url)
        .del('/registrations/undefined/usermike/appmike')
        .set('cookie', "instance=; #{@badCookie}")
        .expect(401, done)

    it 'should receive error on no authorization cookie, no authorization (DELETE)', (done) ->
      request(@url)
        .del('/registrations/undefined/usermike/appmike')
        .set('cookie', 'instance=')
        .expect(401, done)

    it 'should receive error on no authorization cookie, empty authorization (DELETE)', (done) ->
      request(@url)
        .del('/registrations/undefined/usermike/appmike')
        .set('cookie', 'instance=')
        .set('authorization', '')
        .expect(401, done)

    it 'should receive error on no authorization cookie, bad authorization (DELETE)', (done) ->
      request(@url)
        .del('/registrations/undefined/usermike/appmike')
        .set('cookie', 'instance=')
        .set('authorization', shared.badAuth)
        .expect(401, done)

    it 'should receive error on empty cookie, good authorization (DELETE)', (done) ->
      request(@url)
        .del('/registrations/undefined/usermike/appmike')
        .set('cookie', '')
        .set('authorization', shared.goodAuth)
        .expect(401, done)

    it 'should receive error on bad cookie, good authorization (DELETE)', (done) ->
      request(@url)
        .del('/registrations/undefined/usermike/appmike')
        .set('cookie', @badCookie)
        .set('authorization', shared.goodAuth)
        .expect(401, done)

  describe 'instanceId', (done) ->

    it 'should request an instanceId (POST)', (done) ->
      request(@url)
        .post('/instanceId')
        .set(shared.clientHeaders)
        .expect(200, done)

    describe 'existing instanceId', (done) ->

      before (done) ->
        shared.getInstanceId(@url, done)

      beforeEach (done) ->
        shared.getInstanceCookie(@url, done)

      it 'should re-request an instanceId (POST)', (done) ->
        request(@url)
          .post('/instanceId')
          .set(shared.clientHeaders)
          .expect(200, done)

      it 'should re-request a cookie (GET)', (done) ->
        request(@url)
          .get('/instanceId/' + shared.instanceId)
          .set(shared.clientHeaders)
          .expect(204, done)

      it 'should create a cookie (GET)', (done) ->
        request(@url)
          .get('/instanceId/' + shared.instanceId)
          .set(shared.clientHeaders)
          .expect(204, done)

      it 'should not delete an unregistered instanceId without a cookie (DELETE)', (done) ->
        request(@url)
          .del('/instanceId/' + shared.instanceId)
          .set(shared.clientHeaders)
          .expect(404, done)

      it 'should not delete an unregistered instanceId (DELETE)', (done) ->
        request(@url)
          .del('/instanceId/' + shared.instanceId)
          .set(shared.clientHeaders)
          .set('authorization', shared.goodAuth)
          .expect(404, done)

      it 'should delete an unregistered instanceId (DELETE)', (done) ->
        shared.getRegistration()
        request(@url)
          .del('/instanceId/' + shared.instanceId)
          .set(shared.clientHeaders)
          .set('authorization', shared.goodAuth)
          .expect(204, done)

  describe 'instanceId errors', ->

    it 'should receive error with no auth provided (GET)', (done) ->
      request(@url)
        .get('/instanceId')
        .set(shared.clientHeaders)
        .expect(403, done)

    it 'should receive error with no auth provided (PUT)', (done) ->
      request(@url)
        .put('/instanceId')
        .set(shared.clientHeaders)
        .expect(403, done)

    it 'should receive error with no auth provided (DELETE)', (done) ->
      request(@url)
        .del('/instanceId')
        .expect(403, done)

    it 'should receive error with no auth provided (PUT)', (done) ->
      request(@url)
        .put('/instanceId/')
        .expect(403, done)

    it 'should receive error with no auth provided (POST)', (done) ->
      request(@url)
        .post('/instanceId/')
        .expect(403, done)

    it 'should recieve error - not enough fields (POST)', (done) ->
      request(@url)
        .post('/')
        .set('cookie', shared.authCookie)
        .expect(403, done)

    it 'should receive error with no authorization cookie (POST)', (done) ->
      request(@url)
        .post('/instanceId')
        .expect(401, done)

    it 'should receive error with empty auth cookie (POST)', (done) ->
      request(@url)
        .post('/instanceId')
        .set('cookie', 'auth=')
        .expect(401, done)

    it 'should receive error with bad auth cookie (POST)', (done) ->
      request(@url)
        .post('/instanceId')
        .set('cookie', @badCookie)
        .expect(401, done)

    it 'should return error on bad instanceId (POST)', (done) ->
      request(@url)
        .get('/instanceId/badInstanceID')
        .set(shared.clientHeaders)
        .expect(404, done)

    it 'should return error on not enough fields (POST)', (done) ->
      request(@url)
        .get('/instanceId/')
        .set(shared.clientHeaders)
        .expect(403, done)

    it 'should return error on too many fields (POST)', (done) ->
      request(@url)
        .get('/instanceId/undefined/extrafield')
        .set(shared.clientHeaders)
        .expect(403, done)

    it 'should return error on empty cookie (POST)', (done) ->
      request(@url)
        .get('/instanceId/undefined')
        .expect(401, done)

    it 'should return error on empty authorization cookie (GET)', (done) ->
      request(@url)
        .get('/instanceId/undefined')
        .set('cookie', 'auth=')
        .expect(401, done)

    it 'should return error on bad authorization cookie (GET)', (done) ->
      request(@url)
        .get('/instanceId/undefined')
        .set('cookie', @badCookie)
        .expect(401, done)

    it 'should return error on no authorization, no cookie (GET)', (done) ->
      request(@url)
        .get('/instanceId/undefined')
        .set('authorization', '')
        .expect(401, done)

    it 'should return error on bad authorization, no cookie (GET)', (done) ->
      request(@url)
        .get('/instanceId/undefined')
        .set('authorization', shared.badAuth)
        .expect(401, done)

    it 'should return error on not enough fields (DELETE)', (done) ->
      request(@url)
        .del('/instanceId/')
        .set(shared.clientHeaders)
        .expect(403, done)

    it 'should return error on too many fields (DELETE)', (done) ->
      request(@url)
        .del('/instanceId/undefined/extrafield')
        .set(shared.clientHeaders)
        .expect(403, done)

    it 'should return error no authorization or cookie (DELETE)', (done) ->
      request(@url)
        .del('/instanceId/undefined')
        .expect(401, done)

    it 'should return error bad authorization cookie (DELETE)', (done) ->
      request(@url)
        .del('/instanceId/undefined')
        .set('cookie', @badCookie)
        .expect(401, done)

    it 'should return error empty authorization (DELETE)', (done) ->
      request(@url)
        .del('/instanceId/undefined')
        .set('authorization', '')
        .expect(401, done)

    it 'should return error on bad authorization (DELETE)', (done) ->
      request(@url)
        .del('/instanceId/undefined')
        .set('authorization', shared.badAuth)
        .expect(401, done)

    it 'should return error on delete with unused body (DELETE)', (done) ->
      request(@url)
        .del('/instanceId/undefined')
        .set(shared.clientHeaders)
        .send(
          JSON.stringify
            text: 'Some useless message'
        ).expect(404, done)

