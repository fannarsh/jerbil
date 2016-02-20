'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Producer = exports.Worker = exports.Generic = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _net = require('net');

var _net2 = _interopRequireDefault(_net);

var _msgpack = require('msgpack');

var _msgpack2 = _interopRequireDefault(_msgpack);

var _jsYaml = require('js-yaml');

var _jsYaml2 = _interopRequireDefault(_jsYaml);

var _doubleEndedQueue = require('double-ended-queue');

var _doubleEndedQueue2 = _interopRequireDefault(_doubleEndedQueue);

var _responseSpec = require('./response-spec');

var _responseSpec2 = _interopRequireDefault(_responseSpec);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var CRLF = new Buffer('\r\n');

var Generic = exports.Generic = function (_process$EventEmitter) {
  _inherits(Generic, _process$EventEmitter);

  function Generic(port, host) {
    _classCallCheck(this, Generic);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Generic).call(this));

    _this.port = port || 11300;
    _this.host = host || '127.0.0.1';
    _this.disconnected = false;
    _this.raw = false;
    _this.setMaxListeners(0);
    _this.queue = new _doubleEndedQueue2.default();
    return _this;
  }

  _createClass(Generic, [{
    key: 'setRaw',
    value: function setRaw(val) {
      // Disable automatic msgpack (de)serialization
      this.raw = val !== false;
    }
  }, {
    key: 'connect',
    value: function connect() {
      var _this2 = this;

      var callback = arguments.length <= 0 || arguments[0] === undefined ? function () {} : arguments[0];

      this.conn = _net2.default.createConnection(this.port, this.host);
      this.conn.setKeepAlive(true);
      this.conn.on('connect', function () {
        return _this2.handleConnect(callback);
      });
      this.conn.on('data', function (data) {
        return _this2.handleResponse(data);
      });
      this.conn.on('close', function () {
        return !_this2.disconnected && _this2.connect();
      });
    }
  }, {
    key: 'handleConnect',
    value: function handleConnect(callback) {
      this.emit('connect');
      setImmediate(callback);
    }
  }, {
    key: 'disconnect',
    value: function disconnect() {
      var callback = arguments.length <= 0 || arguments[0] === undefined ? function () {} : arguments[0];

      if (this.disconnected) {
        return callback();
      }

      this.disconnected = true;

      var err = null;
      try {
        this.conn.destroy();
      } catch (e) {
        err = e;
      }

      callback(err);
    }
  }, {
    key: 'handleResponse',
    value: function handleResponse(responseData) {
      var message = this.queue.shift();
      var separatorIndex = responseData.indexOf(CRLF);
      var head = responseData.slice(0, separatorIndex).toString();

      if (message === undefined) {
        throw new Error('Response handler missing: ${head}');
      }

      if (!head.startsWith(message.expectedResponse)) {
        return message.callback.call(this, new Error(head));
      }

      head = head.split(' ').slice(1);
      var responseArgs = [null];

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = (message.responseHead || [])[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var typeCast = _step.value;

          responseArgs.push(typeCast(head.shift()));
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      if (message.responseBody) {
        var bytesLength = Number(head.pop());
        var start = separatorIndex + CRLF.length;
        var body = responseData.slice(start, start + bytesLength);

        if (message.responseBody === 'yaml') {
          responseArgs.push(_jsYaml2.default.safeLoad(body));
        } else if (this.raw) {
          responseArgs.push(body);
        } else {
          responseArgs.push(_msgpack2.default.unpack(body));
        }

        // Advance separator index for continuing batch processing
        separatorIndex = responseData.indexOf(CRLF, start);
      }

      message.callback.apply(this, responseArgs);

      if (responseData.indexOf(CRLF, separatorIndex + CRLF.length) !== -1) {
        // Continue processing batch response
        this.handleResponse(responseData.slice(separatorIndex + CRLF.length));
      }
    }
  }, {
    key: 'send',
    value: function send(args, callback) {
      var _this3 = this;

      if (this.disconnected) {
        throw new Error('Connection has been closed by user');
      }
      if (typeof callback !== 'function') {
        throw new Error('Malformed arguments');
      }

      // TODO validate args

      var command = args[0];
      var responseSpec = _responseSpec2.default[command];

      if (responseSpec === undefined) {
        throw Error('Unexpected command: ' + command);
      }

      var responseObj = Object.assign({ command: command, callback: callback }, responseSpec);
      var message = undefined;

      if (command === 'put') {
        // Message must have a body
        var body = this.raw ? new Buffer(args.pop()) : _msgpack2.default.pack(args.pop());
        var head = new Buffer(args.join(' ') + ' ' + body.length);
        message = Buffer.concat([head, CRLF, body, CRLF]);
      } else {
        message = new Buffer('' + args.join(' ') + CRLF.toString());
      }

      if (this.isPrioritized(args)) {
        // Prioritizing message
        this.queue.unshift(responseObj);
      } else {
        this.queue.push(responseObj);
      }

      if (this.conn && this.conn.writable) {
        this.conn.write(message);
      } else {
        this.once('connect', function () {
          return _this3.conn.write(message);
        });
      }
    }
  }, {
    key: 'makePrioritized',
    value: function makePrioritized(message) {
      message[Symbol.for('priority')] = true;
      return message;
    }
  }, {
    key: 'isPrioritized',
    value: function isPrioritized(message) {
      return message[Symbol.for('priority')] === true;
    }

    /* General commands*/

  }, {
    key: 'peek',
    value: function peek(job, callback) {
      this.send(['peek', job], callback);
    }
  }, {
    key: 'peekReady',
    value: function peekReady(callback) {
      this.send(['peek-ready'], callback);
    }
  }, {
    key: 'peekBuried',
    value: function peekBuried(callback) {
      this.send(['peek-buried'], callback);
    }
  }, {
    key: 'peekDelayed',
    value: function peekDelayed(callback) {
      this.send(['peek-delayed'], callback);
    }
  }, {
    key: 'kick',
    value: function kick(count, callback) {
      this.send(['kick', count], callback);
    }
  }, {
    key: 'kickJob',
    value: function kickJob(job, callback) {
      this.send(['kick-job', job], callback);
    }
  }, {
    key: 'stats',
    value: function stats(callback) {
      this.send(['stats'], callback);
    }
  }, {
    key: 'statsJob',
    value: function statsJob(job, callback) {
      this.send(['stats-job', job], callback);
    }
  }, {
    key: 'statsTube',
    value: function statsTube(tube, callback) {
      this.send(['stats-tube', tube], callback);
    }
  }, {
    key: 'listTubes',
    value: function listTubes(callback) {
      this.send(['list-tubes'], callback);
    }
  }, {
    key: 'listTubesWatched',
    value: function listTubesWatched(callback) {
      this.send(['list-tubes-watched'], callback);
    }
  }, {
    key: 'listTubeUsed',
    value: function listTubeUsed(callback) {
      this.send(['list-tube-used'], callback);
    }
  }, {
    key: 'pauseTube',
    value: function pauseTube(tube, delay, callback) {
      this.send(['pause-tube', tube, delay], callback);
    }
  }, {
    key: 'quit',
    value: function quit(callback) {
      this.send(['quit'], callback);
    }
  }]);

  return Generic;
}(process.EventEmitter);

