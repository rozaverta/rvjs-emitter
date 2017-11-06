
import Tools from "rvjs-tools";

let Cache = {};

const supportBlob = typeof Blob !== 'undefined';
const supportFile = typeof File !== 'undefined';

function getQueryString( object, prefix )
{
	return Object.keys(object).map(name => {
		let value = this.store[name];

		if( Tools.isScalar(value) ) {
			value = Tools.toString(value)
		}
		else if( prefix ) {
			value = ''
		}
		else {
			return getQueryString(value, name)
		}

		return encodeURIComponent( prefix ? (prefix + "[" + name + "]") : name ) + "=" + encodeURIComponent(value)
	}).join('&');
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
			get oldValue() { return oldValue }
		};

		fix.push(name);
		emit.subscribes.forEach(callback => {
			try {
				callback(e)
			}
			catch(e) {}
		});

		(index = fix.indexOf(name)) > -1 && fix.splice(index, 1)
	}
}

class Emitter
{
	constructor(data)
	{
		this.store = {};
		this.subscribes = [];
		this.dispatchers = [];

		if( arguments.length > 0 ) {
			if( typeof data !== 'object' || data === null ) {
				data = {}
			}
			this.fill(data)
		}
	}

	fill(data)
	{
		Object.keys(data).forEach(name => {
				this.store[name] = data[name]
		});
		return this
	}

	forEach(callback)
	{
		Object.keys(this.store).forEach(name => {
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
		let value;
		let form = new FormData();

		Object.keys( this.store ).forEach(name => {

			value = this.store[name];

			if( value === null || value === undefined ) {
				value = ''
			}

			else if( typeof value === 'object' ) { // array too

				if( Array.isArray(value) ) {

					// only for string array values
					// use default query array

					let append = [];
					for( let i = 0, length = value.length; i < length; i++ ) {

						if( Tools.isScalar(value[i]) ) {
							append[i] = Tools.toString(value[i])
						}
						else {
							append = getJson(value);
							break
						}
					}

					value = append
				}

				else {
					let raw = supportFile && value instanceof File || supportBlob && value instanceof Blob;
					if( ! raw ) {
						value = getJson(value);
					}
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
		return getQueryString(this.store, '')
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