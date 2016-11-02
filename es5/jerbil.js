'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Producer = exports.Worker = exports.Generic = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _net = require('net');

var _net2 = _interopRequireDefault(_net);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _msgpackLite = require('msgpack-lite');

var _msgpackLite2 = _interopRequireDefault(_msgpackLite);

var _jsYaml = require('js-yaml');

var _jsYaml2 = _interopRequireDefault(_jsYaml);

var _doubleEndedQueue = require('double-ended-queue');

var _doubleEndedQueue2 = _interopRequireDefault(_doubleEndedQueue);

var _spec = require('./spec');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var CRLF = new Buffer('\r\n');

var Generic = exports.Generic = function (_EventEmitter) {
  _inherits(Generic, _EventEmitter);

  function Generic(port, host) {
    _classCallCheck(this, Generic);

    var _this = _possibleConstructorReturn(this, (Generic.__proto__ || Object.getPrototypeOf(Generic)).call(this));

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

      var callback = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : function () {};

      this.disconnected = false;
      this.conn = _net2.default.createConnection(this.port, this.host);
      this.conn.setKeepAlive(true);
      this.conn.on('connect', function () {
        return _this2._handleConnect(callback);
      });
      this.conn.on('data', function (data) {
        return _this2._handleResponse(data);
      });
      this.conn.on('close', function () {
        return !_this2.disconnected && _this2.connect();
      });
    }
  }, {
    key: '_handleConnect',
    value: function _handleConnect(callback) {
      this.emit('connect');
      setImmediate(function () {
        callback(null);
      });
    }
  }, {
    key: 'disconnect',
    value: function disconnect() {
      var _this3 = this;

      var callback = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : function () {};

      var err = null;

      if (this.disconnected) {
        return callback(err);
      }

      try {
        this.conn.destroy();
      } catch (e) {
        err = e;
      }

      this.disconnected = true;
      this.queue.toArray().forEach(function (responseObj) {
        responseObj.callback.call(_this3, new Error('Disconnected'));
      });
      this.queue = new _doubleEndedQueue2.default();

      callback(err);
    }
  }, {
    key: '_handleResponse',
    value: function _handleResponse(responseData) {
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
          responseArgs.push(_msgpackLite2.default.decode(body));
        }

        // Advance separator index for continuing batch processing
        separatorIndex = responseData.indexOf(CRLF, start);
      }

      message.callback.apply(this, responseArgs);

      if (responseData.indexOf(CRLF, separatorIndex + CRLF.length) !== -1) {
        // Continue processing batch response
        this._handleResponse(responseData.slice(separatorIndex + CRLF.length));
      }
    }
  }, {
    key: '_createMessage',
    value: function _createMessage(command, args) {
      var message = void 0;

      if (command === 'put') {
        // Message must have a body
        var body = this.raw ? new Buffer(args.pop()) : _msgpackLite2.default.encode(args.pop());
        var head = new Buffer(args.join(' ') + ' ' + body.length);
        message = Buffer.concat([head, CRLF, body, CRLF]);
      } else {
        message = new Buffer('' + args.join(' ') + CRLF.toString());
      }

      return message;
    }
  }, {
    key: '_validateArgs',
    value: function _validateArgs(args) {
      var command = args[0];
      var commandSpec = _spec.commandSpecs[command];

      if (commandSpec === undefined) {
        throw new Error('Unexpected command: ' + command);
      }

      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = commandSpec.entries()[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var _step2$value = _slicedToArray(_step2.value, 2),
              index = _step2$value[0],
              arg = _step2$value[1];

          var _arg = _slicedToArray(arg, 2),
              name = _arg[0],
              re = _arg[1];

          var cArg = args[++index];
          if (cArg === undefined || !re.test(cArg)) {
            throw new Error('Expected argument ' + index + ' (' + name + ') to match: ' + re.source);
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
    }
  }, {
    key: 'sendCommand',
    value: function sendCommand(args, callback) {
      var _this4 = this;

      if (this.disconnected) {
        throw new Error('Connection has been closed by user');
      }

      this._validateArgs(args);

      if (!(this.conn && this.conn.writable)) {
        return this.once('connect', function () {
          return _this4.sendCommand(args, callback);
        });
      }

      var command = args[0];
      var responseObj = Object.assign({ command: command, callback: callback }, _spec.responseSpecs[command]);

      if (this._isPrioritized(args)) {
        // Prioritizing message
        this.queue.unshift(responseObj);
      } else {
        this.queue.push(responseObj);
      }

      this.conn.write(this._createMessage(command, args));
    }
  }, {
    key: '_makePrioritized',
    value: function _makePrioritized(message) {
      message[Symbol.for('priority')] = true;
      return message;
    }
  }, {
    key: '_isPrioritized',
    value: function _isPrioritized(message) {
      return message[Symbol.for('priority')] === true;
    }

    /* General commands*/

  }, {
    key: 'peek',
    value: function peek(job, callback) {
      this.sendCommand(['peek', job], callback);
    }
  }, {
    key: 'peekReady',
    value: function peekReady(callback) {
      this.sendCommand(['peek-ready'], callback);
    }
  }, {
    key: 'peekBuried',
    value: function peekBuried(callback) {
      this.sendCommand(['peek-buried'], callback);
    }
  }, {
    key: 'peekDelayed',
    value: function peekDelayed(callback) {
      this.sendCommand(['peek-delayed'], callback);
    }
  }, {
    key: 'kick',
    value: function kick(count, callback) {
      this.sendCommand(['kick', count], callback);
    }
  }, {
    key: 'kickJob',
    value: function kickJob(job, callback) {
      this.sendCommand(['kick-job', job], callback);
    }
  }, {
    key: 'stats',
    value: function stats(callback) {
      this.sendCommand(['stats'], callback);
    }
  }, {
    key: 'statsJob',
    value: function statsJob(job, callback) {
      this.sendCommand(['stats-job', job], callback);
    }
  }, {
    key: 'statsTube',
    value: function statsTube(tube, callback) {
      this.sendCommand(['stats-tube', tube], callback);
    }
  }, {
    key: 'listTubes',
    value: function listTubes(callback) {
      this.sendCommand(['list-tubes'], callback);
    }
  }, {
    key: 'listTubesWatched',
    value: function listTubesWatched(callback) {
      this.sendCommand(['list-tubes-watched'], callback);
    }
  }, {
    key: 'listTubeUsed',
    value: function listTubeUsed(callback) {
      this.sendCommand(['list-tube-used'], callback);
    }
  }, {
    key: 'pauseTube',
    value: function pauseTube(tube, delay, callback) {
      this.sendCommand(['pause-tube', tube, delay], callback);
    }
  }, {
    key: 'quit',
    value: function quit(callback) {
      this.sendCommand(['quit'], callback);
    }
  }]);

  return Generic;
}(_events2.default);

