'use strict'

import test from 'ava'
import {Worker} from '../'
import {fixtures, makeTeardown, makeSetup} from './utils'

const $ = {}

test.before(() => makeSetup($, Worker, new Map([
  [/^reserve\r\n/, fixtures.RESERVED_RAW],
])))

test.after(() => makeTeardown($))

test('reserve raw job', (t) => {
  $.client.setRaw(true)

  return $.client.reserveP().spread((jobName, jobData) => {
    t.is(jobName, '1')
    t.true(Buffer.isBuffer(jobData))
    t.same(JSON.parse(jobData.toString()), {
      a: 10,
      b: '20',
      c: [1,2,3]
    })
  })
})
