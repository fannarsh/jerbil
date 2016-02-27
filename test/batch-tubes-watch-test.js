'use strict'

import test from 'ava'
import {Worker} from '../'
import {fixtures, makeTeardown, makeSetup} from './utils'

const $ = {}

test.before(() => makeSetup($, Worker, new Map([
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
