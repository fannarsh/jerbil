'use strict'

let net = require('net')
let assert = require('assert')
let msgpack = require('msgpack')
let yaml = require('js-yaml')
let bean = require('./')

let CRLF = new Buffer('\r\n')

let fixtures = {
  NOT_FOUND: new Buffer('NOT_FOUND\r\n'),
  FOUND: Buffer.concat([
    new Buffer('FOUND 1 9\r\n'),
    msgpack.pack('greeting'),
    CRLF
  ]),
  FOUND_COMPLEX: Buffer.concat([
    new Buffer('FOUND 3 15\r\n'),
    msgpack.pack({a: 10, b: '20', c: [1,2,3]}),
    CRLF
  ]),

  KICKED: new Buffer('KICKED 10\r\n'),
  KICKED_JOB: new Buffer('KICKED\r\n'),

  STATS: Buffer.concat([
     new Buffer('OK 11\r\n'),
     new Buffer(yaml.safeDump({'cmd-put': 3})),
     CRLF
  ]),
  STATS_TUBE: Buffer.concat([
     new Buffer('OK 11\r\n'),
     new Buffer(yaml.safeDump({'cmd-put': 2})),
     CRLF
  ]),
  STATS_JOB: Buffer.concat([
     new Buffer('OK 11\r\n'),
     new Buffer(yaml.safeDump({'cmd-put': 1})),
     CRLF
  ]),

  LIST_TUBES: Buffer.concat([
      new Buffer('OK 32\r\n'),
      new Buffer(yaml.safeDump(['default', 'greeting', 'test'])),
      CRLF
  ]),
  LIST_TUBES_WATCHED: Buffer.concat([
      new Buffer('OK 14\r\n'),
      new Buffer(yaml.safeDump(['default'])),
      CRLF
  ]),
  LIST_TUBE_USED: new Buffer('USING test\r\n'),

  PAUSE_TUBE: new Buffer('PAUSED\r\n'),

  RESERVED: Buffer.concat([
    new Buffer('RESERVED 1 9\r\n'),
    msgpack.pack('greeting'),
    CRLF
  ]),
  RELEASED: new Buffer('RELEASED\r\n'),
  BURIED: new Buffer('BURIED\r\n'),
  DELETED: new Buffer('DELETED\r\n'),
  TOUCHED: new Buffer('TOUCHED\r\n'),
  WATCHING: new Buffer('WATCHING 2\r\n'),
  IGNORING: new Buffer('WATCHING 1\r\n'),

  USING: new Buffer('USING test\r\n'),
  INSERTED: new Buffer('INSERTED 1\r\n')
}

function makeSetup(scope, cstr, responseMap) {
  let TEST_PORT = 9876

  return function(callback) {
    scope.client = new cstr(TEST_PORT)

    scope.server = net.createServer((c) => {
      c.on('data', (data) => {
        scope.client.emit('message', data)
        let message = data.toString('ascii')
        scope.client.emit(message.slice(0, message.indexOf(' ')), message)

        for (let [reg, res] of responseMap) {
          if (reg.test(data)) return c.write(res)
        }

        throw new Error(`Unexpected message: ${data}`)
      })
    })

    scope.server.listen(TEST_PORT, () => scope.client.connect(callback))
  }
}

