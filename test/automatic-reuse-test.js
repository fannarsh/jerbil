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

test('automatic re-use', (t) => {
  let closed = false
  let reconnected = false

  $.client.conn.once('close', () => closed = true)
  $.client.once('connect', () => reconnected = true)

  let uses = 0
  $.client.on('use', (message) => uses += 1)

  return $.client.useP('test').spread((tube) => {
    t.is(tube, 'test')

    $.client.conn.destroy()

    $.client.stats((err, stats) => {
      t.same(stats, {'cmd-put': 3})
      t.true(closed)
      t.true(reconnected)
      t.is(uses, 2)
    })
  })
})
