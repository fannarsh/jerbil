'use strict'

import test from 'ava'
import {makeTeardown, makeSetup} from './utils'

let jerbil = require('../')
let fixtures = require('./fixtures')
let $ = {}

test.before(() => makeSetup($, jerbil.Producer, new Map([
  [/^use test\r\n$/, fixtures.USING],
  [/^stats\r\n/, fixtures.STATS],
])))

test.after(() => makeTeardown($))

test('automatic reconnect', (t) => {
  let closed = false
  let reconnected = false

  $.client.conn.once('close', () => closed = true)
  $.client.once('connect', () => reconnected = true)

  $.client.conn.destroy()

  return $.client.statsP().spread((stats) => {
    t.same(stats, {'cmd-put': 3})
    t.true(closed)
    t.true(reconnected)
  })
})
