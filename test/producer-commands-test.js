'use strict'

import test from 'ava'
import {makeTeardown, makeSetup, getBody} from './utils'

let jerbil = require('../')
let fixtures = require('./fixtures')
let $ = {}

test.before(() => makeSetup($, jerbil.Producer, new Map([
  [/^use test\r\n$/, fixtures.USING],
  [/^put 1 2 3 6\r\n/, fixtures.INSERTED], // simple job
  [/^put 1 2 3 15\r\n/, fixtures.INSERTED] //complex job
])))

test.after(() => makeTeardown($))

test('use', (t) => {
  return $.client.useP('test').spread((tube) => {
    t.is(tube, 'test')
  })
})

test('put', (t) => {
  let job = 'myjob'
  let jobOptions = {priority: 1, delay: 2, ttr: 3}
  return $.client.putP(job, jobOptions).spread((jobId) => {
    t.is(jobId, '1')
  })
})
test('put (complex job)', (t) => {
  let job = {
    a: 10,
    b: '20',
    c: [1,2,3]
  }
  let jobOptions = {
    priority: 1,
    delay: 2,
    ttr: 3
  }

  let checkedBody = false
  $.client.once('message', (data) => {
    t.same(getBody(data), job)
    checkedBody = true
  })

  return $.client.putP(job, jobOptions).spread((jobId) => {
    t.is(jobId, '1')
    t.true(checkedBody)
  })
})
