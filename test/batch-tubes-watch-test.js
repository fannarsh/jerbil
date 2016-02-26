'use strict'

import test from 'ava'
import {makeTeardown, makeSetup} from './utils'

let jerbil = require('../')
let fixtures = require('./fixtures')
let $ = {}

test.before(() => makeSetup($, jerbil.Worker, new Map([
  [/^watch testa\r\nwatch testb\r\nwatch testc\r\n$/, fixtures.WATCHING_BATCH],
])))

test.after(() => makeTeardown($))

test('batch tubes watch', (t) => {
  let tubes = ['testa', 'testb', 'testc']

  return Promise.all(tubes.map((tube, index) => {
    return $.client.watchP(tube).spread((count) => {
      t.is(count, index + 1)
    })
  }))
})
