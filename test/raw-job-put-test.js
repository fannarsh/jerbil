'use strict'

import test from 'ava'
import {Producer} from '../'
import {fixtures, makeTeardown, makeSetup} from './utils'

const $ = {}

test.before(() => makeSetup($, Producer, new Map([
  [/^put 1 2 3 29\r\n/, fixtures.INSERTED],
])))

test.after(() => makeTeardown($))

test('put raw job', (t) => {
  $.client.setRaw(true)

  let checkedMessage = false
  let job = {a: 10, b: '20', c: [1,2,3]}
  let options = {priority: 1, delay: 2, ttr: 3}

  $.client.on('put', (m) => {
    t.is(typeof m, 'string')
    let body = m.slice(m.indexOf('\r\n') + 2)
    t.same(JSON.parse(body), job)
    checkedMessage = true
  })

  return $.client.putP(JSON.stringify(job), options).spread((jobId) => {
    t.is(jobId, '1')
    t.true(checkedMessage)
  })
})
