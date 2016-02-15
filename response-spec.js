module.exports = {
  'use': {
    expectedResponse: 'USING',
    responseHead: [String]
  },
  'put': {
    expectedResponse: 'INSERTED',
    responseHead: [String]
  },
  'reserve': {
    expectedResponse: 'RESERVED',
    responseHead: [String],
    responseBody: 'msgpack'
  },
  'reserve-with-timeout': {
    expectedResponse: 'RESERVED',
    responseHead: [String],
    responseBody: 'msgpack'
  },
  'release': {
    expectedResponse: 'RELEASED'
  },
  'bury': {
    expectedResponse: 'BURIED'
  },
  'delete': {
    expectedResponse: 'DELETED'
  },
  'touch': {
    expectedResponse: 'TOUCHED'
  },
  'watch': {
    expectedResponse: 'WATCHING',
    responseHead: [Number]
  },
  'ignore': {
    expectedResponse: 'WATCHING',
    responseHead: [Number]
  },
  'peek': {
    expectedResponse: 'FOUND',
    responseHead: [String],
    responseBody: 'msgpack'
  },
  'peek-buried': {
    expectedResponse: 'FOUND',
    responseHead: [String],
    responseBody: 'msgpack'
  },
  'peek-ready': {
    expectedResponse: 'FOUND',
    responseHead: [String],
    responseBody: 'msgpack'
  },
  'peek-delayed': {
    expectedResponse: 'FOUND',
    responseHead: [String],
    responseBody: 'msgpack'
  },
  'kick': {
    expectedResponse: 'KICKED',
    responseHead: [Number]
  },
  'kick-job': {
    expectedResponse: 'KICKED'
  },
  'stats': {
    expectedResponse: 'OK',
    responseBody: 'yaml'
  },
  'stats-job': {
    expectedResponse: 'OK',
    responseBody: 'yaml'
  },
  'stats-tube': {
    expectedResponse: 'OK',
    responseBody: 'yaml'
  },
  'list-tubes': {
    expectedResponse: 'OK',
    responseBody: 'yaml'
  },
  'list-tubes-watched': {
    expectedResponse: 'OK',
    responseBody: 'yaml'
  },
  'list-tube-used': {
    expectedResponse: 'OK',
    responseHead: [String]
  },
  'pause-tube': {
    expectedResponse: 'PAUSED'
  },
  'quit': {
  }
}

