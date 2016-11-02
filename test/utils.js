'use strict'

let net = require('net')
let bluebird = require('bluebird')
let msgpack = require('msgpack-lite')
let yaml = require('js-yaml')
let CRLF = new Buffer('\r\n')

exports.fixtures = require('./fixtures')

exports.makeSetup = function(scope, cstr, responseMap) {
  let TEST_PORT = 9876

  return bluebird.promisify(function(callback) {
    scope.client = new cstr(TEST_PORT)
    bluebird.promisifyAll(scope.client, {
      context: scope.client,
      multiArgs: true,
      suffix: 'P'
    })

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
  })()
}


exports.makeTeardown = function(scope) {
  return bluebird.promisify(function(callback) {
    scope.client.disconnect(function() {
      scope.server.close(function() {
        callback(null)
      })
    })
  })()
}

exports.getBody = function(data) {
  return msgpack.decode(data.slice(data.indexOf(CRLF) + CRLF.length, -CRLF.length))
}
