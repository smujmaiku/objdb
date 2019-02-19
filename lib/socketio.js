/*!
 * Object DB <https://github.com/smujmaiku/objdb>
 * Copyright(c) 2017-2019 Michael Szmadzinski
 * MIT Licensed
 * For use with Socketio
 * https://www.npmjs.com/package/socketio
 */

const common = require('./common');

const IO_PREFACE = '_objdb_';
const IO_ROOM = `_objdb$room_`;

/**
 * @param {Object} db
 * @param {string} opts.uri
 * @param {number} opts.upkeep
 * @param {Function} test
 */
class Socketio {
	constructor(db, opts, test) {
		if (common.getType(opts.uri) !== 'string') opts.uri = 'data';
		if (!opts.uri.endsWith('.')) opts.uri += '.';
		opts.upkeep = common.getType(opts.upkeep) === 'number' ? Math.max(1, opts.upkeep) || 60 : 60;

		this.db = db;
		this.opts = opts;
		this.test = test;

		this.ioRoomKey = `${IO_ROOM}${opts.uri.slice(0, -1)}`;
		this.ioNspKey = `${IO_PREFACE}${opts.uri.slice(0, -1)}`;
		this.rooms = {};

		this.makeMidware();
		this.upkeepi = setInterval(() => this.upkeep(), opts.upkeep * 1e3);
	}

	/**
	 * @param {Object} socket
	 * @returns {Array}
	 */
	getSocketRooms(socket) {
		const preface = `${this.ioRoomKey}.`;
		return Object.entries(socket.adapter.rooms)
			.filter(([rid, room]) => rid.startsWith(preface) &&
				Object.keys(room.sockets).includes(socket.id))
			.map(([rid]) => rid.slice(preface.length));
	}

	/**
	 * @param {string} key
	 * @returns {Array}
	 */
	getRoomSockets(key) {
		const io = this.io;
		const preface = `${this.ioRoomKey}.`;
		const rid = `${this.ioRoomKey}.${key}`;
		const room = io && io.sockets.adapter.rooms[rid];
		if (!room) return [];
		return Object.keys(room.sockets).filter(id => !id.startsWith(preface));
	}

	/**
	 * @param {string} key
	 * @returns {string}
	 */
	makeRoom(key) {
		const io = this.io;
		if (io && !this.rooms[key]) {
			this.rooms[key] = data => {
				io.to(`${this.ioRoomKey}.${key}`).emit(`${this.opts.uri}${key}`, data);
			};
			this.db.on(key, this.rooms[key], true);
		}
		return `${this.ioRoomKey}.${key}`;
	}

	/**
	 * @param {string} key
	 * @returns {string}
	 */
	delRoom(key) {
		if (this.rooms[key]) {
			this.db.off(key, this.rooms[key]);
			delete this.rooms[key];
		}
		return `${this.ioRoomKey}.${key}`;
	}

	cleanRooms() {
		Object.keys(this.rooms).forEach(key => {
			if (this.getRoomSockets(key).length < 1) this.delRoom(key);
		});
	}

	/**
	 * @param {Object} socket
	 * @param {string} key
	 */
	joinRoom(socket, key) {
		const id = this.makeRoom(key);

		if (!this.getSocketRooms(socket).includes(key)) {
			this.ioOnce(socket, key);
			socket.join(id);
		}
	}

	/**
	 * @param {Object} socket
	 * @param {string} key
	 */
	leaveRoom(socket, key) {
		if (key === true) {
			return Object.keys(socket.rooms)
				.filter(k => k.startsWith(`${this.ioRoomKey}.`))
				.forEach(k => this.leaveRoom(socket, k));
		}
		socket.leave(`${this.ioRoomKey}.${key}`, () => {
			this.cleanRooms();
		});
	}

	/**
	 * @param {Object} socket
	 */
	checkRooms(socket) {
		return Promise.all(Object.keys(socket[this.ioNspKey].onList).map((key) => {
			return Promise.resolve(this.test(socket, 'get', key)).then((allow) => {
				if (!allow) return Promise.reject(new Error('Not allowed'));
				this.joinRoom(socket, key);
			}).catch(() => {
				this.leaveRoom(socket, key);
			});
		}));
	}

	/**
	 * @param {Object} socket
	 * @param {string} key
	 */
	ioOff(socket, key) {
		if (key.endsWith('$deep')) {
			const cbs = socket[this.ioRoomKey];
			this.ioOff(socket, `${key}`, cbs[`${key}`]);
		} else {
			delete socket[this.ioNspKey].onList[key];
			this.leaveRoom(socket, key);
		}
	}

	/**
	 * @param {Object} socket
	 * @param {string} key
	 */
	ioOn(socket, key) {
		socket[this.ioNspKey].onList[key] = 1;
		this.checkRooms(socket);
	}

	/**
	 * @param {Object} socket
	 * @param {string} key
	 * @param {number} depth
	 */
	ioDeep(socket, key, depth) {
		const cbs = socket[this.ioRoomKey];

		this.ioOff(socket, `${key}$deep`, cbs[`${key}$deep`]);
		cbs[`${key}$deep`] = (k, data) => {
			Promise.resolve(this.test(socket, 'deep', key)).then((allow) => {
				if (!allow) return Promise.reject(new Error('Not allowed'));
				socket.emit(`${this.opts.uri}${key}$deep`.replace('.$', '$'), k, data);
			}).catch(() => 0);
		};
		this.db.deep(key, depth, cbs[`${key}$deep`]);
	}

