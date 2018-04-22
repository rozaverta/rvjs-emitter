'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _rvjsTools = require('rvjs-tools');

var _rvjsTools2 = _interopRequireDefault(_rvjsTools);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Cache = {};

var supportBlob = typeof Blob !== 'undefined';
var supportFile = typeof File !== 'undefined';
var supportFormData = typeof FormData !== 'undefined';

function hasRaw(object) {
	return (typeof object === 'undefined' ? 'undefined' : _typeof(object)) === 'object' && (supportBlob && object instanceof Blob || supportFile && object instanceof File);
}

function queryString(value, name, key) {
	if (_rvjsTools2.default.isScalar(value)) {
		value = _rvjsTools2.default.toString(value);
	} else if (key !== name) {
		value = '';
	} else {
		return getQueryString(value, name);
	}

	return encodeURIComponent(key) + "=" + encodeURIComponent(value);
}

function getQueryString(object, prefix) {
	var array = [],
	    key = void 0;

	if (Array.isArray(object)) {
		for (var i = 0, length = object.length; i < length; i++) {
			key = i;
			if (prefix !== null) {
				key = prefix + '[]';
			}
			array.push(queryString(object[i], i, key));
		}
	} else {
		array = Object.keys(object).map(function (name) {
			key = name;
			if (prefix !== null) {
				key = prefix + '[' + key + ']';
			}
			return queryString(object[name], name, key);
		});
	}

	return array.join('&');
}

function getJson(value) {
	if (!supportBlob) {
		throw new Error("You browser is not support Blob data");
	}

	return new Blob([JSON.stringify(value)], { type: 'application/json' });
}

function dispatcher(emit, action, name, value, oldValue) {
	// fix recursive dispatch
	var fix = emit.dispatchers,
	    index = fix.indexOf(name);
	if (index < 0) {
		var e = {
			get action() {
				return action;
			},
			get name() {
				return name;
			},
			get value() {
				return value;
			},
			get oldValue() {
				return oldValue;
			},
			getObject: function getObject() {
				var obj = {};
				if (action !== 'delete') {
					obj[name] = value;
				}
				return obj;
			}
		};

		fix.push(name);
		emit.subscribes.forEach(function (callback) {
			try {
				callback.call(emit, e);
			} catch (err) {
				(0, _rvjsTools.Log)(err, "dispatch error");
			}
		});

		(index = fix.indexOf(name)) > -1 && fix.splice(index, 1);
	}
}

var regName = /^(.*?)\[(.*?)]$/;

