'use strict'

import net from 'net'
import msgpack from 'msgpack'
import yaml from 'js-yaml'
import Queue from 'double-ended-queue'
import responseSpecs from './response-spec'

const CRLF = new Buffer('\r\n')

export class Generic extends process.EventEmitter {
  constructor(port, host) {
    super()
    this.port = port || 11300
    this.host = host || '127.0.0.1'
    this.disconnected = false
    this.raw = false
    this.setMaxListeners(0)
    this.queue = new Queue()
  }

  setRaw(val) {
    // Disable automatic msgpack (de)serialization
    this.raw = (val !== false)
  }

  connect(callback = function() {}) {
    this.disconnected = false
    this.conn = net.createConnection(this.port, this.host)
    this.conn.setKeepAlive(true)
    this.conn.on('connect', () => this._handleConnect(callback))
    this.conn.on('data', (data) => this._handleResponse(data))
    this.conn.on('close', () => !this.disconnected && this.connect())
  }

  _handleConnect(callback) {
    this.emit('connect')
    setImmediate(function() {
      callback(null)
    })
  }

  disconnect(callback = function() {}) {
    let err = null

    if (this.disconnected) {
      return callback(err)
    }

    try { this.conn.destroy() } catch (e) { err = e }

    this.disconnected = true
    this.queue.toArray().forEach((responseObj) => {
      responseObj.callback.call(this, new Error('Disconnected'))
    })
    this.queue = new Queue()

    callback(err)
  }

  _handleResponse(responseData) {
    let message = this.queue.shift()
    let separatorIndex = responseData.indexOf(CRLF)
    let head = responseData.slice(0, separatorIndex).toString()

    if (message === undefined) {
      throw new Error('Response handler missing: ${head}')
    }

    if (!head.startsWith(message.expectedResponse)) {
      return message.callback.call(this, new Error(head))
    }

    head = head.split(' ').slice(1)
    let responseArgs = [null]

    for (let typeCast of message.responseHead || []) {
      responseArgs.push(typeCast(head.shift()))
    }

    if (message.responseBody) {
      let bytesLength = Number(head.pop())
      let start = separatorIndex + CRLF.length
      let body = responseData.slice(start, start + bytesLength)

      if (message.responseBody === 'yaml') {
        responseArgs.push(yaml.safeLoad(body))
      } else if (this.raw) {
        responseArgs.push(body)
      } else {
        responseArgs.push(msgpack.unpack(body))
      }

      // Advance separator index for continuing batch processing
      separatorIndex = responseData.indexOf(CRLF, start)
    }

    message.callback.apply(this, responseArgs)

    if (responseData.indexOf(CRLF, separatorIndex + CRLF.length) !== -1) {
      // Continue processing batch response
      this._handleResponse(responseData.slice(separatorIndex + CRLF.length))
    }
  }

  _createResponseObj(args, callback) {
    if (this.disconnected) {
      throw new Error('Connection has been closed by user')
    }
    if (typeof callback !== 'function') {
      throw new Error('Malformed arguments')
    }

    // TODO validate args

    let command = args[0]
    let responseSpec = responseSpecs[command]

    if (responseSpec === undefined) {
      throw Error(`Unexpected command: ${command}`)
    }

    return Object.assign({command, callback}, responseSpec)
  }

  _createMessage(args) {
    let command = args[0]
    let message

    if (command === 'put') {
      // Message must have a body
      let body = this.raw ? new Buffer(args.pop()) : msgpack.pack(args.pop())
      let head = new Buffer(`${args.join(' ')} ${body.length}`)
      message = Buffer.concat([head, CRLF, body, CRLF])
    } else {
      message = new Buffer(`${args.join(' ')}${CRLF.toString()}`)
    }

    return message
  }

  send(args, callback) {
    let responseObj = this._createResponseObj(args, callback)
    let message = this._createMessage(args)

    if (this._isPrioritized(args)) {
      // Prioritizing message
      this.queue.unshift(responseObj)
    } else {
      this.queue.push(responseObj)
    }

    if (this.conn && this.conn.writable) {
      this.conn.write(message)
    } else {
      this.once('connect', () => this.conn.write(message))
    }
  }

  _makePrioritized(message) {
    message[Symbol.for('priority')] = true
    return message
  }

  _isPrioritized(message) {
    return message[Symbol.for('priority')] === true
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

export class Worker extends Generic {
  constructor(port, host) {
    super(port, host)
    this.tubes = new Set()
  }

  /**
   * Override parent function to automatically re-watch tubes if any have been
   * selected previously with .watch() or updated with .ignore()
   */

  _handleConnect(callback) {
    if (this.tubes.size < 1) {
      return super._handleConnect(callback)
    }

    let tubes = this.tubes.values()

    let nextTube = () => {
      let tube = tubes.next()

      if (tube.done) {
        return super._handleConnect(callback)
      }

      this.send(this._makePrioritized(['watch', tube.value]), (err) => {
        if (err) {
          throw new Error('Failed to auto-rewatch tube')
        }

        nextTube()
      })
    }

    nextTube()
  }

  /**
   * Worker commands
   */

  reserve(callback) {
    this.send(['reserve'], callback)
  }
  reserveWithTimeout(timeout, callback) {
    this.send(['reserve-with-timeout', timeout], callback)
  }
  release(job, priority, delay, callback) {
    this.send(['release', job, priority, delay], callback)
  }
  bury(job, priority, callback) {
    this.send(['bury', job, priority], callback)
  }
  delete(job, callback) {
    this.send(['delete', job], callback)
  }
  touch(job, callback) {
    this.send(['touch', job], callback)
  }
  watch(tube, callback) {
    this.send(['watch', tube], (err, count) => {
      if (err) {
        callback.call(this, err)
      } else {
        this.tubes.add(tube)
        callback.call(this, err, count)
      }
    })
  }
  ignore(tube, callback) {
    this.send(['ignore', tube], (err, count) => {
      if (err) {
        callback.call(this, err)
      } else {
        this.tubes.delete(tube)
        callback.call(this, err, count)
      }
    })
  }
}

export class Producer extends Generic {
  constructor(port, host) {
    super(port, host)
    this.tube = undefined
  }

  /**
   * Override parent function to automatically reassign tube if one has been
   * selected previously with .use()
   */

  _handleConnect(callback) {
    if (this.tube === undefined) {
      return super._handleConnect(callback)
    }

    this.send(this._makePrioritized(['use', this.tube]), (err) => {
      if (err) {
        throw new Error('Failed to auto-reassign tube')
      }

      super._handleConnect(callback)
    })
  }

  /**
   * Producer commands
   */

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
