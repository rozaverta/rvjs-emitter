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
	var _this = this;

	return Object.keys(object).map(function (name) {
		var value = _this.store[name];

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
		key: 'fill',
		value: function fill(data) {
			var _this2 = this;

			Object.keys(data).forEach(function (name) {
				_this2.store[name] = data[name];
			});
			return this;
		}
	}, {
		key: 'forEach',
		value: function forEach(callback) {
			var _this3 = this;

			Object.keys(this.store).forEach(function (name) {
				callback(_this3.store[name], name);
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
			var _this4 = this;

			return Object.keys(this.store).map(function (name) {
				return {
					name: name,
					value: _this4.store[name]
				};
			});
		}
	}, {
		key: 'toFormData',
		value: function toFormData() {
			var _this5 = this;

			var value = void 0;
			var form = new FormData();

			Object.keys(this.store).forEach(function (name) {

				value = _this5.store[name];

				if (value === null || value === undefined) {
					value = '';
				} else if ((typeof value === 'undefined' ? 'undefined' : _typeof(value)) === 'object') {
					// array too

					if (Array.isArray(value)) {

						// only for string array values
						// use default query array

						var append = [];
						for (var i = 0, length = value.length; i < length; i++) {

							if (_rvjsTools2.default.isScalar(value[i])) {
								append[i] = _rvjsTools2.default.toString(value[i]);
							} else {
								append = getJson(value);
								break;
							}
						}

						value = append;
					} else {
						var raw = supportFile && value instanceof File || supportBlob && value instanceof Blob;
						if (!raw) {
							value = getJson(value);
						}
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