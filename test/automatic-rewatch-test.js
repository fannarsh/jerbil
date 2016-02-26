'use strict'

import test from 'ava'
import {makeTeardown, makeSetup} from './utils'

let jerbil = require('../')
let fixtures = require('./fixtures')
let $ = {}

test.before(() => makeSetup($, jerbil.Worker, new Map([
  [/^watch mytube\r\nwatch myothertube\r\nwatch mygreattube\r\n/, fixtures.WATCHING_BATCH],
  [/^watch mytube\r\n$/, fixtures.WATCHING],
  [/^watch myothertube\r\n$/, fixtures.WATCHING],
  [/^watch mygreattube\r\n$/, fixtures.WATCHING],
  [/^stats\r\n/, fixtures.STATS],
])))

test.after(() => makeTeardown($))

test('automatic re-watch', (t) => {
  let closed = false
  let reconnected = false

  $.client.conn.once('close', () => closed = true)
  $.client.once('connect', () => reconnected = true)

  let tubes = ['mytube', 'myothertube', 'mygreattube']
  let watches = 0
  $.client.on('watch', (message) => {
    watches += message.split('\r\n').filter(Boolean).length
  })

  return Promise.all(tubes.map((tube) => $.client.watchP(tube)))
  .then(() => {
    t.is(watches, tubes.length)
    $.client.conn.destroy()
    return $.client.statsP()
  })
  .then((stats) => {
    t.same(stats[0], {'cmd-put': 3})
    t.true(closed)
    t.true(reconnected)
    t.is(watches, tubes.length * 2)
  })
})
