/*!
 * Object DB <https://github.com/smujmaiku/objdb>
 * Copyright(c) 2017-2019 Michael Szmadzinski
 * MIT Licensed
 */

const fs = require('fs');
const common = require('./common');
const Emitter = require('./emitter');

class ObjDb extends Emitter {
	/**
	 * @param {Object} conf
	 * @param {number} conf.expire
	 * @param {number} conf.upkeep
	 * @param {Object} conf.db
	 * @param {Object} conf.meta
	 * @param {Object} db.data
	 * @param {Object} db.meta
	 * @param {Function} debug
	 */
	constructor(conf, db, debug) {
		super((conf || {}).debounce);
		this._conf = Object.assign({
			upkeep: 6e4,
			expire: 6e5,
		}, conf);
		this._debug = debug;

		this._data = {};
		this._meta = {};
		this.set(db);

		setInterval(() => this.upkeep(), this._conf.upkeep);
		this.upkeep();
	}

	/**
	 * @param {string} name
	 * @param {Object} db
	 * @returns {*}
	 */
	static get(name, db) {
		let [key, meta] = name.split('$');
		let cDb = db;
		key.split('.')
			.filter((k, i) => i > 0 || !!k)
			.forEach(k => { cDb = (cDb || {})[k]; });
		if (!meta) return cDb;
		if (meta === 'keys') return common.getKeys(cDb);
		if (meta === 'type') return common.getType(cDb);
		if (meta === 'size') return common.getSize(cDb);
		return undefined;
	}

	/**
	 * @param {string} name
	 * @param {*} data
	 * @param {Object} db
	 */
	static set(name, data, db) {
		if (common.getType(name) === 'object') {
			Object.entries(name).forEach(([k, d]) => {
				if (k.indexOf('$') >= 0) return;
				this.set(k, d, data);
			});
		}
		if (common.getType(name) !== 'string') return;

		if (common.isEmpty(data)) {
			this.del(name, db);
			return;
		}

		let cDb = db;
		name.split('.').forEach((n, i, a) => {
			if (i < a.length - 1) {
				cDb = cDb[n] = common.getType(cDb[n]) === 'object' ? cDb[n] : {};
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
				if (common.getSize(pData) < 1) this.del(pName, db);
			}

			return true;
		});
	}

	static restore(stream, cb) {
		if (typeof stream === 'string') {
			stream = fs.createReadStream(stream, 'utf8');
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
			stream = fs.createWriteStream(stream, 'utf8');
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

	broadcast(name) {

	}

	get(name, db) {
		if (common.getType(name) !== 'string') return undefined;
		if (name.endsWith('$meta')) return this._meta[name.slice(0, -5)];
		return ObjDb.get(name, db || this._data);
	}

	set(name, data, meta) {
		const expire = Date.now() + this._conf.expire;

		if (name instanceof Object) {
			Object.keys(name).forEach(k => {
				if (k.indexOf('$') >= 0) return;
				this.set(k, name[k], name[`${k}$meta`]);
			});
		}
		if (typeof name !== 'string') return;

		this._meta[name] = Object.assign({
			e: expire,
		}, meta, {
			t: Date.now(),
		});

		if (common.isEqual(this.get(name), data)) return this.debug('touch: %s', name);
		this.debug('set: %s', name);

		ObjDb.set(name, data, this._data);

		this.clean();
		this.broadcast(name);
	}

	del(names) {
		names = [].concat(names).filter(n => common.getType(n) === 'string');
		ObjDb.del(names, this._data);

		this.clean();
		names.forEach(name => this.broadcast(name));
	}

	clean(force) {
		clearTimeout(this._clean);
		if (!force) {
			this._clean = setTimeout(() => this.clean(true), this._debounce);
			return;
		}

		const now = Date.now();
		const conf = this._conf;

		let list = [].concat(
			Object.keys(this._data),
			Object.keys(this._meta),
		).filter((v, i, a) => a.indexOf(v) === i);

		list.filter((name) => {
			let d = this.get(name);
			let m = this.get(`${name}$meta`);
			if (common.getType(d) === 'undefined') return true;
			if (list.some(k => k !== name && k.indexOf(name) === 0)) return false;
			if (!m) return true;
			if (m.p || conf.p) return false;
			return !m.e || m.e < now;
		}).forEach((name) => {
			this.debug('cleaning: %s', name);
			this.del(name);
			delete this._meta[name];
		});
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
	}
}

module.exports = ObjDb;
