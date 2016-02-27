'use strict'

import test from 'ava'
import {Generic} from '../'
import {fixtures, makeTeardown, makeSetup} from './utils'

const $ = {}

test.before(() => makeSetup($, Generic, new Map([
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
  [/^pause-tube greeting 100\r\n$/, fixtures.PAUSE_TUBE]
])))

test.after(() => makeTeardown($))

test('peek', (t) => {
  return $.client.peekP('1').spread((job, body) => {
    t.is(job, '1')
    t.is(body, 'greeting')
  })
})
test('peek (not found)', (t) => {
  return $.client.peekP('2').then(t.fail)
  .catch((err) => {
    t.true(err instanceof Error)
    t.is(err.message, 'NOT_FOUND')
  })
})
test('peek (complex job)', (t) => {
  return $.client.peekP('3').spread((job, body) => {
    t.is(job, '3')
    t.same(body, {
      a: 10,
      b: '20',
      c: [1,2,3]
    })
  })
})
test('peek (invalid job)', (t) => {
  return $.client.peekP('☃1').then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 1')))
})
test('peek (missing job)', (t) => {
  return $.client.peekP().then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 1')))
})

test('peek-ready', (t) => {
  return $.client.peekReadyP().spread((job, body) => {
    t.is(job, '1')
    t.is(body, 'greeting')
  })
})
test('peek-buried', (t) => {
  return $.client.peekBuriedP().spread((job, body) => {
    t.is(job, '1')
    t.is(body, 'greeting')
  })
})
test('peek-delayed', (t) => {
  return $.client.peekDelayedP().spread((job, body) => {
    t.is(job, '1')
    t.is(body, 'greeting')
  })
})

test('kick', (t) => {
  return $.client.kickP('10').spread((kicked) => {
    t.is(kicked, 10)
  })
})
test('kick (invalid count)', (t) => {
  return $.client.kickP('☃10').then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 1')))
})
test('kick (missing count)', (t) => {
  return $.client.kickP().then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 1')))
})

test('kick-job', (t) => {
  return $.client.kickJobP('1')
})
test('kick-job (invalid job)', (t) => {
  return $.client.kickJobP('☃1').then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 1')))
})
test('kick-job (missing job)', (t) => {
  return $.client.kickJobP(undefined).then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 1')))
})

test('stats', (t) => {
  return $.client.statsP().spread((stats) => {
    t.same(stats, {'cmd-put': 3})
  })
})

test('stats-tube', (t) => {
  return $.client.statsTubeP('test').spread((stats) => {
    t.same(stats, {'cmd-put': 2})
  })
})
test('stats-tube (invalid tube)', (t) => {
  return $.client.statsTubeP('☃test').then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 1')))
})
test('stats-tube (missing tube)', (t) => {
  return $.client.statsTubeP(undefined).then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 1')))
})

test('stats-job', (t) => {
  return $.client.statsJobP('1').spread((stats) => {
    t.same(stats, {'cmd-put': 1})
  })
})
test('stats-job (invalid job)', (t) => {
  return $.client.statsJobP('☃').then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 1')))
})
test('stats-job (missing job)', (t) => {
  return $.client.statsJobP().then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 1')))
})

test('list-tubes', (t) => {
  return $.client.listTubesP().spread((tubes) => {
    t.same(tubes, ['default', 'greeting', 'test'])
  })
})
test('list-tubes-watched', (t) => {
  return $.client.listTubesWatchedP().spread((tubes) => {
    t.same(tubes, ['default'])
  })
})

test('pause-tube', (t) => {
  return $.client.pauseTubeP('greeting', '100')
})
test('pause-tube (invalid tube)', (t) => {
  return $.client.pauseTubeP('☃greeting', 100).then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 1')))
})
test('pause-tube (missing tube)', (t) => {
  return $.client.pauseTubeP(undefined, 100).then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 1')))
})
test('pause-tube (invalid pause)', (t) => {
  return $.client.pauseTubeP('greeting', 'saludos').then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 2')))
})
test('pause-tube (missing pause)', (t) => {
  return $.client.pauseTubeP('greeting', undefined).then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 2')))
})