	/**
	 * @param {Object} socket
	 * @param {string} key
	 */
	ioOnce(socket, key) {
		Promise.resolve(this.test(socket, 'get', key)).then((allow) => {
			if (!allow) return Promise.reject(new Error('Not allowed'));

			return this.db.get(key);
		}).then((data) => {
			socket.emit(`${this.opts.uri}${key}`, data);
		}).catch(() => this.ioOff(socket, key));
	}

	/**
	 * @param {Object} socket
	 * @param {string} key
	 * @param {Function} cb
	 */
	ioGet(socket, key, cb) {
		if (common.getType(cb) !== 'function') return;

		Promise.resolve(this.test(socket, 'get', key)).then((allow) => {
			if (!allow) return Promise.reject(new Error('Not allowed'));
			return this.db.get(key);
		}).then((data) => {
			cb(data);
		}).catch(() => cb(undefined));
	}

	/**
	 * @param {Object} socket
	 * @param {Object} data
	 */
	ioAdd(socket, data) {
		Object.entries(data).forEach(([k, d]) => {
			if (k.indexOf('$') >= 0) return undefined;
			Promise.resolve(this.test(socket, 'add', k)).then((allow) => {
				if (!allow) return;
				this.db.add(k, d, data[`${k}$expire`] || data.$expire);
			});
		});
	}

	/**
	 * @param {Object} socket
	 * @param {Object} data
	 */
	ioSet(socket, data) {
		Object.entries(data).forEach(([k, d]) => {
			if (k.indexOf('$') >= 0) return undefined;
			Promise.resolve(this.test(socket, 'set', k)).then((allow) => {
				if (!allow) return;
				this.db.set(k, d, data[`${k}$expire`] || data.$expire);
			});
		});
	}

	/**
	 * @param {Object} socket
	 * @param {Object} data
	 */
	ioBroadcast(socket, data) {
		Object.entries(data).forEach(([k, d]) => {
			if (k.indexOf('$') >= 0) return undefined;
			Promise.resolve(this.test(socket, 'broadcast', k)).then((allow) => {
				if (allow) return allow;
				return this.test(socket, 'set', k);
			}).then((allow) => {
				if (!allow) return;
				this.db.set(k, d, 1);
			});
		});
	}

	/**
	 * @param {Object} socket
	 * @param {Array|string} list
	 */
	ioDel(socket, list) {
		[].concat(list || []).forEach((k) => {
			Promise.resolve(this.test(socket, 'del', k)).then((allow) => {
				if (!allow) return;
				this.db.del(k);
			});
		});
	}

	upkeep() {
		const io = this.io;
		if (!io) return;

		const list = Object.values(io.sockets.sockets)
			.map(socket => () => this.checkRooms(socket));

		const next = () => {
			const check = list.shift();
			if (!check) return;
			return check().then(next);
		};

		return next();
	}

	makeMidware() {
		const midware = (socket, next) => {
			this.io = socket.server;
			const nsp = socket[this.ioNspKey] = {
				cbs: {},
				onList: {},
			};

			nsp.off = list => [].concat(list || []).forEach(key => this.ioOff(socket, key));
			nsp.on = list => [].concat(list || []).forEach(key => this.ioOn(socket, key));
			nsp.deep = (list, depth) => [].concat(list || []).forEach(key => this.ioDeep(socket, key, depth));
			nsp.once = list => [].concat(list || []).forEach(key => this.ioOnce(socket, key));
			nsp.get = (key, cb) => this.ioGet(socket, key, cb);
			nsp.add = data => this.ioAdd(socket, data);
			nsp.set = data => this.ioSet(socket, data);
			nsp.broadcast = data => this.ioBroadcast(socket, data);
			nsp.del = list => this.ioDel(socket, list);

			socket.on(`${this.opts.uri}off`, nsp.off);
			socket.on(`${this.opts.uri}on`, nsp.on);
			socket.on(`${this.opts.uri}deep`, nsp.deep);
			socket.on(`${this.opts.uri}once`, nsp.once);

			socket.on(`${this.opts.uri}get`, nsp.get);
			socket.on(`${this.opts.uri}add`, nsp.add);
			socket.on(`${this.opts.uri}set`, nsp.set);
			socket.on(`${this.opts.uri}broadcast`, nsp.broadcast);
			socket.on(`${this.opts.uri}del`, nsp.del);

			socket.on('disconnect', () => {
				this.cleanRooms();
				Object.keys(nsp.cbs).forEach(key => nsp.off(key));
			});

			next();
		};

		midware.instance = this;
		this.midware = midware;
	}
}

/**
 * @param {Object} db
 * @param {Function} db.get
 * @param {Function} db.set
 * @param {Function} db.add
 * @param {Function} db.del
 * @param {Function} db.on
 * @param {Function} db.deep
 * @param {Function} db.off
 * @param {Function} db.once
 * @param {Object|string} opts
 * @param {string} opts.uri
 * @param {number} opts.upkeep
 * @param {Function|undefined} test
 * @returns {Function}
 */
function createMidware(db, opts, test) {
	if (common.getType(opts) === 'function') return createMidware(db, {}, opts);
	if (common.getType(opts) === 'string') return createMidware(db, { uri: opts }, test);
	if (common.getType(opts) !== 'object') return createMidware(db, {}, test);
	if (common.getType(test) !== 'function') return createMidware(db, opts, () => 1);

	const instance = new Socketio(db, opts, test);
	return instance.midware;
};

module.exports = createMidware;
module.exports.Socketio = Socketio;
