/*!
 * Object DB <https://github.com/smujmaiku/objdb>
 * Copyright(c) 2017-2019 Michael Szmadzinski
 * MIT Licensed
 * For use with Socketio
 * https://www.npmjs.com/package/socketio
 */

const common = require('./common');

/**
 * @param {Object} db
 * @param {Function} db.get
 * @param {Function} db.set
 * @param {Function} db.add
 * @param {Function} db.del
 * @param {Function} db.on
 * @param {Function} db.once
 * @param {Function} db.deep
 * @param {Function} db.off
 * @param {Object|string} opts
 * @param {string} opts.uri
 * @param {Function|undefined} test
 * @returns {Function}
 */
function Socketio(db, opts, test) {
	if (common.getType(opts) === 'function') return Socketio(db, {}, opts);
	if (common.getType(opts) === 'string') return Socketio(db, { uri: opts }, test);
	if (common.getType(opts) !== 'object') return Socketio(db, {}, test);
	if (common.getType(opts.uri) !== 'string') opts.uri = 'data';
	if (!opts.uri.endsWith('.')) opts.uri += '.';
	if (common.getType(test) !== 'function') return Socketio(db, opts, () => 1);

	return (socket, next) => {
		const cbs = {};

		const ioOn = (list) => {
			[].concat(list || []).forEach((key) => {
				if (cbs[key]) return db.once(key, cbs[key]);
				cbs[key] = (data) => {
					Promise.resolve(test(socket, 'get', key)).then((allow) => {
						if (!allow) return;
						socket.emit(`${opts.uri}${key}`, data);
					});
				};
				db.on(key, cbs[key]);
			});
		};

		const ioOff = (list) => {
			if (list === true) list = Object.keys(cbs);
			[].concat(list || []).forEach((key) => {
				db.off(key, cbs[key]);
				delete cbs[key];
			});
		};

		const ioOnce = (list) => {
			[].concat(list || []).forEach((key) => {
				Promise.resolve(test(socket, 'get', key)).then((allow) => {
					if (!allow) return Promise.reject(new Error('Not allowed'));
					return db.get(key);
				}).then((data) => {
					socket.emit(`${opts.uri}${key}`, data);
				}).catch(() => 0);
			});
		};

		const ioDeep = (list, depth) => {
			[].concat(list).forEach((key) => {
				ioOff(`${key}$deep`, cbs[`${key}$deep`]);
				cbs[`${key}$deep`] = (k, data) => {
					Promise.resolve(test(socket, 'get', `${key}.${k}`)).then((allow) => {
						if (!allow) return;
						socket.emit(`${opts.uri}${key}$deep`.replace('.$', '$'), k, data);
					});
				};
				db.deep(key, depth, cbs[`${key}$deep`]);
			});
		};

		socket[`_objdb_${opts.uri.slice(0, -1)}`] = {
			on: ioOn,
			off: ioOff,
			once: ioOnce,
			deep: ioDeep,
		};

		socket.on(`${opts.uri}on`, ioOn);
		socket.on(`${opts.uri}off`, ioOff);
		socket.on(`${opts.uri}once`, ioOnce);
		socket.on(`${opts.uri}deep`, ioDeep);

		socket.on(`${opts.uri}get`, (key, cb) => {
			if (!(cb instanceof Function)) return;

			Promise.resolve(test(socket, 'get', key)).then((allow) => {
				if (!allow) return Promise.reject(new Error('Not allowed'));
				return db.get(key);
			}).then((data) => {
				cb(data);
			}).catch(() => cb(undefined));
		});

		socket.on(`${opts.uri}add`, (data) => {
			Object.entries(data).forEach(([k, d]) => {
				if (k.indexOf('$') >= 0) return undefined;
				Promise.resolve(test(socket, 'add', k)).then((allow) => {
					if (!allow) return;
					db.add(k, d, data[`${k}$expire`] || data.$expire);
				});
			});
		});

		socket.on(`${opts.uri}set`, (data) => {
			Object.entries(data).forEach(([k, d]) => {
				if (k.indexOf('$') >= 0) return undefined;
				Promise.resolve(test(socket, 'set', k)).then((allow) => {
					if (!allow) return;
					db.set(k, d, data[`${k}$expire`] || data.$expire);
				});
			});
		});

		socket.on(`${opts.uri}broadcast`, (data) => {
			Object.entries(data).forEach(([k, d]) => {
				if (k.indexOf('$') >= 0) return undefined;
				Promise.resolve(test(socket, 'broadcast', k)).then((allow) => {
					if (allow) return allow;
					return test(socket, 'set', k);
				}).then((allow) => {
					if (!allow) return;
					db.set(k, d, 1);
				});
			});
		});

		socket.on(`${opts.uri}del`, (data) => {
			[].concat(data || []).forEach((k) => {
				Promise.resolve(test(socket, 'del', k)).then((allow) => {
					if (!allow) return;
					db.del(k);
				});
			});
		});

		socket.on('disconnect', () => {
			ioOff(true);
		});

		next();
	};
}

module.exports = Socketio;