var Worker = exports.Worker = function (_Generic) {
  _inherits(Worker, _Generic);

  function Worker(port, host) {
    _classCallCheck(this, Worker);

    var _this4 = _possibleConstructorReturn(this, Object.getPrototypeOf(Worker).call(this, port, host));

    _this4.tubes = new Set();
    return _this4;
  }

  /**
   * Override parent function to automatically re-watch tubes if any have been
   * selected previously with .watch() or updated with .ignore()
   */

  _createClass(Worker, [{
    key: 'handleConnect',
    value: function handleConnect(callback) {
      var _this5 = this;

      if (this.tubes.size < 1) {
        return _get(Object.getPrototypeOf(Worker.prototype), 'handleConnect', this).call(this, callback);
      }

      var tubes = this.tubes.values();

      var nextTube = function nextTube() {
        var tube = tubes.next();

        if (tube.done) {
          return _get(Object.getPrototypeOf(Worker.prototype), 'handleConnect', _this5).call(_this5, callback);
        }

        _this5.send(_this5.makePrioritized(['watch', tube.value]), function (err) {
          if (err) {
            throw new Error('Failed to auto-rewatch tube');
          }

          nextTube();
        });
      };

      nextTube();
    }

    /**
     * Worker commands
     */

  }, {
    key: 'reserve',
    value: function reserve(callback) {
      this.send(['reserve'], callback);
    }
  }, {
    key: 'reserveWithTimeout',
    value: function reserveWithTimeout(timeout, callback) {
      this.send(['reserve-with-timeout', timeout], callback);
    }
  }, {
    key: 'release',
    value: function release(job, priority, delay, callback) {
      this.send(['release', job, priority, delay], callback);
    }
  }, {
    key: 'bury',
    value: function bury(job, priority, callback) {
      this.send(['bury', job, priority], callback);
    }
  }, {
    key: 'delete',
    value: function _delete(job, callback) {
      this.send(['delete', job], callback);
    }
  }, {
    key: 'touch',
    value: function touch(job, callback) {
      this.send(['touch', job], callback);
    }
  }, {
    key: 'watch',
    value: function watch(tube, callback) {
      var _this6 = this;

      this.send(['watch', tube], function (err, count) {
        if (err) {
          callback.call(_this6, err);
        } else {
          _this6.tubes.add(tube);
          callback.call(_this6, err, count);
        }
      });
    }
  }, {
    key: 'ignore',
    value: function ignore(tube, callback) {
      var _this7 = this;

      this.send(['ignore', tube], function (err, count) {
        if (err) {
          callback.call(_this7, err);
        } else {
          _this7.tubes.delete(tube);
          callback.call(_this7, err, count);
        }
      });
    }
  }]);

  return Worker;
}(Generic);

