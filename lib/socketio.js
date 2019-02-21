/*!
 * Object DB <https://github.com/smujmaiku/objdb>
 * Copyright(c) 2017-2019 Michael Szmadzinski
 * MIT Licensed
 * For use with Socketio
 * https://www.npmjs.com/package/socketio
 */

const common = require('./common');

const IO_PREFACE = '_objdb_';

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

		this.ioRoomKey = `${IO_PREFACE}${opts.uri.slice(0, -1)}`;
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
		return Object.keys(socket.adapter.rooms)
			.filter(rid => rid.startsWith(preface) &&
				Object.keys(socket.adapter.rooms[rid].sockets).includes(socket.id))
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
			return this.getSocketRooms(socket).map(k => this.leaveRoom(socket, k));
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
	 * @param {Array} list
	 * @param {string} method
	 */
	testList(socket, list, method) {
		if (common.getType(list) !== 'array') return Promise.resolve([]);
		return Promise.all(list.map(key => {
			return Promise.resolve(this.test(socket, method, key))
				.then(allow => allow ? key : undefined);
		})).then((allowed) => allowed.filter(key => common.getType(key) === 'string'));
	}

	/**
	 * @param {Object} socket
	 * @param {Object} data
	 * @param {string} method
	 */
	testData(socket, data, method) {
		if (common.getType(data) !== 'object') return Promise.resolve({});
		const list = Object.keys(data).filter(key => !key.includes('$'));
		return this.testList(socket, list, method)
			.then(allowed => Object.keys(data).reduce((obj, key) => {
				if (allowed.includes(key) || key.includes('$')) obj[key] = data[key];
				return obj;
			}, {}));
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
	 * @param {string|boolean} key
	 */
	ioOff(socket, key) {
		const { cbs, onList } = socket[this.ioNspKey];
		if (key === true) {
			[].concat(
				Object.keys(cbs),
				Object.keys(onList),
			).forEach(k => this.ioOff(socket, k));
			return;
		}
		if (cbs[key]) {
			this.db.off(key, cbs[key]);
		}
		if (onList[key]) {
			delete onList[key];
			this.leaveRoom(socket, key);
		}
	}

	/**
	 * @param {Object} socket
	 * @param {string} key
	 * @param {number} depth
	 */
	ioDeep(socket, key, depth) {
		const cbs = socket[this.ioNspKey].cbs;

		this.ioOff(socket, `${key}$deep`, cbs[`${key}$deep`]);
		cbs[`${key}$deep`] = (k, data) => {
			Promise.resolve(this.test(socket, 'deep', key)).then((allow) => {
				if (!allow) return Promise.reject(new Error('Not allowed'));
				socket.emit(`${this.opts.uri}${key}$deep`.replace('.$', '$'), k, data);
			}).catch(() => 0);
		};
		this.db.onDeep(key, depth, cbs[`${key}$deep`]);
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
		this.testData(socket, data, 'add')
			.then(obj => this.db.add(obj));
	}

	/**
	 * @param {Object} socket
	 * @param {Object} data
	 */
	ioSet(socket, data) {
		this.testData(socket, data, 'set')
			.then(obj => this.db.set(obj));
	}

	/**
	 * @param {Object} socket
	 * @param {Object} data
	 */
	ioBroadcast(socket, data) {
		this.testData(socket, data, 'broadcast')
			.then(obj => this.db.broadcast(obj));
	}

	/**
	 * @param {Object} socket
	 * @param {Array|string} list
	 */
	ioDel(socket, list) {
		this.testList(socket, list, 'del').then((list) => {
			this.db.del(list);
		});
	}

	makeMidware() {
		const midware = (socket, next) => {
			this.io = socket.server;
			const nsp = socket[this.ioNspKey] = {
				cbs: {},
				onList: {},
			};

			nsp.on = list => [].concat(list || []).forEach(key => this.ioOn(socket, key));
			nsp.once = list => [].concat(list || []).forEach(key => this.ioOnce(socket, key));
			nsp.off = list => [].concat(list || []).forEach(key => this.ioOff(socket, key));
			nsp.deep = (list, depth) => [].concat(list || []).forEach(key => this.ioDeep(socket, key, depth));
			nsp.get = (key, cb) => this.ioGet(socket, key, cb);
			nsp.add = data => this.ioAdd(socket, data);
			nsp.set = data => this.ioSet(socket, data);
			nsp.broadcast = data => this.ioBroadcast(socket, data);
			nsp.del = list => this.ioDel(socket, list);

			socket.on(`${this.opts.uri}on`, nsp.on);
			socket.on(`${this.opts.uri}once`, nsp.once);
			socket.on(`${this.opts.uri}off`, nsp.off);
			socket.on(`${this.opts.uri}deep`, nsp.deep);

			socket.on(`${this.opts.uri}get`, nsp.get);
			socket.on(`${this.opts.uri}add`, nsp.add);
			socket.on(`${this.opts.uri}set`, nsp.set);
			socket.on(`${this.opts.uri}broadcast`, nsp.broadcast);
			socket.on(`${this.opts.uri}del`, nsp.del);

			socket.on('disconnect', () => {
				this.cleanRooms();
				this.ioOff(socket, true);
			});

			next();
		};

		midware.instance = this;
		this.midware = midware;
	}

	upkeep() {
		const io = this.io;
		if (!io) return Promise.resolve();

		const list = Object.keys(io.sockets.sockets)
			.map(k => io.sockets.sockets[k])
			.map(socket => () => this.checkRooms(socket));

		return common.promiseMap(list);
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
