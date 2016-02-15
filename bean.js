'use strict'

import net from 'net'
import msgpack from 'msgpack'
import yaml from 'js-yaml'
import Queue from 'double-ended-queue'
import responseSpecs from './response-spec'

const CRLF = new Buffer('\r\n')

class Bean extends process.EventEmitter {
  constructor(port, host) {
    super()
    this.port = port || 11300
    this.host = host || '127.0.0.1'
    this.tube = undefined
    this.disconnected = false
    this.setMaxListeners(0)
    this.queue = new Queue()
  }

  connect(callback = function() {}) {
    this.conn = net.createConnection(this.port, this.host)
    this.conn.setKeepAlive(true)

    let handleConnect = (err) => {
      if (err) throw new Error('Failed to reassign tube during reconnect')
      this.emit('connect')
      setImmediate(callback)
    }

    this.conn.on('connect', () => {
      if (!this.tube) return handleConnect()

      // Reassign tube automatically
      let args = ['use', this.tube]
      args[Symbol.for('priority')] = true
      this.send(args, handleConnect)
    })
    this.conn.on('data', (data) => this.handle(data))
    this.conn.on('close', () => !this.disconnected && this.connect())
  }

  disconnect(callback = function() {}) {
    if (this.disconnected) return callback()

    this.disconnected = true

    let err = null
    try { this.conn.destroy() } catch (e) { err = e }

    callback(err)
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
    if (this.disconnected) {
      throw new Error('Connection has been closed')
    }

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

    if (args[Symbol.for('priority')]) {
      // Prioritizing message
      this.queue.unshift(Object.assign({command, callback}, responseSpec))
    } else {
      this.queue.push(Object.assign({command, callback}, responseSpec))
    }

    if (this.conn.writable) this.conn.write(message)
    else this.once('connect', () => this.conn.write(message))
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
  constructor() {
    super()
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
  constructor() {
    super()
  }

  /* Producer commands*/

  use(tube, callback) {
    this.send(['use', tube], (err, tube) => {
      if (err) {
        callback.call(this, err)
      } else {
        // Stash tube for reconnects
        this.tube = tube
        callback.call(this, err, tube)
      }
    })
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

