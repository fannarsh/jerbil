'use strict'

import net from 'net'
import msgpack from 'msgpack'
import yaml from 'js-yaml'
import Queue from 'double-ended-queue'
import responseSpecs from './response-spec'

const CRLF = new Buffer('\r\n')

class Bean extends process.EventEmitter {
  constructor(tube) {
    super()
    this.tube = tube || 'test'
    this.queue = new Queue()
  }

  connect(...args) {
    let callback = args.pop()
    let port = args.shift() || 11300
    let host = args.shift() || '127.0.0.1'

    this.conn = net.createConnection(port, host, callback)
    this.conn.on('error', (err) => this.emit('error', err))
    this.conn.on('data', (data) => this.handle(data))
  }

  disconnect(callback = function() {}) {
    let err = null
    try { this.conn.destroy() } catch (e) { err = e }
    callback(err)
    // Close out the queue?
  }

  handle(responseData) {
    let message = this.queue.shift()
    let separatorIndex = responseData.indexOf(CRLF)
    let head = responseData.slice(0, separatorIndex).toString()

    if (message === undefined) {
      throw new Error('Response handler missing: ${head}')
    }

    // console.log('>>RECEIVED:', JSON.stringify(responseData.toString()))

    if (!head.startsWith(message.expectedResponse))
      return message.callback.call(this, new Error(head))

    head = head.split(' ').slice(1)
    let responseArgs = [null]

    // Parse this stuff in a way that is cooler
    for (let typeCast of message.responseHead || [])
      responseArgs.push(typeCast(head.shift()))

    if (message.responseBody) {
      let bytesLength = Number(head.pop())
      let start = separatorIndex + CRLF.length
      let body = responseData.slice(start, start + bytesLength)

      if (message.responseBody === 'yaml') {
        // Response body for stats should be YAML
        responseArgs.push(yaml.safeLoad(body))
      } else {
        responseArgs.push(msgpack.unpack(body))
      }

      // Advance separator index for continuing batch processing
      separatorIndex = responseData.indexOf(CRLF, start)
    }

    message.callback.apply(this, responseArgs)

    if (responseData.indexOf(CRLF, separatorIndex + CRLF.length) !== -1) {
      // Continue processing batch response
      this.handle(responseData.slice(separatorIndex + CRLF.length))
    }
  }

  send(args, callback) {
    // Validate args
    let command = args[0]
    let responseSpec = responseSpecs[command]

    if (responseSpec === undefined) {
      throw Error(`Unexpected command: ${command}`)
    }

    let message

    if (command === 'put') {
      // Message must have a body
      let body = msgpack.pack(args.pop())
      let head = new Buffer(`${args.join(' ')} ${body.length}`)
      message = Buffer.concat([head, CRLF, body, CRLF])
    } else {
      message = new Buffer(`${args.join(' ')}${CRLF.toString()}`)
    }

    // console.log('<<SENDING ', JSON.stringify(message.toString()))

    this.queue.push(Object.assign({command, callback}, responseSpec))
    this.conn.write(message)
  }

  /* General commands*/

  peek(job, callback) {
    this.send(['peek', job], callback)
  }
  peekReady(callback) {
    this.send(['peek-ready'], callback)
  }
  peekBuried(callback) {
    this.send(['peek-buried'], callback)
  }
  peekDelayed(callback) {
    this.send(['peek-delayed'], callback)
  }

  kick(count, callback) {
    this.send(['kick', count], callback)
  }
  kickJob(job, callback) {
    this.send(['kick-job', job], callback)
  }

  stats(callback) {
    this.send(['stats'], callback)
  }
  statsJob(job, callback) {
    this.send(['stats-job', job], callback)
  }
  statsTube(tube, callback) {
    this.send(['stats-tube', tube], callback)
  }

  listTubes(callback) {
    this.send(['list-tubes'], callback)
  }
  listTubesWatched(callback) {
    this.send(['list-tubes-watched'], callback)
  }
  listTubeUsed(callback) {
    this.send(['list-tube-used'], callback)
  }
  pauseTube(tube, delay, callback) {
    this.send(['pause-tube', tube, delay], callback)
  }
  quit(callback) {
    this.send(['quit'], callback)
  }
}

export class Worker extends Bean {
  constructor(tube) {
    super(tube)
  }

  /* Worker commands*/

  reserve(callback) {
    this.send(['reserve'], callback)
  }
  reserveWithTimeout(timeout, callback) {
    this.send(['reserve-with-timeout'], timeout, callback)
  }
  release(job, priority, delay, callback) {
    this.send(['release', job, priority, delay], callback)
  }
  bury(job, priority, callback) {
    this.send(['bury', job], callback)
  }
  delete(job, callback) {
    this.send(['delete', job], callback)
  }
  touch(job, callback) {
    this.send(['touch', job], callback)
  }
  watch(tube, callback) {
    this.send(['watch', tube], callback)
  }
  ignore(tube, callback) {
    this.send(['ignore', tube], callback)
  }
}

export class Producer extends Bean {
  constructor(tube) {
    super(tube)
  }

  /* Producer commands*/

  use(tube, callback) {
    this.send(['use', tube], callback)
  }

  // put PRIORITY DELAY TTR BODY_LENGTH\r\nBODY\r\n
  put(body, opts, callback) {
    if (typeof opts !== 'object') {
      throw new Error('Missing options for put command')
    }

    let args = []
    args.push(opts.priority === undefined ? 0 : opts.priority)
    args.push(opts.delay === undefined ? 0 : opts.delay)
    args.push(opts.ttr === undefined ? 10 : opts.ttr)

    return this.send(['put', ...args, body], callback)
  }
}
