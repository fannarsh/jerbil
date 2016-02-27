
module.exports.commandSpecs = (function() {
  const NAME = /^(?!-)[a-zA-Z0-9\_\-\+\\;\.\$\(\)]+$/
  const NUMBER = /^[0-9]+$/

  return {
    'stats': [],
    'stats-tube': [['tube', NAME]],
    'stats-job': [['job', NUMBER]],
    'peek': [['job', NUMBER]],
    'peek-buried': [],
    'peek-ready': [],
    'peek-delayed': [],
    'kick': [['count', NUMBER]],
    'kick-job': [['job', NUMBER]],
    'list-tubes': [],
    'list-tubes-watched': [],
    'pause-tube': [['tube', NAME], ['pause seconds', NUMBER]],
    'reserve': [],
    'reserve-with-timeout': [['timeout seconds', NUMBER]],
    'release': [ ['job', NUMBER], ['priority', NUMBER], ['delay', NUMBER]],
    'bury': [['job', NUMBER], ['priority', NUMBER]],
    'delete': [['job', NUMBER]],
    'touch': [['job', NUMBER]],
    'watch': [['tube', NAME]],
    'ignore': [['tube', NAME]],
    'use': [['tube', NAME]],
    'put': [['priority', NUMBER], ['delay', NUMBER], ['ttr', NUMBER]]
  }
})()

module.exports.responseSpecs = (function() {
  return {
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
      expectedResponse: 'USING',
      responseHead: [String]
    },
    'pause-tube': {
      expectedResponse: 'PAUSED'
    },
    'quit': {
    }
  }
})()
