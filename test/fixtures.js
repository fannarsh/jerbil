'use strict'

let msgpack = require('msgpack-lite')
let yaml = require('js-yaml')
let CRLF = new Buffer('\r\n')

module.exports = {
  NOT_FOUND: new Buffer('NOT_FOUND\r\n'),
  FOUND: Buffer.concat([
    new Buffer('FOUND 1 9\r\n'),
    msgpack.encode('greeting'),
    CRLF
  ]),
  FOUND_COMPLEX: Buffer.concat([
    new Buffer('FOUND 3 15\r\n'),
    msgpack.encode({a: 10, b: '20', c: [1,2,3]}),
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
    msgpack.encode('greeting'),
    CRLF
  ]),
  RESERVED_RAW: Buffer.concat([
    new Buffer('RESERVED 1 29\r\n'),
    new Buffer(JSON.stringify({a: 10, b: '20', c: [1,2,3]})),
    CRLF
  ]),
  RELEASED: new Buffer('RELEASED\r\n'),
  BURIED: new Buffer('BURIED\r\n'),
  DELETED: new Buffer('DELETED\r\n'),
  TOUCHED: new Buffer('TOUCHED\r\n'),
  WATCHING: new Buffer('WATCHING 2\r\n'),
  WATCHING_BATCH: new Buffer('WATCHING 1\r\nWATCHING 2\r\nWATCHING 3\r\n'),
  IGNORING: new Buffer('WATCHING 1\r\n'),

  USING: new Buffer('USING test\r\n'),
  INSERTED: new Buffer('INSERTED 1\r\n')
}