// warning, pattern 'name[]' can create an invalid argument
function fromFormData(data) {
	var object = {},
	    result = {},
	    name = void 0,
	    m = void 0;

	var _iteratorNormalCompletion = true;
	var _didIteratorError = false;
	var _iteratorError = undefined;

	try {
		for (var _iterator = data.entries()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
			var entry = _step.value;

			name = entry[0];
			m = name.match(regName);
			if (m) {
				if (!object.hasOwnProperty(m[1])) {
					object[m[1]] = { array: true, index: 0, length: 0, keys: [], values: [] };
				}

				var obj = object[m[1]],
				    key = m[2];
				if (key.length < 1) {
					key = obj.index++;
				} else if (obj.array) {
					obj.array = false;
				}
				obj.keys[obj.length] = key;
				obj.values[obj.length++] = entry[1];
			} else {
				result[name] = entry[1];
			}
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

	Object.keys(object).forEach(function (name) {
		var obj = object[name];
		if (obj.array) {
			result[name] = obj.values;
		} else {
			result[name] = {};
			for (var i = 0; i < obj.length; i++) {
				result[name][obj.keys[i]] = obj.values[i];
			}
		}
	});

	return result;
}

var Emitter = function () {
	function Emitter(data) {
		_classCallCheck(this, Emitter);

		var self = this,
		    depth = 0,
		    listeners = [],
		    on = false;

		self.store = {};
		self.subscribes = [];
		self.dispatchers = [];

		// fill data
		(typeof data === 'undefined' ? 'undefined' : _typeof(data)) === 'object' && data !== null && self.fill(data);

		self.subscribeOn = function () {
			var type = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'value';

			if (on) {
				self.off(on);
			}

			self.on(on = function on(e) {
				self.dispatch({
					type: type,
					action: e.action, name: e.name, value: e.value, oldValue: e.oldValue
				});
			});

			return function unsubscribe() {
				if (on) {
					self.off(on);
					on = false;
				}
			};
		};

		self.subscribe = function (listener) {
			if (typeof listener !== 'function') {
				throw new Error('Expected listener to be a function');
			}

			var index = listeners.indexOf(listener);
			if (index < 0) {
				listeners.push(listener);
			}

			return function unsubscribe() {
				var index = listeners.indexOf(listener);
				if (~index) {
					listeners.splice(index, 1);
				}
			};
		};

		self.dispatch = function (action) {
			if ((typeof action === 'undefined' ? 'undefined' : _typeof(action)) !== 'object') {
				throw new Error('Actions must be object');
			}

			if (typeof action.type !== 'string') {
				throw new Error('Actions "type" property must be string');
			}

			if (depth > 10) {
				throw new Error('Can\'t dispatch actions, depth limit');
			}

			depth++;
			var i = 0,
			    copy = listeners.slice(0),
			    prevent = false,
			    stop = false,
			    e = {
				get part() {
					return i + 1;
				},
				get parts() {
					return copy.length;
				},
				get detail() {
					return action;
				},
				isDefaultPrevented: function isDefaultPrevented() {
					return prevent;
				},
				isPropagationStopped: function isPropagationStopped() {
					return stop;
				},
				preventDefault: function preventDefault() {
					prevent = true;
				},
				stopPropagation: function stopPropagation() {
					stop = true;
				}
			};

			for (var _i = 0; _i < copy.length; _i++) {
				try {
					copy[_i].call(self, action, e);
				} catch (err) {
					(0, _rvjsTools.Log)(err, "dispatch actions error");
				}
				if (stop) {
					break;
				}
			}

			depth--;

			return action;
		};
	}

	_createClass(Emitter, [{
		key: 'keys',
		value: function keys() {
			return Object.keys(this.store);
		}
	}, {
		key: 'fill',
		value: function fill(data) {
			var _this = this;

			if (supportFormData && FormData.prototype.isPrototypeOf(data)) {
				data = fromFormData(data);
			}
			Object.keys(data).forEach(function (name) {
				_this.store[name] = data[name];
			});
			return this;
		}
	}, {
		key: 'forEach',
		value: function forEach(callback) {
			var _this2 = this;

			this.keys().forEach(function (name) {
				callback(_this2.store[name], name);
			});
			return this;
		}
	}, {
		key: 'set',
		value: function set(name, value) {
			var dispatch = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;

			var self = this,
			    action = self.has(name) ? 'update' : 'create',
			    oldValue = action === 'create' ? null : self.store[name];

			if (typeof value === 'undefined' || value === null) {
				if (action === 'create') {
					return self;
				} else {
					action = 'delete';
					value = null;
				}
			}

			if (action === 'create' && !name || action === 'update' && oldValue === value) {
				return self;
			} else if (action === 'delete') {
				delete self.store[name];
			} else {
				self.store[name] = value;
			}

			dispatch && self.subscribes.length && dispatcher(self, action, name, value, oldValue);

			return self;
		}
	}, {
		key: 'get',
		value: function get(name) {
			return this.has(name) ? this.store[name] : null;
		}
	}, {
		key: 'has',
		value: function has(name) {
			return this.store.hasOwnProperty(name);
		}
	}, {
		key: 'on',
		value: function on(callback) {
			var self = this;
			if (typeof callback === 'function' && self.subscribes.indexOf(callback) < 0) {
				self.subscribes.push(callback);
			}
			return self;
		}
	}, {
		key: 'off',
		value: function off(callback) {
			var self = this;
			if (typeof callback === 'function') {
				var index = self.subscribes.indexOf(callback);
				if (~index) {
					self.subscribes.splice(index, 1);
				}
			}
			return self;
		}
	}, {
		key: 'toArray',
		value: function toArray() {
			var _this3 = this;

			return Object.keys(this.store).map(function (name) {
				return {
					name: name,
					value: _this3.store[name]
				};
			});
		}
	}, {
		key: 'toFormData',
		value: function toFormData() {
			var form = new FormData();

			this.forEach(function (value, name) {

				// This option is not possible if you use class methods
				if (value === null || value === undefined) {
					value = '';
				} else if ((typeof value === 'undefined' ? 'undefined' : _typeof(value)) === 'object') {
					// array too

					var array = Array.isArray(value),
					    remap = [],
					    raw = !array && hasRaw(value),
					    add = function add(key, value) {
						if (hasRaw(key, value)) remap.push(key, value, true);else if (_rvjsTools2.default.isScalar(value)) remap.push(key, value, false);else array = false;
						return array;
					};

					if (array) {

						// only for string array values
						// use default query array

						var arrayName = name + '[]';
						for (var i = 0, length = value.length; i < length; i++) {
							if (!add(arrayName, value[i])) break;
						}
					} else if (!raw) {
						array = true;
						Object.keys(value).some(function (key) {
							return !add(name + "[" + key + "]", value[key]);
						});
					}

					if (array) {
						for (var _i2 = 0, _length = remap.length; _i2 < _length; _i2 += 3) {
							form.append(remap[_i2], remap[_i2 + 2] ? remap[_i2 + 1] : _rvjsTools2.default.toString(remap[_i2 + 1]));
						}
						return void 0;
					} else if (!raw) {
						value = getJson(value);
					}
				} else if (typeof value === 'boolean') {
					value = value ? '1' : '0';
				} else {
					value = _rvjsTools2.default.toString(value);
				}

				form.append(name, value);
			});

			return form;
		}
	}, {
		key: 'toQueryString',
		value: function toQueryString() {
			return getQueryString(this.store, null);
		}

		/**
   *
   * @param {*} prop
   * @returns {Emitter}
   */

	}], [{
		key: 'create',
		value: function create(prop) {
			if (!arguments.length) {
				return new Emitter();
			}

			if (prop instanceof Emitter) {
				return prop;
			}

			var tof = typeof prop === 'undefined' ? 'undefined' : _typeof(prop);

			if (tof === 'number') {
				prop += '';
				tof = 'string';
			}

			if (tof === 'string' || tof === 'symbol') {
				if (!Cache.hasOwnProperty(prop)) {
					Cache[prop] = new Emitter();
				}
				return Cache[prop];
			}

			return new Emitter(prop);
		}
	}]);

	return Emitter;
}();

exports.default = Emitter;