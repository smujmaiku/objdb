/*!
 * Object DB <https://github.com/smujmaiku/objdb>
 * Copyright(c) 2017-2019 Michael Szmadzinski
 * MIT Licensed
 */

class ObjDb {
	/**
	 * @param {Object} conf
	 * @param {Object} conf.db
	 * @param {Object} conf.meta
	 * @param {Function} debug
	 */
	constructor(conf, debug) {
		this._conf = Object.assign({
			expire: 6e5,
		}, conf);
		this._debug = debug;
		this._data = this._conf.data || {};
		this._meta = this._conf.meta || {};
		delete this._conf.data;
		delete this._conf.meta;
		this._on$data = [];

		setInterval(() => this.upkeep(), conf.upkeep || 6e4);
		this.upkeep();
	}

	/**
	 * @param {*} a
	 * @param {*} b
	 * @returns {boolean}
	 */
	static isEqual(a, b) {
		if (a === b) return true;
		if (this.getType(a) !== this.getType(b)) return false;
		if (a instanceof Array) {
			if (a.length !== b.length) return false;
			return a.every((v, i) => this.isEqual(v, b[i]));
		} else if (a instanceof Object) {
			if (!this.isEqual(Object.keys(a).sort(), Object.keys(b).sort())) return false;
			return Object.entries(a).every(([k, v]) => this.isEqual(v, b[k]));
		}
		return false;
	}

	/**
	 * @param {*} data
	 * @returns {string} type
	 */
	static getType(data) {
		if (data instanceof Array) return 'array';
		if (data instanceof Object) return 'object';
		if (data === null) data = undefined;
		return typeof data;
	}

	/**
	 * @param {*} data
	 * @returns {Array} keys
	 */
	static getKeys(data) {
		if (!(data instanceof Object)) return [];
		return Object.keys(data);
	}

	/**
	 * @param {*} data
	 * @returns {number} size
	 */
	static getSize(data) {
		return this.getKeys(data).length;
	}

	static get(name, db) {
		let [key, meta] = name.split('$');
		let cDb = db;
		key.split('.')
			.filter((k, i) => i > 0 || !!k)
			.forEach(k => { cDb = (cDb || {})[k]; });
		if (!meta) return cDb;
		if (meta === 'keys') return this.getKeys(cDb);
		if (meta === 'type') return this.getType(cDb);
		if (meta === 'size') return this.getSize(cDb);
		return undefined;
	}

	/**
	 * @param {string} name
	 * @param {*} data
	 * @param {Object} db
	 */
	static set(name, data, db) {
		if (name instanceof Object) {
			Object.entries(name).forEach(([k, d]) => {
				if (k.indexOf('$') >= 0) return;
				this.set(k, d, data);
			});
		}
		if (typeof name !== 'string') return;

		if (this.getType(data) === 'undefined') {
			this.del(name, db);
			return;
		}

		let cDb = db;
		name.split('.').forEach((n, i, a) => {
			if (i < a.length - 1) {
				cDb = cDb[n] = cDb[n] instanceof Object ? cDb[n] || {} : {};
			} else {
				cDb[n] = data;
			}
		});
	}

	/**
	 * @param {string|Array} names
	 * @param {Object} db
	 * @returns {number|Array}
	 */
	static del(names, db) {
		if (!(names instanceof Array)) return this.del([names], db).length > 0;

		return names.filter((name) => {
			let removed;
			let cDb = db;
			name.split('.').forEach((n, i, a) => {
				if (i < a.length - 1) {
					cDb = cDb[n] || {};
				} else if (cDb[n] !== undefined) {
					delete cDb[n];
					removed = true;
				}
			});

			if (!removed) return false;

			let pName = name.split('.').slice(0, -1).join('.');
			if (pName) {
				let pData = this.get(pName, db);
				if (this.getSize(pData) < 1) this.del(pName, db);
			}

			return true;
		});
	}

	static restore(stream, cb) {
		if (typeof stream === 'string') {
			stream = require('fs').createReadStream(stream, 'utf8');
			return this.restore(stream, cb);
		}

		let body = '';
		let promises = [];

		const read = (done) => {
			body.split('\n').forEach((v, i, a) => {
				if (i + 1 >= a.length && !done) {
					body = v;
					return;
				}
				if (!v) return;
				promises.push(cb(JSON.parse(v)));
			});
			if (done) body = '';
		};

		return new Promise((resolve, reject) => {
			stream.setEncoding('utf8');

			stream.on('data', (chunk) => {
				body += chunk;
				read();
			});

			stream.on('error', reject);

			stream.on('end', () => {
				read(true);
				resolve(promises.length > 0 ? Promise.all(promises) : []);
			});
		});
	}

	static backup(stream, list, cb) {
		if (typeof stream === 'string') {
			stream = require('fs').createWriteStream(stream, 'utf8');
			let streamerr;
			return this.backup(stream, list, cb)
				.catch(err => { streamerr = err; })
				.then(() => {
					stream.end();
					if (streamerr) return Promise.reject(streamerr);
				});
		}

		list = [].concat(list || []);
		cb = cb || (v => v);

		const next = () => new Promise((resolve, reject) => {
			if (list.length < 1) return resolve();
			let row = list.pop();

			Promise.resolve(cb(row)).then((row) => {
				let chunk = JSON.stringify(row);
				stream.write(`${chunk}\n`, 'utf8', (err) => {
					if (err) return reject(err);
					next().then(resolve, reject);
				});
			}).catch(reject);
		});

		return next();
	}

	debug() {
		if (this._debug) return this._debug.apply(this._debug, arguments);
	}

	get data() {
		return this._data;
	}

