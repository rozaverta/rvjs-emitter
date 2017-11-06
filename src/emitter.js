'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _rvjsTools = require('rvjs-tools');

var _rvjsTools2 = _interopRequireDefault(_rvjsTools);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Cache = {};

var supportBlob = typeof Blob !== 'undefined';
var supportFile = typeof File !== 'undefined';

function getQueryString(object, prefix) {
	return Object.keys(object).map(function (name) {
		var value = object[name];

		if (_rvjsTools2.default.isScalar(value)) {
			value = _rvjsTools2.default.toString(value);
		} else if (prefix) {
			value = '';
		} else {
			return getQueryString(value, name);
		}

		return encodeURIComponent(prefix ? prefix + "[" + name + "]" : name) + "=" + encodeURIComponent(value);
	}).join('&');
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
			}
		};

		fix.push(name);
		emit.subscribes.forEach(function (callback) {
			try {
				callback(e);
			} catch (e) {}
		});

		(index = fix.indexOf(name)) > -1 && fix.splice(index, 1);
	}
}

var Emitter = function () {
	function Emitter(data) {
		_classCallCheck(this, Emitter);

		this.store = {};
		this.subscribes = [];
		this.dispatchers = [];

		if (arguments.length > 0) {
			if ((typeof data === 'undefined' ? 'undefined' : _typeof(data)) !== 'object' || data === null) {
				data = {};
			}
			this.fill(data);
		}
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
					    raw = !array && (supportFile && value instanceof File || supportBlob && value instanceof Blob);

					if (array) {

						// only for string array values
						// use default query array

						var arrayName = name + '[]';
						for (var i = 0, length = value.length; i < length; i++) {

							if (_rvjsTools2.default.isScalar(value[i])) {
								remap.push(arrayName, value[i]);
							} else {
								array = false;
								break;
							}
						}
					} else if (!raw) {
						array = true;
						Object.keys(value).some(function (key) {
							if (_rvjsTools2.default.isScalar(value[key])) {
								remap.push(name + "[" + key + "]", value[key]);
							} else {
								array = false;
								return false;
							}
						});
					}

					if (array) {
						for (var _i = 0, _length = remap.length; _i < _length; _i += 2) {
							form.append(remap[_i], _rvjsTools2.default.toString(remap[_i + 1]));
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
			return getQueryString(this.store, '');
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