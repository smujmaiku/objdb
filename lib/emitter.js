/*!
 * Object DB <https://github.com/smujmaiku/objdb>
 * Copyright(c) 2017-2019 Michael Szmadzinski
 * MIT Licensed
 */

const common = require('./common');

const DEBOUNCE_DELAY = 10;
const EMIT_PREFACE = '_on_';
const EMIT_KEYS_PREFACE = '_emitkeys_';
const DEBOUNCE_PREFACE = '_debounce_';
const DEBOUNCE_WAIT_PREFACE = '_debouncewait_';
const DEBOUNCE_AGAIN_PREFACE = '_debounceagain_';

class Emitter {
	/**
	 * @param {number} debounce
	 */
	constructor(debounce) {
		this._debounce = debounce >= 0 ? debounce : DEBOUNCE_DELAY;
	}

	/**
	 * Get parent and children listener names
	 * @param {string} name
	 * @returns {Array}
	 */
	getRelatedListeners(name) {
		if (typeof name !== 'string') return [];

		return Object.keys(this)
			.filter(n => n.startsWith(EMIT_PREFACE) && this[n].length > 0)
			.map(n => n.slice(EMIT_PREFACE.length).split('$').shift())
			.filter(n => n.indexOf(name) === 0 || name.indexOf(n) === 0)
			.filter((n, i, a) => a.indexOf(n) === i);
	}

	/**
	 * Listen for data and emit current data
	 * @param {string|Array} name
	 * @param {function} cb
	 */
	on(name, cb) {
		if (common.getType(cb) !== 'function') return this;
		if (common.getType(name) === 'array') return name.reduce((t, n) => t.on(n, cb), this);
		if (common.getType(name) !== 'string' || name.length < 1) return this;
		if (name.match(/[\s,]/)) return name.split(/[\s,]/g).reduce((t, n) => t.on(n, cb), this);

		const emitKey = `${EMIT_PREFACE}${name}`;
		this[emitKey] = (this[emitKey] || []);
		this[emitKey].push(cb);

		Promise.resolve(this.get(name)).then((res) => {
			if (common.isUndefined(res)) return;
			cb(res);
		});

		return this;
	}

	/**
	 * Listen for first data or emit current data once
	 * @param {string} name
	 * @param {function} cb
	 */
	once(name, cb) {
		const ocb = (res) => {
			this.off(name, ocb);
			cb(res);
		};

		return this.on(name, ocb);
	}

	/**
	 * Stop listening
	 * @param {string|Array|true} name
	 * @param {function} cb
	 */
	off(name, cb) {
		if (name === true) {
			return Object.keys(this)
				.filter(key => key.startsWith(EMIT_PREFACE))
				.reduce((t, key) => t.off(key.slice(EMIT_PREFACE.length), cb || true), this);
		}

		if (common.getType(name) === 'array') return name.reduce((t, n) => t.off(n, cb), this);
		if (common.getType(name) !== 'string') return this;

		const emitKey = `${EMIT_PREFACE}${name}`;

		if (common.getType(this[emitKey]) !== 'array') return this;
		if (cb === true) return this[emitKey].reduce((t, c) => t.off(name, c), this);

		this[emitKey] = this[emitKey].filter((c) => {
			if (common.getType(c) === 'function' && c !== cb) return true;
			if (c && c._clean) c._clean();
		});

		return this;
	}

	/**
	 * @param {string} name
	 * @param {number} depth
	 * @param {Function} cb
	 */
	onDeep(name, depth, cb) {
		if (common.getType(name) !== 'string') return this;
		if (common.getType(depth) !== 'number') return this;
		if (common.getType(cb) !== 'function') return this;

		if (depth < 1) depth = 1;
		depth += name.split('.').length;
		if (!name) depth--;

		const clean = [];
		cb._clean = () => clean.forEach(([k, c]) => this.off(k, c));

		const makeListener = (key, cb) => {
			clean.push([key, cb]);
			this.on(key, cb);
		};

		const onkeys = (key, keys) => {
			let list = [];

			keys.forEach((k) => {
				if (key) k = `${key}.${k}`;
				if (k.split('.').length >= depth) {
					if (clean.map(([k]) => k).indexOf(k) >= 0) return;
					makeListener(k, data => cb(name ? k.slice(name.length + 1) : k, data));
					list.push(k);
				} else {
					if (clean.map(([k]) => k).indexOf(`${k}$keys`) >= 0) return;
					makeListener(`${k}$keys`, keys => onkeys(k, keys));
					list.push(`${k}$keys`);
				}
			});
		};

		makeListener(`${name}$keys`, keys => onkeys(name, keys));

		const emitKey = `${EMIT_PREFACE}${name}$deep`;
		this[emitKey] = (this[emitKey] || []);
		this[emitKey].push(cb);

		return this;
	}

	/**
	 * Emit data to listeners
	 * @param {string} name
	 * @param {*} data
	 */
	emit(name, data) {
		if (typeof name !== 'string') return this;

		const emitKey = `${EMIT_PREFACE}${name}`;
		const keysKey = `${EMIT_KEYS_PREFACE}${name}`;

		(this[emitKey] || []).forEach(cb => cb(data));

		let keys = common.getKeys(data);
		let _keys = keys.sort().join(',');
		if (this[keysKey] !== _keys) {
			(this[`${emitKey}$keys`] || []).forEach(cb => cb(keys));
			this[keysKey] = _keys;
		}

		return this;
	}

	/**
	 * Debounce emit to listeners
	 * @param {string} name
	 * @param {*|function} data
	 * @param {number} delay
	 */
	debounce(name, data, delay = this._debounce) {
		if (common.getType(name) !== 'string') return this;

		const emitKey = `${EMIT_PREFACE}${name}`;
		if (!Object.keys(this).some(k => k.startsWith(emitKey))) return this;

		const debounceKey = `${DEBOUNCE_PREFACE}${name}`;
		const waitKey = `${DEBOUNCE_WAIT_PREFACE}${name}`;
		const againKey = `${DEBOUNCE_AGAIN_PREFACE}${name}`;

		this[againKey] = { data, delay };
		if (this[waitKey]) return this;
		delete this[againKey];

		const bounce = () => {
			if (common.getType(data) !== 'function') {
				this.emit(name, data);
			} else {
				this[waitKey] = true;
				Promise.resolve(data()).then((res) => {
					this.emit(name, res);
					delete this[waitKey];
					const again = this[againKey];
					if (again) this.debounce(name, again.data, again.delay);
				});
			}
		};

		clearTimeout(this[debounceKey]);
		if (common.getType(delay) === 'number' && delay >= 0) {
			this[debounceKey] = setTimeout(bounce, delay);
		} else {
			bounce();
		}

		return this;
	}

	/**
	 * @param {string} name
	 * @param {boolean} debounce
	 */
	send(name, debounce = true) {
		const list = this.getRelatedListeners(name);

		list.forEach((key) => {
			if (debounce) this.debounce(key, () => this.get(key));
			else Promise.resolve(this.get(key)).then(data => this.emit(key, data));
		});
	}

	/**
	 * Overload me
	 * @param {string} name
	 */
	get() { return this._get; }
}

module.exports = Emitter;
