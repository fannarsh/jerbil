'use strict'

import test from 'ava'
import {makeTeardown, makeSetup} from './utils'

let jerbil = require('../')
let fixtures = require('./fixtures')
let $ = {}

test.before(() => makeSetup($, jerbil.Worker, new Map([
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

test('release', (t) => $.client.releaseP('1', 2, 100))
test('bury', (t) => $.client.buryP('1', 5))
test('delete', (t) => $.client.deleteP('1'))
test('touch', (t) => $.client.touchP('1'))

test('watch', (t) => {
  return $.client.watchP('mytube').spread((watching) => {
    t.is(watching, 2)
  })
})
test('ignore', (t) => {
  return $.client.ignoreP('mytube').spread((watching) => {
    t.is(watching, 1)
  })
})
