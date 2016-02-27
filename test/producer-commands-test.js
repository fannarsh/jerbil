'use strict'

import test from 'ava'
import {Producer} from '../'
import {fixtures, getBody, makeTeardown, makeSetup} from './utils'

const $ = {}

test.before(() => makeSetup($, Producer, new Map([
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
test('use (invalid tube)', (t) => {
  return $.client.useP('-test').then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 1')))
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
test('put (invalid priority)', (t) => {
  let job = 'myjob'
  let jobOptions = {priority: 'asdf', delay: 2, ttr: 3}
  return $.client.putP(job, jobOptions).then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 1')))
})
test('put (invalid delay)', (t) => {
  let job = 'myjob'
  let jobOptions = {priority: '1', delay: 'asdf', ttr: 3}
  return $.client.putP(job, jobOptions).then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 2')))
})
test('put (invalid delay)', (t) => {
  let job = 'myjob'
  let jobOptions = {priority: '1', delay: '1', ttr: 'asdf'}
  return $.client.putP(job, jobOptions).then(t.fail)
  .catch((err) => t.true(err.message.startsWith('Expected argument 3')))
})
