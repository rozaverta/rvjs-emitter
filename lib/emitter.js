
import Tools, {Log} from "rvjs-tools";

let Cache = {};

const supportBlob = typeof Blob !== 'undefined';
const supportFile = typeof File !== 'undefined';
const supportFormData = typeof FormData !== 'undefined';

function hasRaw(object)
{
	return typeof object === 'object' && (supportBlob && object instanceof Blob || supportFile && object instanceof File);
}

function queryString(value, name, key)
{
	if( Tools.isScalar(value) ) {
		value = Tools.toString(value)
	}
	else if( key !== name ) {
		value = ''
	}
	else {
		return getQueryString(value, name)
	}

	return encodeURIComponent(key) + "=" + encodeURIComponent(value)
}

function getQueryString( object, prefix )
{
	let array = [], key;

	if( Array.isArray(object) ) {
		for( let i = 0, length = object.length; i < length; i++ ) {
			key = i;
			if( prefix !== null ) {
				key = prefix + '[]';
			}
			array.push(queryString(object[i], i, key))
		}
	}
	else {
		array = Object.keys(object).map(name => {
			key = name;
			if( prefix !== null ) {
				key = prefix + '[' + key + ']';
			}
			return queryString(object[name], name, key)
		})
	}

	return array.join('&');
}

function getJson( value )
{
	if( ! supportBlob ) {
		throw new Error("You browser is not support Blob data")
	}

	return new Blob([ JSON.stringify(value) ], {type : 'application/json'});
}

function dispatcher( emit, action, name, value, oldValue )
{
	// fix recursive dispatch
	let fix = emit.dispatchers, index = fix.indexOf(name);
	if( index < 0 )
	{
		let e = {
			get action() { return action },
			get name() { return name },
			get value() { return value },
			get oldValue() { return oldValue },
			getObject() {
				let obj = {};
				if(action !== 'delete') {
					obj[name] = value;
				}
				return obj
			}
		};

		fix.push(name);
		emit.subscribes.forEach(callback => {
			try {
				callback.call(emit, e)
			}
			catch(err) {
				Log(err, "dispatch error")
			}
		});

		(index = fix.indexOf(name)) > -1 && fix.splice(index, 1)
	}
}

const regName = /^(.*?)\[(.*?)]$/;

// warning, pattern 'name[]' can create an invalid argument
function fromFormData(data)
{
	let object = {}, result = {}, name, m;

	for(let entry of data.entries()) {
		name = entry[0];
		m = name.match(regName);
		if(m) {
			if( ! object.hasOwnProperty(m[1]) ) {
				object[m[1]] = {array: true, index: 0, length: 0, keys: [], values: []};
			}

			let obj = object[m[1]], key = m[2];
			if( key.length < 1 ) {
				key = obj.index ++;
			}
			else if( obj.array ) {
				obj.array = false
			}
			obj.keys[obj.length] = key;
			obj.values[obj.length++] = entry[1]
		}
		else {
			result[name] = entry[1];
		}
	}

	Object.keys(object).forEach(name => {
		let obj = object[name];
		if( obj.array ) {
			result[name] = obj.values;
		}
		else {
			result[name] = {};
			for( let i = 0; i < obj.length; i++ ) {
				result[name][ obj.keys[i] ] = obj.values[i]
			}
		}
	});

	return result;
}

class Emitter
{
	constructor(data)
	{
		let self = this, depth = 0, listeners = [], on = false;

		self.store = {};
		self.subscribes = [];
		self.dispatchers = [];

		// fill data
		typeof data === 'object' && data !== null && self.fill(data);

		self.subscribeOn = function(type = 'value')
		{
			if( on ) {
				self.off(on)
			}

			self.on(on = e => {
				self.dispatch({
					type: type,
					action: e.action, name: e.name, value: e.value, oldValue: e.oldValue
				})
			});

			return function unsubscribe() {
				if( on ) {
					self.off(on);
					on = false
				}
			}
		};

		self.subscribe = function(listener)
		{
			if (typeof listener !== 'function') {
				throw new Error('Expected listener to be a function')
			}

			let index = listeners.indexOf(listener);
			if( index < 0 ) {
				listeners.push(listener)
			}

			return function unsubscribe() {
				let index = listeners.indexOf(listener);
				if( ~ index ) {
					listeners.splice(index, 1);
				}
			}
		};

		self.dispatch = function(action)
		{
			if( typeof action !== 'object' ) {
				throw new Error('Actions must be object')
			}

			if(typeof action.type !== 'string') {
				throw new Error('Actions "type" property must be string')
			}

			if(depth > 10) {
				throw new Error('Can\'t dispatch actions, depth limit')
			}

			depth ++;
			let i = 0,
				copy = listeners.slice(0),
				prevent = false,
				stop = false,
				e = {
					get part()  { return i + 1 },
					get parts() { return copy.length },
					get detail() { return action },
					isDefaultPrevented() { return prevent },
					isPropagationStopped() { return stop },
					preventDefault() { prevent = true },
					stopPropagation() { stop = true }
				};

			for (let i = 0; i < copy.length; i++) {
				try {
					copy[i].call(self, action, e)
				}
				catch(err) {
					Log(err, "dispatch actions error")
				}
				if(stop) {
					break
				}
			}

			depth --;

			return action
		};
	}

