'use strict'

import test from 'ava'
import {Worker} from '../'
import {fixtures, makeTeardown, makeSetup} from './utils'

const $ = {}

test.before(() => makeSetup($, Worker, new Map([
  [/^reserve\r\n$/, fixtures.RESERVED],
  [/^reserve-with-timeout \d+\r\n$/, fixtures.RESERVED],
  [/^release 1 2 100\r\n$/, fixtures.RELEASED],
  [/^bury 1 5\r\n$/, fixtures.BURIED],
  [/^delete 1\r\n$/, fixtures.DELETED],
  [/^touch 1\r\n$/, fixtures.TOUCHED],
  [/^watch mytube\r\n$/, fixtures.WATCHING],
  [/^ignore mytube\r\n$/, fixtures.IGNORING]
])))

test.after(() => makeTeardown($))

test('reserve', (t) => {
  return $.client.reserveP().spread((job, body) => {
    t.is(job, '1')
    t.is(body, 'greeting')
  })
})

test('reserve-with-timeout', (t) => {
  return $.client.reserveWithTimeoutP(100).spread((job, body) => {
    t.is(job, '1')
    t.is(body, 'greeting')
  })
})
test('reserve-with-timeout (invalid timeout)', (t) => {
  return $.client.reserveWithTimeoutP('asdf').then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 1')))
})

test('release', (t) => $.client.releaseP('1', 2, 100))
test('release (invalid job)', (t) => {
  return $.client.releaseP('asdf', 2, 100).then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 1')))
})
test('release (invalid priority)', (t) => {
  return $.client.releaseP('1', 'asdf', 100).then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 2')))
})
test('release (invalid delay)', (t) => {
  return $.client.releaseP('1', '2', 'asdf').then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 3')))
})

test('bury', (t) => $.client.buryP('1', 5))
test('bury (invalid job)', (t) => {
  return $.client.buryP('asdf', 5).then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 1')))
})
test('bury (invalid priority)', (t) => {
  return $.client.buryP('1', 'asdf').then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 2')))
})

test('delete', (t) => $.client.deleteP('1'))
test('delete (invalid job)', (t) => {
  return $.client.deleteP('asdf').then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 1')))
})

test('touch', (t) => $.client.touchP('1'))
test('touch (invalid job)', (t) => {
  return $.client.touchP('asdf').then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 1')))
})

test('watch', (t) => {
  return $.client.watchP('mytube').spread((watching) => {
    t.is(watching, 2)
  })
})
test('watch (invalid tube)', (t) => {
  return $.client.watchP('-mytube').then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 1')))
})

test('ignore', (t) => {
  return $.client.ignoreP('mytube').spread((watching) => {
    t.is(watching, 1)
  })
})
test('ignore (invalid tube)', (t) => {
  return $.client.ignoreP('-mytube').then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 1')))
})