suite('generic', function() {
  let $ = {}

  setup(makeSetup($, bean.GenericBean, new Map([
    [/^peek 1\r\n$/, fixtures.FOUND],
    [/^peek 2\r\n$/, fixtures.NOT_FOUND],
    [/^peek 3\r\n$/, fixtures.FOUND_COMPLEX],
    [/^peek-(ready|buried|delayed)\r\n$/, fixtures.FOUND],

    [/^kick 10\r\n$/, fixtures.KICKED],
    [/^kick-job 1\r\n$/, fixtures.KICKED_JOB],

    [/^stats\r\n/, fixtures.STATS],
    [/^stats-job 1\r\n$/, fixtures.STATS_JOB],
    [/^stats-tube test\r\n$/, fixtures.STATS_TUBE],

    [/^list-tubes\r\n/, fixtures.LIST_TUBES],
    [/^list-tubes-watched\r\n$/, fixtures.LIST_TUBES_WATCHED],
    [/^list-tube-used\r\n$/, fixtures.LIST_TUBE_USED],

    [/^pause-tube greeting 100\r\n$/, fixtures.PAUSE_TUBE],
  ])))

  teardown(function(done) {
    $.client.disconnect(() => $.server.close(done))
  })

  test('peek', function (done) {
    $.client.peek('1', (err, job, body) => {
      assert.ifError(err)
      assert.strictEqual(job, '1')
      assert(body, 'greeting')
      done()
    })
  })
  test('peek (not found)', function(done) {
    $.client.peek('2', (err) => {
      assert(err)
      assert.strictEqual(err.message, 'NOT_FOUND')
      done()
    })
  })
  test('peek (complex job)', function (done) {
    $.client.peek('3', (err, job, body) => {
      assert.ifError(err)
      assert.strictEqual(job, '3')
      assert.deepEqual(body, {
        a: 10,
        b: '20',
        c: [1,2,3]
      })
      done()
    })
  })
  test('peek-ready', function(done) {
    $.client.peekReady((err, job, body) => {
      assert.ifError(err)
      assert.strictEqual(job, '1')
      assert.strictEqual(body, 'greeting')
      done()
    })
  })
  test('peek-buried', function(done) {
    $.client.peekBuried((err, job, body) => {
      assert.ifError(err)
      assert.strictEqual(job, '1')
      assert.strictEqual(body, 'greeting')
      done()
    })
  })
  test('peek-delayed', function(done) {
    $.client.peekDelayed((err, job, body) => {
      assert.ifError(err)
      assert.strictEqual(job, '1')
      assert.strictEqual(body, 'greeting')
      done()
    })
  })

  test('kick', function(done) {
    $.client.kick(10, (err, kicked) => {
      assert.ifError(err)
      assert.strictEqual(kicked, 10)
      done()
    })
  })
  test('kick-job', function(done) {
    $.client.kickJob('1', done)
  })

  test('stats', function(done) {
    $.client.stats((err, stats) => {
      assert.ifError(err)
      assert.deepEqual(stats, {'cmd-put': 3})
      done()
    })
  })
  test('stats-tube', function(done) {
    $.client.statsTube('test', (err, stats) => {
      assert.ifError(err)
      assert.deepEqual(stats, {'cmd-put': 2})
      done()
    })
  })
  test('stats-job', function(done) {
    $.client.statsJob('1', (err, stats) => {
      assert.ifError(err)
      assert.deepEqual(stats, {'cmd-put': 1})
      done()
    })
  })

  test('list-tubes', function(done) {
    $.client.listTubes((err, tubes) => {
      assert.ifError(err)
      assert.deepEqual(tubes, ['default', 'greeting', 'test'])
      done()
    })
  })
  test('list-tubes-watched', function(done) {
    $.client.listTubesWatched((err, tubes) => {
      assert.ifError(err)
      assert.deepEqual(tubes, ['default'])
      done()
    })
  })

  test('pause-tube', function(done) {
    $.client.pauseTube('greeting', 100, done)
  })
})

suite('worker', function() {
  let $ = {}

  setup(makeSetup($, bean.Worker, new Map([
    [/^reserve\r\n$/, fixtures.RESERVED],
    [/^reserve-with-timeout \d+\r\n$/, fixtures.RESERVED],
    [/^release 1 2 100\r\n$/, fixtures.RELEASED],
    [/^bury 1 5\r\n$/, fixtures.BURIED],
    [/^delete 1\r\n$/, fixtures.DELETED],
    [/^touch 1\r\n$/, fixtures.TOUCHED],
    [/^watch mytube\r\n$/, fixtures.WATCHING],
    [/^ignore mytube\r\n$/, fixtures.IGNORING],
  ])))

  teardown(function(done) {
    $.client.disconnect(() => $.server.close(done))
  })

  test('reserve', function (done) {
    $.client.reserve((err, job, body) => {
      assert.ifError(err)
      assert.strictEqual(job, '1')
      assert.strictEqual(body, 'greeting')
      done()
    })
  })
  test('reserve-with-timeout', function (done) {
    $.client.reserveWithTimeout(100, (err, job, body) => {
      assert.ifError(err)
      assert.strictEqual(job, '1')
      assert.strictEqual(body, 'greeting')
      done()
    })
  })

  test('release', function(done) {
    $.client.release('1', 2, 100, done)
  })
  test('bury', function(done) {
    $.client.bury('1', 5, done)
  })
  test('delete', function(done) {
    $.client.delete('1', done)
  })
  test('touch', function(done) {
    $.client.touch('1', done)
  })

  test('watch', function(done) {
    $.client.watch('mytube', (err, watching) => {
      assert.ifError(err)
      assert.strictEqual(watching, 2)
      done()
    })
  })
  test('ignore', function(done) {
    $.client.ignore('mytube', (err, watching) => {
      assert.ifError(err)
      assert.strictEqual(watching, 1)
      done()
    })
  })
})

