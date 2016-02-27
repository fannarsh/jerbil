'use strict'

import net from 'net'
import msgpack from 'msgpack'
import yaml from 'js-yaml'
import Queue from 'double-ended-queue'
import {commandSpecs, responseSpecs} from './spec'

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

  _createMessage(command, args) {
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

  _validateArgs(args) {
    let command = args[0]
    let commandSpec = commandSpecs[command]

    if (commandSpec === undefined) {
      throw new Error(`Unexpected command: ${command}`)
    }

    for (let [index, arg] of commandSpec.entries()) {
      let [name, re] = arg
      let cArg = args[++index]
      if (cArg === undefined || !re.test(cArg)) {
        throw new Error(`Expected argument ${index} (${name}) to match: ${re.source}`)
      }
    }
  }

  sendCommand(args, callback) {
    if (this.disconnected) {
      throw new Error('Connection has been closed by user')
    }

    this._validateArgs(args)

    if (!(this.conn && this.conn.writable)) {
      return this.once('connect', () => this.sendCommand(args, callback))
    }

    let command = args[0]
    let responseObj = Object.assign({command, callback}, responseSpecs[command])

    if (this._isPrioritized(args)) {
      // Prioritizing message
      this.queue.unshift(responseObj)
    } else {
      this.queue.push(responseObj)
    }

    this.conn.write(this._createMessage(command, args))
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
    this.sendCommand(['peek', job], callback)
  }
  peekReady(callback) {
    this.sendCommand(['peek-ready'], callback)
  }
  peekBuried(callback) {
    this.sendCommand(['peek-buried'], callback)
  }
  peekDelayed(callback) {
    this.sendCommand(['peek-delayed'], callback)
  }

  kick(count, callback) {
    this.sendCommand(['kick', count], callback)
  }
  kickJob(job, callback) {
    this.sendCommand(['kick-job', job], callback)
  }

  stats(callback) {
    this.sendCommand(['stats'], callback)
  }
  statsJob(job, callback) {
    this.sendCommand(['stats-job', job], callback)
  }
  statsTube(tube, callback) {
    this.sendCommand(['stats-tube', tube], callback)
  }

  listTubes(callback) {
    this.sendCommand(['list-tubes'], callback)
  }
  listTubesWatched(callback) {
    this.sendCommand(['list-tubes-watched'], callback)
  }
  listTubeUsed(callback) {
    this.sendCommand(['list-tube-used'], callback)
  }
  pauseTube(tube, delay, callback) {
    this.sendCommand(['pause-tube', tube, delay], callback)
  }
  quit(callback) {
    this.sendCommand(['quit'], callback)
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

      this.sendCommand(this._makePrioritized(['watch', tube.value]), (err) => {
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
    this.sendCommand(['reserve'], callback)
  }
  reserveWithTimeout(timeout, callback) {
    this.sendCommand(['reserve-with-timeout', timeout], callback)
  }
  release(job, priority, delay, callback) {
    this.sendCommand(['release', job, priority, delay], callback)
  }
  bury(job, priority, callback) {
    this.sendCommand(['bury', job, priority], callback)
  }
  delete(job, callback) {
    this.sendCommand(['delete', job], callback)
  }
  touch(job, callback) {
    this.sendCommand(['touch', job], callback)
  }
  watch(tube, callback) {
    this.sendCommand(['watch', tube], (err, count) => {
      if (err) {
        callback.call(this, err)
      } else {
        this.tubes.add(tube)
        callback.call(this, err, count)
      }
    })
  }
  ignore(tube, callback) {
    this.sendCommand(['ignore', tube], (err, count) => {
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

    this.sendCommand(this._makePrioritized(['use', this.tube]), (err) => {
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
    this.sendCommand(['use', tube], (err, tube) => {
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

    return this.sendCommand(['put', ...args, body], callback)
  }
}
