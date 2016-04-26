shared  = require './shared'
request = shared.request

describe 'RhoConnect Push Server', ->

  shared.shouldBehaveLikeAPushTest()

  before (done) ->
    @authServer = shared.testServer()
    @authServer.on 'listening', -> done()

  after (done) ->
    @authServer.close()
    done()

  describe 'messageQueue errors', ->

    it 'should return bad request error (GET)', (done) ->
      request(@url)
        .get('/messageQueue/undefined')
        .set(shared.serverHeaders)
        .send(JSON.stringify(shared.message))
        .expect(403, done)

    it 'should return bad request error (PUT)', (done) ->
      request(@url)
        .put('/messageQueue/undefined')
        .set(shared.serverHeaders)
        .send(JSON.stringify(shared.message))
        .expect(403, done)

    it 'should return bad request error (DELETE)', (done) ->
      request(@url)
        .del('/messageQueue/undefined')
        .set(shared.serverHeaders)
        .send(JSON.stringify(shared.message))
        .expect(403, done)

    it 'should return not enough fields error (POST)', (done) ->
      request(@url)
        .post('/messageQueue/')
        .set(shared.serverHeaders)
        .send(JSON.stringify(shared.message))
        .expect(403, done)

    it 'should return too many fields error (POST)', (done) ->
      request(@url)
        .post('/messageQueue/undefined/extrafield')
        .set(shared.serverHeaders)
        .send(JSON.stringify(shared.message))
        .expect(403, done)

    it 'should return no authorization error (POST)', (done) ->
      request(@url)
        .post('/messageQueue/undefined')
        .set('Content-Type': shared.serverHeaders['Content-Type'])
        .send(JSON.stringify(shared.message))
        .expect(401, done)

    it 'should return no authorization error with empty authorization (POST)', (done) ->
      request(@url)
        .post('/messageQueue/undefined')
        .set
          'Content-Type': shared.serverHeaders['Content-Type']
          'Authorization': ''
        .send(JSON.stringify(shared.message))
        .expect(401, done)

    it 'should return bad authorization error (POST)', (done) ->
      request(@url)
        .post('/messageQueue/undefined')
        .set
          'Content-Type': shared.serverHeaders['Content-Type']
          'Authorization': 'Basic badauth'
        .send(JSON.stringify(shared.message))
        .expect(401, done)

    it 'should return bad token error (POST)', (done) ->
      request(@url)
        .post('/messageQueue/badToken:badToken')
        .set(shared.serverHeaders)
        .send(JSON.stringify(shared.message))
        .expect(401, done)

    it 'should return bad request no body (POST)', (done) ->
      request(@url)
        .post('/messageQueue/undefined')
        .set(shared.serverHeaders)
        .expect(400, done)

    it 'should return bad request on badly formed request body (POST)', (done) ->
      request(@url)
        .post('/messageQueue/undefined')
        .set(shared.serverHeaders)
        .send(
          JSON.stringify
            text:
              "message": 'Here is message 1'
              "count": 1
        ).expect(400, done)


  describe 'messageQueue', ->

    before (done) ->
      shared.getInstanceId(@url, done)

    beforeEach (done) ->
      shared.getInstanceCookie(@url, done)

    it 'should add a message to queue (POST)', (done) ->
      shared.getRegistration()
      request(@url)
        .post('/messageQueue/' + shared.registrationToken)
        .set(shared.serverHeaders)
        .send(JSON.stringify(shared.message))
        .expect(204, done)