var Producer = exports.Producer = function (_Generic2) {
  _inherits(Producer, _Generic2);

  function Producer(port, host) {
    _classCallCheck(this, Producer);

    var _this8 = _possibleConstructorReturn(this, Object.getPrototypeOf(Producer).call(this, port, host));

    _this8.tube = undefined;
    return _this8;
  }

  /**
   * Override parent function to automatically reassign tube if one has been
   * selected previously with .use()
   */

  _createClass(Producer, [{
    key: 'handleConnect',
    value: function handleConnect(callback) {
      var _this9 = this;

      if (this.tube === undefined) {
        return _get(Object.getPrototypeOf(Producer.prototype), 'handleConnect', this).call(this, callback);
      }

      this.send(this.makePrioritized(['use', this.tube]), function (err) {
        if (err) {
          throw new Error('Failed to auto-reassign tube');
        }

        _get(Object.getPrototypeOf(Producer.prototype), 'handleConnect', _this9).call(_this9, callback);
      });
    }

    /**
     * Producer commands
     */

  }, {
    key: 'use',
    value: function use(tube, callback) {
      var _this10 = this;

      this.send(['use', tube], function (err, tube) {
        if (err) {
          callback.call(_this10, err);
        } else {
          // Stash tube for reconnects
          _this10.tube = tube;
          callback.call(_this10, err, tube);
        }
      });
    }
  }, {
    key: 'put',
    value: function put(body, opts, callback) {
      if ((typeof opts === 'undefined' ? 'undefined' : _typeof(opts)) !== 'object') {
        throw new Error('Missing options for put command');
      }

      var args = [];
      args.push(opts.priority === undefined ? 0 : opts.priority);
      args.push(opts.delay === undefined ? 0 : opts.delay);
      args.push(opts.ttr === undefined ? 10 : opts.ttr);

      return this.send(['put'].concat(args, [body]), callback);
    }
  }]);

  return Producer;
}(Generic);