var Worker = exports.Worker = function (_Generic) {
  _inherits(Worker, _Generic);

  function Worker(port, host) {
    _classCallCheck(this, Worker);

    var _this5 = _possibleConstructorReturn(this, (Worker.__proto__ || Object.getPrototypeOf(Worker)).call(this, port, host));

    _this5.tubes = new Set();
    return _this5;
  }

  /**
   * Override parent function to automatically re-watch tubes if any have been
   * selected previously with .watch() or updated with .ignore()
   */

  _createClass(Worker, [{
    key: '_handleConnect',
    value: function _handleConnect(callback) {
      var _this6 = this;

      if (this.tubes.size < 1) {
        return _get(Worker.prototype.__proto__ || Object.getPrototypeOf(Worker.prototype), '_handleConnect', this).call(this, callback);
      }

      var tubes = this.tubes.values();

      var nextTube = function nextTube() {
        var tube = tubes.next();

        if (tube.done) {
          return _get(Worker.prototype.__proto__ || Object.getPrototypeOf(Worker.prototype), '_handleConnect', _this6).call(_this6, callback);
        }

        _this6.sendCommand(_this6._makePrioritized(['watch', tube.value]), function (err) {
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
      this.sendCommand(['reserve'], callback);
    }
  }, {
    key: 'reserveWithTimeout',
    value: function reserveWithTimeout(timeout, callback) {
      this.sendCommand(['reserve-with-timeout', timeout], callback);
    }
  }, {
    key: 'release',
    value: function release(job, priority, delay, callback) {
      this.sendCommand(['release', job, priority, delay], callback);
    }
  }, {
    key: 'bury',
    value: function bury(job, priority, callback) {
      this.sendCommand(['bury', job, priority], callback);
    }
  }, {
    key: 'delete',
    value: function _delete(job, callback) {
      this.sendCommand(['delete', job], callback);
    }
  }, {
    key: 'touch',
    value: function touch(job, callback) {
      this.sendCommand(['touch', job], callback);
    }
  }, {
    key: 'watch',
    value: function watch(tube, callback) {
      var _this7 = this;

      this.sendCommand(['watch', tube], function (err, count) {
        if (err) {
          callback.call(_this7, err);
        } else {
          _this7.tubes.add(tube);
          callback.call(_this7, err, count);
        }
      });
    }
  }, {
    key: 'ignore',
    value: function ignore(tube, callback) {
      var _this8 = this;

      this.sendCommand(['ignore', tube], function (err, count) {
        if (err) {
          callback.call(_this8, err);
        } else {
          _this8.tubes.delete(tube);
          callback.call(_this8, err, count);
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

    var _this9 = _possibleConstructorReturn(this, (Producer.__proto__ || Object.getPrototypeOf(Producer)).call(this, port, host));

    _this9.tube = undefined;
    return _this9;
  }

  /**
   * Override parent function to automatically reassign tube if one has been
   * selected previously with .use()
   */

  _createClass(Producer, [{
    key: '_handleConnect',
    value: function _handleConnect(callback) {
      var _this10 = this;

      if (this.tube === undefined) {
        return _get(Producer.prototype.__proto__ || Object.getPrototypeOf(Producer.prototype), '_handleConnect', this).call(this, callback);
      }

      this.sendCommand(this._makePrioritized(['use', this.tube]), function (err) {
        if (err) {
          throw new Error('Failed to auto-reassign tube');
        }

        _get(Producer.prototype.__proto__ || Object.getPrototypeOf(Producer.prototype), '_handleConnect', _this10).call(_this10, callback);
      });
    }

    /**
     * Producer commands
     */

  }, {
    key: 'use',
    value: function use(tube, callback) {
      var _this11 = this;

      this.sendCommand(['use', tube], function (err, tube) {
        if (err) {
          callback.call(_this11, err);
        } else {
          // Stash tube for reconnects
          _this11.tube = tube;
          callback.call(_this11, err, tube);
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

      return this.sendCommand(['put'].concat(args, [body]), callback);
    }
  }]);

  return Producer;
}(Generic);