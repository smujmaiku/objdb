/*!
 * Object DB <https://github.com/smujmaiku/objdb>
 * Copyright(c) 2017-2019 Michael Szmadzinski
 * MIT Licensed
 */

const fs = require('fs');
const common = require('./common');
const Emitter = require('./emitter');
const Express = require('./express');
const Socketio = require('./socketio');
const Cleaner = require('./cleaner');

class ObjDb extends Emitter {
	/**
	 * @param {Object} conf
	 * @param {number} conf.debounce
	 * @param {number} conf.expire
	 * @param {boolean} conf.permanent
	 * @param {Object} conf.db
	 * @param {Object} conf.meta
	 * @param {Object} db.data
	 * @param {Object} db.meta
	 * @param {Function} debug
	 */
	constructor(conf, db, debug) {
		super((conf || {}).debounce);
		this._conf = Object.assign({
			expire: 6e5,
		}, conf);
		this._debug = debug;

		this._data = {};
		this._meta = {};

		this.cleaner = new Cleaner(
			expire => this.findExpires(expire),
			() => this.clean(),
		);

		this.set(db);
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
			common.eachKey(name, (k, d) => this.set(k, d, data));
		}
		if (common.getType(name) !== 'string') return;
		if (name.indexOf('$') >= 0) return;

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
			if (name.indexOf('$') >= 0) return true;

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
			const readStream = fs.createReadStream(stream, 'utf8');
			return this.restore(readStream, cb);
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
				promises.push(cb(common.jsonParse(v)));
			});
			if (done) body = '';
		};

		return new Promise((resolve, reject) => {
			stream.setEncoding('utf8');

			stream.on('data', (chunk) => {
				body += chunk;
				read();
			});

			stream.on('error', err => reject(new Error(err)));

			stream.on('end', () => {
				read(true);
				resolve(promises.length > 0 ? Promise.all(promises) : []);
			});
		});
	}

	static backup(stream, list, cb) {
		if (common.getType(list) !== 'array') return Promise.reject(new Error('Invalid list'));
		if (common.getType(cb) !== 'function') return Promise.reject(new Error('Invalid cb'));

		if (typeof stream === 'string') {
			const writeStream = fs.createWriteStream(stream, 'utf8');
			return this.backup(writeStream, list, cb);
		}

		const next = () => new Promise((resolve, reject) => {
			if (list.length < 1) return resolve();
			let key = list.shift();

			Promise.resolve(cb(key)).then((row) => {
				let chunk = common.jsonStringify(row);
				stream.write(`${chunk}\n`, 'utf8', (err) => {
					if (err) return reject(new Error(err));
					next().then(resolve, reject);
				});
			}).catch(reject);
		});

		let writeError;
		return next()
			.catch(err => { writeError = err; })
			.then(() => {
				stream.end();
				if (writeError) return Promise.reject(writeError);
			});
	}

	debug() {
		if (this._debug) return this._debug.apply(this._debug, arguments);
	}

	get data() {
		return this._data;
	}

	get(name) {
		if (common.getType(name) !== 'string') return undefined;
		if (name.endsWith('$meta')) return this._meta[name.slice(0, -5)];
		return ObjDb.get(name, this._data);
	}

	set(name, data, meta) {
		const now = Date.now();
		const expire = now + this._conf.expire;

		if (name instanceof Object) {
			common.eachKey(name, (k, d, m) => {
				this.set(k, d, Object.assign({}, name.$meta, m));
			}, ['meta']);
		}
		if (typeof name !== 'string') return;

		const dataMeta = Object.assign({
			e: expire,
		}, meta, {
			t: now,
		});

		Object.keys(this._meta)
			.filter(k => k.startsWith(`${name}.`))
			.forEach(k => delete this._meta[k]);
		this._meta[name] = dataMeta;

		if (common.isEqual(this.get(name), data)) return this.debug('touch: %s', name);
		this.debug('set: %s', name);

		ObjDb.set(name, data, this._data);
		this.cleaner.setTimer(dataMeta.e);

		this.send(name);
	}

	del(names) {
		names = [].concat(names).filter(n => common.getType(n) === 'string');
		ObjDb.del(names, this._data);

		names.forEach(name => {
			Object.keys(this._meta)
				.filter(n => n === name || n.startsWith(`${name}.`))
				.forEach(n => { delete this._meta[n]; });
			this.send(name);
		});
	}

	findExpires(expire) {
		const conf = this._conf;

		if (conf.permanent) return [];
		if (common.getType(expire) !== 'number') return this.findExpires(Date.now());

		return Object.keys(this._meta)
			.map(name => [name, this._meta[name]])
			.filter(([, meta]) => !meta.p && (!meta.e || meta.e <= expire))
			.map(([name, meta]) => [name, meta.e]);
	}

	clean() {
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
			if (list.some(k => k !== name && k.startsWith(name))) return false;
			if (!m) return true;
			if (m.p || conf.permanent) return false;
			return !m.e || m.e < now;
		}).forEach((name) => {
			this.debug('cleaning: %s', name);
			this.del(name);
			delete this._meta[name];
		});
	}

	restore(stream) {
		this.del(Object.keys(this._data));
		this.clean();
		return ObjDb.restore(stream, (res) => {
			this.set(res.k, res.d, res.m);
		});
	}

	backup(stream) {
		this.clean();
		let list = Object.keys(this._meta);

		return ObjDb.backup(stream, list, (k) => ({
			k: k,
			d: this.get(k),
			m: this._meta[k],
		}));
	}

	/**
	 * @param {Object|string} opts
	 * @param {string} opts.uri
	 * @param {Function|undefined} test
	 * @returns {Function}
	 */
	express(opts, test) {
		return Express(this, opts, test);
	}

	/**
	 * @param {Object|string} opts
	 * @param {string} opts.uri
	 * @param {number} opts.upkeep
	 * @param {Function|undefined} test
	 * @returns {Function}
	 */
	socketio(opts, test) {
		return Socketio(this, opts, test);
	}
}

exports = module.exports = ObjDb;

exports.common = common;
exports.Emitter = Emitter;
exports.Express = Express;
exports.Socketio = Socketio;
exports.Cleaner = Cleaner;