suite('producer', function() {
  let $ = {}

  setup(makeSetup($, bean.Producer, new Map([
    [/^use test\r\n$/, fixtures.USING],
    [/^put 1 2 3 6\r\n/, fixtures.INSERTED],
    [/^put 1 2 3 15\r\n/, fixtures.INSERTED]
  ])))

  teardown(function(done) {
    $.client.disconnect(() => $.server.close(done))
  })

  function getBody(data) {
    return msgpack.unpack(data.slice(data.indexOf(CRLF) + CRLF.length, -CRLF.length))
  }

  test('use', function(done) {
    $.client.use('test', (err, tube) => {
      assert.ifError(err)
      assert.strictEqual(tube, 'test')
      done()
    })
  })
  test('put', function(done) {
    $.client.put('myjob', {priority: 1, delay: 2, ttr: 3}, (err, jobId) => {
      assert.ifError(err)
      assert.strictEqual(jobId, '1')
      done()
    })
  })
  test('put (complex job)', function(done) {
    let job = {
      a: 10,
      b: '20',
      c: [1,2,3]
    }

    let checkedBody = false
    $.client.once('message', (data) => {
      assert.deepEqual(getBody(data), job)
      checkedBody = true
    })

    $.client.put(job, {priority: 1, delay: 2, ttr: 3}, (err, jobId) => {
      assert.ifError(err)
      assert.strictEqual(jobId, '1')
      assert(checkedBody)
      done()
    })
  })
})

suite('connection management', function() {
  let $ = {}

  suite('producer', function() {
    setup(makeSetup($, bean.Producer, new Map([
      [/^use test\r\n$/, fixtures.USING],
      [/^stats\r\n/, fixtures.STATS],
    ])))

    teardown((done) => $.client.disconnect(() => $.server.close(done)))

    test('automatic reconnect', function(done) {
      let closed = false
      let reconnected = false
      $.client.conn.once('close', () => closed = true)
      $.client.once('connect', () => reconnected = true)

      $.client.conn.destroy()

      $.client.stats((err, stats) => {
        assert.ifError(err)
        assert.deepEqual(stats, {'cmd-put': 3})
        assert(closed)
        assert(reconnected)
        done()
      })
    })

    test('automatic tube reassignment', function(done) {
      let closed = false
      let reconnected = false
      $.client.conn.once('close', () => closed = true)
      $.client.once('connect', () => reconnected = true)

      let uses = 0
      $.client.on('use', (message) => uses += 1)

      $.client.use('test', (err, tube) => {
        assert.ifError(err)
        assert.equal(tube, 'test')

        $.client.conn.destroy()

        $.client.stats((err, stats) => {
          assert.ifError(err)
          assert.deepEqual(stats, {'cmd-put': 3})
          assert(closed)
          assert(reconnected)
          assert.equal(uses, 2)
          done()
        })
      })
    })
  })

  suite('worker', function() {
    setup(makeSetup($, bean.Worker, new Map([
      [/^watch mytube\r\n/, fixtures.WATCHING],
      [/^watch myothertube\r\n/, fixtures.WATCHING],
      [/^watch mygreattube\r\n/, fixtures.WATCHING],
      [/^ignore mytube\r\n$/, fixtures.IGNORING],
      [/^stats\r\n/, fixtures.STATS],
    ])))

    teardown((done) => $.client.disconnect(() => $.server.close(done)))

    test('automatic reconnect', function(done) {
      let closed = false
      let reconnected = false
      $.client.conn.once('close', () => closed = true)
      $.client.once('connect', () => reconnected = true)

      $.client.conn.destroy()

      $.client.stats((err, stats) => {
        assert.ifError(err)
        assert.deepEqual(stats, {'cmd-put': 3})
        assert(closed)
        assert(reconnected)
        done()
      })
    })

    test('automatic tube watch', function(done) {
      let closed = false
      let reconnected = false
      $.client.conn.once('close', () => closed = true)
      $.client.once('connect', () => reconnected = true)

      let tubes = ['mytube', 'myothertube', 'mygreattube']
      let watches = 0
      $.client.on('watch', (message) => watches += 1)

      let watchPromise = new Promise((resolve, reject) => {
        ~function nextTube(index) {
          let tube = tubes[index]

          if (!tube) return resolve()

          $.client.watch(tube, (err) => {
            if (err) {
              reject(err)
            } else {
              nextTube(++index)
            }
          })
        }(0)
      })
      .catch(assert.fail)

      watchPromise.then(() => {
        assert.equal(watches, tubes.length)
        $.client.conn.destroy()
        $.client.stats((err, stats) => {
          assert.ifError(err)
          assert.deepEqual(stats, {'cmd-put': 3})
          assert(closed)
          assert(reconnected)
          assert.equal(watches, tubes.length * 2)
          done()
        })
      }).catch(assert.fail)
    })
  })
})