	on(name, cb) {
		if (name instanceof Array) return name.forEach(n => this.on(n, cb));
		if (!name || typeof name !== 'string') return;
		if (name.match(/[\s,]/)) return name.split(/[\s,]/g).forEach(n => this.on(n, cb));
		if (cb instanceof Function) {
			this['_on' + name] = (this['_on' + name] || []);
			this['_on' + name].push(cb);
		}

		return this.once(name, cb);
	}

	once(name, cb) {
		cb(this.get(name));
		return this;
	}

	off(name, cb) {
		if (cb instanceof Function && this['_on' + name] instanceof Array) {
			this['_on' + name] = this['_on' + name].filter((v) => {
				return v !== cb;
			});
		} else if (typeof name === 'string') {
			this['_on' + name] = [];
		} else if (name === true) {
			Object.keys(this).forEach((key) => {
				if (key.search(/^_on/) === 0) {
					this[key] = [];
				}
			});
		}

		return this;
	}

	emit(name, data) {
		const get = this.get.bind(this, name);

		if (typeof name !== 'string') return this;

		const _send = () => {
			data = arguments.length > 1 ? data : get();
			let keys = Object.keys(data || {});
			(this[`_on${name}`] || []).forEach(cb => cb.call(this, data));
			(this[`_on${name}$keys`] || []).forEach(cb => cb.call(this, keys));
		};

		clearTimeout(this[`_emit${name}`]);
		if (arguments.length > 1) {
			_send();
		} else {
			this[`_emit${name}`] = setTimeout(_send.bind(this), 10);
		}

		return this;
	}

	broadcast(name, data) {
		const broadcast = this.broadcast.bind(this);
		const get = this.get.bind(this);
		const emit = this.emit.bind(this);

		if (name instanceof Object) {
			Object.keys(name).forEach(k => {
				if (k.indexOf('$') >= 0) return;
				broadcast(k, name[k]);
			});
		}
		if (typeof name !== 'string') return;

		let list = Object.keys(this)
			.filter(n => n.slice(0, 3) === '_on' && this[n].length > 0)
			.map(n => n.slice(3).split('$').shift())
			.filter(n => n.indexOf(name) === 0 || name.indexOf(n) === 0);

		list.forEach((n) => {
			if (arguments.length < 2) {
				emit(n);
			} else if (n.length === name.length) {
				emit(n, data);
			} else if (n.length > name.length) {
				emit(n, get(n.slice(name.length + 1), data));
			} else {
				let d = Object.assign({}, get(n));
				name.slice(n.length + 1).split('.').forEach((k, i, a) => {
					if (i < a.length - 1) {
						d = d[k] = Object.assign({}, d[k]);
					} else {
						d[k] = data;
					}
				});
				emit(n, d);
			}
		});

		return list;
	}

	get(name, db) {
		if (name === '$save') return { data: this._data, meta: this._meta };
		let [key, meta] = name.split('$');
		if (meta === 'meta') return this._meta[key];
		return ObjDb.get(name, db || this._data);
	}

	set(name, data, meta) {
		const expire = Date.now() + (this._conf.expire || 6e5);
		const set = this.set.bind(this);

		if (name instanceof Object) {
			Object.keys(name).forEach(k => {
				if (k.indexOf('$') >= 0) return;
				set(k, name[k], name[`${k}$meta`]);
			});
		}
		if (typeof name !== 'string') return;

		this._meta[name] = Object.assign({ e: expire }, meta, { t: Date.now() });

		if (ObjDb.isEqual(this.get(name) === data)) return this.debug('touch: %s', name);
		this.debug('set: %s', name);

		ObjDb.set(name, data, this._data);

		this.clean();
		this.broadcast(name);
		this.save();
	}

	del(names) {
		names = [].concat(names || []);
		ObjDb.del(names, this._data);

		this.clean();
		names.forEach(name => this.broadcast(name));
		this.save();
	}

	clean(force) {
		clearTimeout(this._clean);
		if (!force) {
			this._clean = setTimeout(this.clean.bind(this, true), 10);
			return;
		}

		const get = this.get.bind(this); const del = this.del.bind(this);
		const save = this.save.bind(this);
		const meta = this._meta; const now = Date.now();
		const conf = this._conf;

		let list = [].concat(Object.keys(this._data), Object.keys(this._meta)).filter((v, i, a) => a.indexOf(v) === i);

		list.filter((name) => {
			let m = meta[name]; let d = get(name);
			if (d === undefined) return true;
			if (list.some(k => k !== name && k.indexOf(name) === 0)) return false;
			if (!m) return true;
			if (m.perm || conf.perm) return false;
			return !m.e || m.e < now;
		}).forEach((name) => {
			this.debug('cleaning: %s', name);
			del(name);
			delete meta[name];
			save();
		});
	}

	save(force) {
		if (this._holdsave) {
			this._holdsaving = true;
			return;
		}

		clearTimeout(this._save);
		if (!force) {
			this._save = setTimeout(this.save.bind(this, true), 5e3);
			return;
		}
		if (!('_save' in this)) return;
		delete this._save;

		this.emit('$save');
	}

	holdsave(hold) {
		this._holdsave = hold;
		if (!hold && this._holdsaving) this.save();
	}

	restore(stream) {
		const set = this.set.bind(this);
		this.del(Object.keys(this._data));
		return ObjDb.restore(stream, (res) => {
			set(res.k, res.d, res.m);
		});
	}

	backup(stream) {
		const get = this.get.bind(this);
		let list = Object.keys(this._meta);

		return ObjDb.backup(stream, list, (k) => ({
			k: k,
			d: get(k),
			m: this._meta[k],
		}));
	}

	upkeep() {
		this.clean(true);
		this.save(true);
	}
}

module.exports = ObjDb;
