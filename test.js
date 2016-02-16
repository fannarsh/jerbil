'use strict'

let net = require('net')
let assert = require('assert')
let bean = require('./')

let CRLF = new Buffer('\r\n')
let msgpack = require('msgpack')
let yaml = require('js-yaml')

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

suite('generic', function() {
  let TEST_PORT = 9876
  let server, client

  let responseMap = new Map()
  responseMap.set(/^peek 1\r\n$/, fixtures.FOUND)
  responseMap.set(/^peek 2\r\n$/, fixtures.NOT_FOUND)
  responseMap.set(/^peek 3\r\n$/, fixtures.FOUND_COMPLEX)
  responseMap.set(/^peek-(ready|buried|delayed)\r\n$/, fixtures.FOUND)

  responseMap.set(/^kick 10\r\n$/, fixtures.KICKED)
  responseMap.set(/^kick-job 1\r\n$/, fixtures.KICKED_JOB)

  responseMap.set(/^stats\r\n/, fixtures.STATS)
  responseMap.set(/^stats-job 1\r\n$/, fixtures.STATS_JOB)
  responseMap.set(/^stats-tube test\r\n$/, fixtures.STATS_TUBE)

  responseMap.set(/^list-tubes\r\n/, fixtures.LIST_TUBES)
  responseMap.set(/^list-tubes-watched\r\n$/, fixtures.LIST_TUBES_WATCHED)
  responseMap.set(/^list-tube-used\r\n$/, fixtures.LIST_TUBE_USED)

  responseMap.set(/^pause-tube greeting 100\r\n$/, fixtures.PAUSE_TUBE)

  setup(function(done) {
    server = net.createServer((c) => {
      c.setEncoding('ascii')
      c.on('data', (data) => {
        for (let [reg, res] of responseMap) {
          if (reg.test(data)) return c.write(res)
        }
        throw new Error(`Unexpected message: ${data}`)
      })
    })
    client = new bean.GenericBean(TEST_PORT)
    server.listen(9876, () => client.connect(done))
  })

  teardown(function(done) {
    client.disconnect(() => server.close(done))
  })

  test('peek', function (done) {
    client.peek('1', (err, job, body) => {
      assert.ifError(err)
      assert.strictEqual(job, '1')
      assert(body, 'greeting')
      done()
    })
  })
  test('peek (not found)', function(done) {
    client.peek('2', (err) => {
      assert(err)
      assert.strictEqual(err.message, 'NOT_FOUND')
      done()
    })
  })
  test('peek (complex job)', function (done) {
    client.peek('3', (err, job, body) => {
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
    client.peekReady((err, job, body) => {
      assert.ifError(err)
      assert.strictEqual(job, '1')
      assert.strictEqual(body, 'greeting')
      done()
    })
  })
  test('peek-buried', function(done) {
    client.peekBuried((err, job, body) => {
      assert.ifError(err)
      assert.strictEqual(job, '1')
      assert.strictEqual(body, 'greeting')
      done()
    })
  })
  test('peek-delayed', function(done) {
    client.peekDelayed((err, job, body) => {
      assert.ifError(err)
      assert.strictEqual(job, '1')
      assert.strictEqual(body, 'greeting')
      done()
    })
  })

  test('kick', function(done) {
    client.kick(10, (err, kicked) => {
      assert.ifError(err)
      assert.strictEqual(kicked, 10)
      done()
    })
  })
  test('kick-job', function(done) {
    client.kickJob('1', done)
  })

  test('stats', function(done) {
    client.stats((err, stats) => {
      assert.ifError(err)
      assert.deepEqual(stats, {'cmd-put': 3})
      done()
    })
  })
  test('stats-tube', function(done) {
    client.statsTube('test', (err, stats) => {
      assert.ifError(err)
      assert.deepEqual(stats, {'cmd-put': 2})
      done()
    })
  })
  test('stats-job', function(done) {
    client.statsJob('1', (err, stats) => {
      assert.ifError(err)
      assert.deepEqual(stats, {'cmd-put': 1})
      done()
    })
  })

  test('list-tubes', function(done) {
    client.listTubes((err, tubes) => {
      assert.ifError(err)
      assert.deepEqual(tubes, ['default', 'greeting', 'test'])
      done()
    })
  })
  test('list-tubes-watched', function(done) {
    client.listTubesWatched((err, tubes) => {
      assert.ifError(err)
      assert.deepEqual(tubes, ['default'])
      done()
    })
  })

  test('pause-tube', function(done) {
    client.pauseTube('greeting', 100, done)
  })
})

suite('worker', function() {
  let TEST_PORT = 9876
  let server, client

  let responseMap = new Map()
  responseMap.set(/^reserve\r\n$/, fixtures.RESERVED)
  responseMap.set(/^reserve-with-timeout \d+\r\n$/, fixtures.RESERVED)
  responseMap.set(/^release 1 2 100\r\n$/, fixtures.RELEASED)
  responseMap.set(/^bury 1 5\r\n$/, fixtures.BURIED)
  responseMap.set(/^delete 1\r\n$/, fixtures.DELETED)
  responseMap.set(/^touch 1\r\n$/, fixtures.TOUCHED)

  responseMap.set(/^watch mytube\r\n$/, fixtures.WATCHING)
  responseMap.set(/^ignore mytube\r\n$/, fixtures.IGNORING)

  setup(function(done) {
    server = net.createServer((c) => {
      c.setEncoding('ascii')
      c.on('data', (data) => {
        for (let [reg, res] of responseMap) {
          if (reg.test(data)) return c.write(res)
        }
        throw new Error(`Unexpected message: ${data}`)
      })
    })
    client = new bean.Worker(TEST_PORT)
    server.listen(9876, () => client.connect(done))
  })

  teardown(function(done) {
    client.disconnect(() => server.close(done))
  })

  test('reserve', function (done) {
    client.reserve((err, job, body) => {
      assert.ifError(err)
      assert.strictEqual(job, '1')
      assert.strictEqual(body, 'greeting')
      done()
    })
  })
  test('reserve-with-timeout', function (done) {
    client.reserveWithTimeout(100, (err, job, body) => {
      assert.ifError(err)
      assert.strictEqual(job, '1')
      assert.strictEqual(body, 'greeting')
      done()
    })
  })

  test('release', function(done) {
    client.release('1', 2, 100, done)
  })
  test('bury', function(done) {
    client.bury('1', 5, done)
  })
  test('delete', function(done) {
    client.delete('1', done)
  })
  test('touch', function(done) {
    client.touch('1', done)
  })

  test('watch', function(done) {
    client.watch('mytube', (err, watching) => {
      assert.ifError(err)
      assert.strictEqual(watching, 2)
      done()
    })
  })
  test('ignore', function(done) {
    client.ignore('mytube', (err, watching) => {
      assert.ifError(err)
      assert.strictEqual(watching, 1)
      done()
    })
  })
})

suite('producer', function() {
  let TEST_PORT = 9876
  let server, client

  let responseMap = new Map()
  responseMap.set(/^use test\r\n$/, fixtures.USING)
  responseMap.set(/^put 1 2 3 6\r\n/, fixtures.INSERTED)
  responseMap.set(/^put 1 2 3 15\r\n/, fixtures.INSERTED)

  setup(function(done) {
    server = net.createServer((c) => {
      c.on('data', (data) => {
        client.emit('message', data)
        for (let [reg, res] of responseMap) {
          if (reg.test(data)) return c.write(res)
        }
        throw new Error(`Unexpected message: ${data}`)
      })
    })
    client = new bean.Producer(TEST_PORT)
    server.listen(9876, () => client.connect(done))
  })

  teardown(function(done) {
    client.disconnect(() => server.close(done))
  })

  test('use', function(done) {
    client.use('test', (err, tube) => {
      assert.ifError(err)
      assert.strictEqual(tube, 'test')
      done()
    })
  })
  test('put', function(done) {
    client.put('myjob', {priority: 1, delay: 2, ttr: 3}, (err, jobId) => {
      assert.ifError(err)
      assert.strictEqual(jobId, '1')
      done()
    })
  })
  test('put (complex job)', function(done) {
    let checkedBody = false
    client.once('message', (data) => {
      let ind = data.indexOf(CRLF)
      let body = data.slice(ind + CRLF.length, -CRLF.length)
      assert.deepEqual(msgpack.unpack(body), {
        a: 10,
        b: '20',
        c: [1,2,3]
      })
      checkedBody = true
    })
    let job = {
      a: 10,
      b: '20',
      c: [1,2,3]
    }
    client.put(job, {priority: 1, delay: 2, ttr: 3}, (err, jobId) => {
      assert.ifError(err)
      assert.strictEqual(jobId, '1')
      assert(checkedBody)
      done()
    })
  })
})