	keys()
	{
		return Object.keys(this.store)
	}

	fill(data)
	{
		if( supportFormData && FormData.prototype.isPrototypeOf(data) ) {
			data = fromFormData(data)
		}
		Object.keys(data).forEach(name => {
			this.store[name] = data[name]
		});
		return this
	}

	forEach(callback)
	{
		this.keys().forEach(name => {
				callback(this.store[name], name)
		});
		return this
	}

	set(name, value, dispatch = true)
	{
		let self = this, action = self.has(name) ? 'update' : 'create', oldValue = action === 'create' ? null : self.store[name];

		if( typeof value === 'undefined' || value === null ) {
			if( action === 'create' ) {
				return self
			}
			else {
				action = 'delete';
				value = null
			}
		}

		if( action === 'create' && ! name || action === 'update' && oldValue === value ) {
			return self
		}
		else if( action === 'delete' ) {
			delete self.store[name]
		}
		else {
			self.store[name] = value
		}

		dispatch && self.subscribes.length && dispatcher(self, action, name, value, oldValue);

		return self
	}

	get(name)
	{
		return this.has(name) ? this.store[name] : null
	}

	has(name)
	{
		return this.store.hasOwnProperty(name)
	}

	on(callback)
	{
		let self = this;
		if( typeof callback === 'function' && self.subscribes.indexOf(callback) < 0 ) {
			self.subscribes.push(callback)
		}
		return self
	}

	off(callback)
	{
		let self = this;
		if( typeof callback === 'function' ) {
			let index = self.subscribes.indexOf(callback);
			if( ~ index ) {
				self.subscribes.splice(index, 1)
			}
		}
		return self
	}

	toArray()
	{
		return Object.keys(this.store).map(name => {
			return {
				name: name,
				value: this.store[name]
			}
		})
	}

	toFormData()
	{
		let form = new FormData();

		this.forEach((value, name) => {

			// This option is not possible if you use class methods
			if( value === null || value === undefined ) {
				value = ''
			}

			else if( typeof value === 'object' ) { // array too

				let array = Array.isArray(value),
					remap = [],
					raw = ! array && hasRaw(value),
					add = (key, value) => {
						if( hasRaw(key, value) ) remap.push(key, value, true);
						else if( Tools.isScalar(value) ) remap.push(key, value, false);
						else array = false;
						return array
					};

				if( array ) {

					// only for string array values
					// use default query array

					let arrayName = name + '[]';
					for( let i = 0, length = value.length; i < length; i++ ) {
						if( ! add(arrayName, value[i]) ) break
					}
				}

				else if( ! raw ) {
					array = true;
					Object.keys(value).some(key => ! add(name + "[" + key + "]", value[key]));
				}

				if( array ) {
					for( let i = 0, length = remap.length; i < length; i += 3 ) {
						form.append(remap[i], remap[i+2] ? remap[i+1] : Tools.toString(remap[i+1]))
					}
					return void 0;
				}
				else if( ! raw ) {
					value = getJson(value);
				}
			}
			else if( typeof value === 'boolean' ) {
				value = value ? '1' : '0'
			}
			else {
				value = Tools.toString( value )
			}

			form.append(name, value)
		});

		return form;
	}

	toQueryString()
	{
		return getQueryString(this.store, null)
	}

	/**
	 *
	 * @param {*} prop
	 * @returns {Emitter}
	 */
	static create( prop )
	{
		if( !arguments.length ) {
			return new Emitter();
		}

		if( prop instanceof Emitter ) {
			return prop;
		}

		let tof = typeof prop;

		if( tof === 'number' ) {
			prop += '';
			tof = 'string'
		}

		if( tof === 'string' || tof === 'symbol' ) {
			if( !Cache.hasOwnProperty(prop) ) {
				Cache[prop] = new Emitter();
			}
			return Cache[prop]
		}

		return new Emitter(prop);
	}
}

export default Emitter