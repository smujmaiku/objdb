const common = require('./common');
const Socketio = require('./socketio');

let socketIndex = 1e4;

function mockDb(db = {}) {
	return {
		on: jest.fn(db.on),
		once: jest.fn(db.once),
		onDeep: jest.fn(db.onDeep),
		off: jest.fn(db.off),
		get: jest.fn(db.get),
		add: jest.fn(db.add),
		set: jest.fn(db.set),
		broadcast: jest.fn(db.broadcast),
		del: jest.fn(db.del),
	};
}

function mockIo(sockets = []) {
	const io = {
		sockets: {
			adapter: {
				rooms: {},
			},
			sockets: {},
		},
		to: jest.fn(() => io),
		emit: jest.fn(),
	};
	sockets.forEach(s => mockSocket(io, s));
	return io;
};

function mockSocket(io = mockIo(), opts = {}) {
	const socketId = String(opts.id || socketIndex++);
	const socket = {
		id: socketId,
		_on: (key, a, b) => socket.on.mock.calls.forEach(([k, cb]) => { if (k === key) cb(a, b); }),
		on: jest.fn(),
		off: jest.fn(),
		emit: jest.fn(),
		join: jest.fn(key => {
			const room = socket.adapter.rooms[key] = socket.adapter.rooms[key] || { sockets: {} };
			room.sockets[socket.id] = 1;
		}),
		leave: jest.fn((key, cb) => {
			const room = socket.adapter.rooms[key] = socket.adapter.rooms[key] || { sockets: {} };
			delete room.sockets[socket.id];
			cb();
		}),
		adapter: io.sockets.adapter,
	};
	io.sockets.sockets[socketId] = socket;
	return socket;
};

describe('Socketio', () => {
	it('should construct middleware', () => {
		const midware = Socketio(mockDb());
		expect(midware).toEqual(expect.any(Function));
	});

	it('should pass the instance in middleware', () => {
		const { instance } = Socketio(mockDb());
		expect(instance).toEqual(expect.any(Socketio.Socketio));
	});

	describe('opts parameter', () => {
		it('should allow a function as the test parameter', () => {
			const test = jest.fn();
			const midware = Socketio(mockDb(), test);
			expect(midware).toEqual(expect.any(Function));
			expect(midware.instance.test).toEqual(test);
		});

		it('should allow a string as uri key', () => {
			const midware = Socketio(mockDb(), 'api.');
			expect(midware).toEqual(expect.any(Function));
			expect(midware.instance.opts.uri).toEqual('api.');
		});

		it('should allow invalid types', () => {
			const midware = Socketio(mockDb(), 0);
			expect(midware).toEqual(expect.any(Function));
		});
	});

	describe('opts.uri parameter', () => {
		it('should append `.`', () => {
			const midware = Socketio(mockDb(), {
				uri: 'api',
			});
			expect(midware).toEqual(expect.any(Function));
			expect(midware.instance.opts.uri).toEqual('api.');
		});
	});

	describe('opts.upkeep parameter', () => {
		it('should take seconds', () => {
			const midware = Socketio(mockDb(), {
				upkeep: 5,
			});
			expect(midware).toEqual(expect.any(Function));
			expect(midware.instance.opts.upkeep).toEqual(5);
		});

		it('should be minimum 1 second', () => {
			const midware = Socketio(mockDb(), {
				upkeep: 0,
			});
			expect(midware).toEqual(expect.any(Function));
			expect(midware.instance.opts.upkeep).toEqual(1);
		});

		it('should default to 60', () => {
			const midware = Socketio(mockDb(), {
				upkeep: '1',
			});
			expect(midware).toEqual(expect.any(Function));
			expect(midware.instance.opts.upkeep).toEqual(60);
		});

		it('should fail to 60', () => {
			const midware = Socketio(mockDb(), {
				upkeep: NaN,
			});
			expect(midware).toEqual(expect.any(Function));
			expect(midware.instance.opts.upkeep).toEqual(60);
		});
	});

	describe('test parameter', () => {
		it('should function', () => {
			const test = jest.fn();
			const midware = Socketio(mockDb(), {}, test);
			expect(midware).toEqual(expect.any(Function));
			expect(midware.instance.test).toEqual(test);
		});

		it('should allow invalid types', () => {
			const midware = Socketio(mockDb(), {}, 0);
			expect(midware).toEqual(expect.any(Function));
			expect(midware.instance.test()).toBeTruthy();
		});
	});

	describe('getSocketRooms', () => {
		it('should return room keys for a socket', () => {
			const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
			const io = instance.io = mockIo([{ id: 'a' }, { id: 'b' }]);
			instance.joinRoom(io.sockets.sockets.a, 'test1');
			instance.joinRoom(io.sockets.sockets.b, 'test1');
			instance.joinRoom(io.sockets.sockets.a, 'test2');
			expect(instance.getSocketRooms(io.sockets.sockets.a)).toEqual(['test1', 'test2']);
			expect(instance.getSocketRooms(io.sockets.sockets.b)).toEqual(['test1']);
		});
	});

	describe('getRoomSockets', () => {
		it('should return socket ids for a room', () => {
			const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
			const io = instance.io = mockIo([{ id: 'a' }, { id: 'b' }]);
			instance.joinRoom(io.sockets.sockets.a, 'test1');
			instance.joinRoom(io.sockets.sockets.b, 'test1');
			instance.joinRoom(io.sockets.sockets.a, 'test2');
			expect(instance.getRoomSockets('test1')).toEqual(['a', 'b']);
			expect(instance.getRoomSockets('test2')).toEqual(['a']);
			expect(instance.getRoomSockets('test3')).toEqual([]);
		});
	});

	describe('makeRoom', () => {
		it('should return room name', () => {
			const key = 'test1';
			const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
			instance.io = mockIo();
			expect(instance.makeRoom(key)).toEqual(expect.any(String));
		});

		it('should register once', () => {
			const key = 'test1';
			const db = mockDb();
			const instance = new Socketio.Socketio(db, {}, () => 1);
			instance.io = mockIo();
			instance.makeRoom(key);
			instance.makeRoom(key);
			expect(db.on).toBeCalledTimes(1);
			expect(db.on).toBeCalledWith(key, instance.rooms[key], true);
		});

		it('register db listener to room', () => {
			const key = 'test1';
			const data = { a: 1 };
			const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
			const io = instance.io = mockIo();
			const roomkey = instance.makeRoom(key);

			instance.rooms[key](data);
			expect(io.to).toBeCalledWith(roomkey);
			expect(io.emit).toBeCalledWith(`data.${key}`, data);
		});

		it('should fail gracefully', () => {
			const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
			expect(instance.makeRoom('')).toBeDefined();
		});
	});

	describe('delRoom', () => {
		it('should return room name', () => {
			const key = 'test1';
			const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
			instance.io = mockIo();
			const roomkey = instance.makeRoom(key);
			expect(instance.delRoom(key)).toEqual(roomkey);
		});

		it('unregister db listener to room', () => {
			const key = 'test1';
			const db = mockDb();
			const instance = new Socketio.Socketio(db, {}, () => 1);
			instance.io = mockIo();
			instance.makeRoom(key);
			const cb = instance.rooms[key];
			instance.delRoom(key);

			expect(cb).toEqual(expect.any(Function));
			expect(db.off).toBeCalledWith(key, cb);
			expect(instance.rooms[key]).toBeUndefined();
		});

		it('should fail gracefully', () => {
			const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
			expect(instance.delRoom('')).toBeDefined();
		});
	});

	describe('cleanRooms', () => {
		it('should delRooms that are empty', () => {
			const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
			instance.delRoom = jest.fn();
			instance.rooms['test1'] = [];
			instance.rooms['test2'] = [1];
			instance.getRoomSockets = jest.fn(key => instance.rooms[key]);
			instance.cleanRooms();
			expect(instance.delRoom).toBeCalledWith('test1');
			expect(instance.delRoom).not.toBeCalledWith('test2');
		});
	});

	describe('joinRoom', () => {
		it('should make the room', () => {
			const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
			const key = 'test1';
			instance.makeRoom = jest.fn(() => '');
			instance.joinRoom(mockSocket(), key);
			expect(instance.makeRoom).toBeCalledWith(key);
		});

		it('should send initial data just once', () => {
			const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
			const io = instance.io = mockIo([{ id: 'a' }]);
			const key = 'test1';
			instance.ioOnce = jest.fn();
			instance.joinRoom(io.sockets.sockets.a, key);
			expect(instance.ioOnce).toBeCalledWith(io.sockets.sockets.a, key);
			instance.joinRoom(io.sockets.sockets.a, key);
			expect(instance.ioOnce).toBeCalledTimes(1);
		});

		it('should join the socket room', () => {
			const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
			const io = instance.io = mockIo([{ id: 'a' }]);
			const key = 'test1';
			instance.ioOnce = jest.fn();
			instance.joinRoom(io.sockets.sockets.a, key);
			expect(io.sockets.sockets.a.join).toBeCalledWith(instance.makeRoom(key));
		});
	});

	describe('leaveRoom', () => {
		it('should leave a room and clean rooms', () => {
			const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
			const socket = mockSocket();
			const key = 'test1';
			instance.cleanRooms = jest.fn();
			instance.leaveRoom(socket, key);
			expect(socket.leave).toBeCalled();
			expect(instance.cleanRooms).toBeCalled();
		});

		it('should leave all rooms when key is true', () => {
			const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
			const io = instance.io = mockIo([{ id: 'a' }]);
			const socket = io.sockets.sockets.a;
			instance.joinRoom(socket, 'test1');
			instance.joinRoom(socket, 'test2');
			instance.leaveRoom(socket, true);
			expect(socket.leave).toBeCalledTimes(2);
		});
	});

	describe('checkRooms', () => {
		it('should return a Promise', () => {
			const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
			const socket = mockSocket();
			socket[instance.ioNspKey] = { onList: {} };

			return expect(instance.checkRooms(socket)).toEqual(expect.any(Promise));
		});

		it('should join rooms allowed', () => {
			const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
			const socket = mockSocket();
			socket[instance.ioNspKey] = { onList: {
				test1: 1,
				test2: 1,
			} };

			instance.joinRoom = jest.fn();
			return instance.checkRooms(socket).then(() => {
				expect(instance.joinRoom).toBeCalledWith(socket, 'test1');
				expect(instance.joinRoom).toBeCalledWith(socket, 'test2');
			});
		});

		it('should leave rooms denied', () => {
			const instance = new Socketio.Socketio(mockDb(), {}, () => 0);
			const socket = mockSocket();
			socket[instance.ioNspKey] = { onList: {
				test1: 1,
				test2: 1,
			} };

			instance.leaveRoom = jest.fn();
			return instance.checkRooms(socket).then(() => {
				expect(instance.leaveRoom).toBeCalledWith(socket, 'test1');
				expect(instance.leaveRoom).toBeCalledWith(socket, 'test2');
			});
		});
	});

	describe('testList', () => {
		it('should resolve tested data', () => {
			const data = ['a', '$'];
			const test = jest.fn(() => 1);
			const instance = new Socketio.Socketio(mockDb(), {}, test);
			const socket = mockSocket();

			return instance.testList(socket, data, 'method').then((list) => {
				expect(test).toBeCalledWith(socket, 'method', 'a');
				expect(test).toBeCalledWith(socket, 'method', '$');
				expect(test).toBeCalledTimes(2);
				expect(list).toEqual(data);
			});
		});

		it('should not set if denied', () => {
			const data = ['a', '$'];
			const test = jest.fn(() => 0);
			const instance = new Socketio.Socketio(mockDb(), {}, test);
			const socket = mockSocket();

			return instance.testList(socket, data, 'deny').then((obj) => {
				expect(obj).toEqual([]);
				expect(test).toBeCalledWith(socket, 'deny', 'a');
				expect(test).toBeCalledWith(socket, 'deny', '$');
				expect(test).toBeCalledTimes(2);
			});
		});

		it('should fail gracefully', () => {
			const test = jest.fn(() => 0);
			const instance = new Socketio.Socketio(mockDb(), {}, test);
			const socket = mockSocket();

			return instance.testList(socket).then((obj) => {
				expect(obj).toEqual([]);
			});
		});
	});

	describe('testData', () => {
		it('should resolve tested data', () => {
			const data = { a: 1, b: 2, '$': 3 };
			const test = jest.fn(() => 1);
			const instance = new Socketio.Socketio(mockDb(), {}, test);
			const socket = mockSocket();

			return instance.testData(socket, data, 'method').then((obj) => {
				expect(test).toBeCalledWith(socket, 'method', 'a');
				expect(test).toBeCalledWith(socket, 'method', 'b');
				expect(test).toBeCalledTimes(2);
				expect(obj).toEqual(data);
			});
		});

		it('should not set if denied', () => {
			const data = { a: 1, b: 2, '$': 3 };
			const test = jest.fn(() => 0);
			const instance = new Socketio.Socketio(mockDb(), {}, test);
			const socket = mockSocket();

			return instance.testData(socket, data, 'deny').then((obj) => {
				expect(obj).toEqual({ '$': 3 });
				expect(test).toBeCalledWith(socket, 'deny', 'a');
				expect(test).toBeCalledWith(socket, 'deny', 'b');
				expect(test).toBeCalledTimes(2);
			});
		});

		it('should fail gracefully', () => {
			const test = jest.fn(() => 0);
			const instance = new Socketio.Socketio(mockDb(), {}, test);
			const socket = mockSocket();

			return instance.testData(socket).then((obj) => {
				expect(obj).toEqual({});
			});
		});
	});

	describe('midware', () => {
		it('should set io based on the socket', () => {
			const instance = new Socketio.Socketio(mockDb(), {}, () => 0);
			const socket = mockSocket();
			instance.midware(socket, () => 0);
			expect(instance.io).toBe(socket.server);
		});

		describe('ioOn', () => {
			it('should join rooms', () => {
				const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
				const socket = mockSocket();
				const key = 'test1';
				instance.midware(socket, () => 0);
				instance.checkRooms = jest.fn();
				socket._on('data.on', key);
				expect(instance.checkRooms).toBeCalledWith(socket);
				expect(socket[instance.ioNspKey].onList[key]).toBeDefined();
			});

			it('should fail gracefully', () => {
				const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
				const socket = mockSocket();
				instance.midware(socket, () => 0);
				socket._on('data.on');
				expect(instance).toBeDefined();
			});
		});

		describe('ioOnce', () => {
			it('should emit current data', () => {
				const key = 'test1';
				const data = { a: 1 };
				const db = mockDb({ get: () => data });
				const instance = new Socketio.Socketio(db, {}, () => 1);
				const socket = mockSocket();
				instance.db.set(key, data);
				instance.midware(socket, () => 0);
				instance.checkRooms = jest.fn();
				socket._on('data.once', key);
				return common.delay(2).then(() => {
					expect(socket.emit).toBeCalledWith(`data.${key}`, data);
				});
			});

			it('should not emit if denied', () => {
				const key = 'test1';
				const instance = new Socketio.Socketio(mockDb(), {}, () => 0);
				const socket = mockSocket();
				instance.midware(socket, () => 0);
				instance.checkRooms = jest.fn();
				socket._on('data.once', key);
				return common.delay(2).then(() => {
					expect(socket.emit).not.toBeCalled();
				});
			});

			it('should fail gracefully', () => {
				const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
				const socket = mockSocket();
				instance.midware(socket, () => 0);
				socket._on('data.once');
				expect(instance).toBeDefined();
			});
		});

		describe('ioOff', () => {
			it('should leave rooms', () => {
				const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
				const socket = mockSocket();
				const key = 'test1';
				instance.midware(socket, () => 0);
				socket[instance.ioNspKey].onList[key] = 1;
				instance.leaveRoom = jest.fn();
				socket._on('data.off', key);
				expect(instance.leaveRoom).toBeCalledWith(socket, key);
				expect(socket[instance.ioNspKey].onList[key]).toBeUndefined();
			});

			it('should leave deep listeners', () => {
				const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
				const socket = mockSocket();
				const key = 'test1$deep';
				instance.midware(socket, () => 0);
				const cb = socket[instance.ioNspKey].cbs[key] = () => 1;
				socket._on('data.off', key);
				expect(instance.db.off).toBeCalledWith(key, cb);
			});

			it('should leave all rooms', () => {
				const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
				const socket = mockSocket();
				instance.midware(socket, () => 0);
				socket[instance.ioNspKey].onList.a = 1;
				const cb = socket[instance.ioNspKey].cbs.b = () => 1;
				instance.leaveRoom = jest.fn();
				socket._on('data.off', true);
				expect(instance.leaveRoom).toBeCalledWith(socket, 'a');
				expect(instance.db.off).toBeCalledWith('b', cb);
			});

			it('should fail gracefully', () => {
				const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
				const socket = mockSocket();
				instance.midware(socket, () => 0);
				socket._on('data.off');
				expect(instance).toBeDefined();
			});
		});

		describe('ioDeep', () => {
			it('should hook into db.deep', () => {
				const key = 'test1';
				const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
				const socket = mockSocket();
				instance.midware(socket, () => 0);
				socket._on('data.deep', key, 1);
				expect(instance.db.onDeep).toBeCalledWith(key, 1, expect.any(Function));
			});

			it('should emit if allowed', () => {
				const key = 'test1';
				const deepKey = 'a';
				const data = { b: 2 };
				const test = jest.fn(() => 1);
				const instance = new Socketio.Socketio(mockDb(), {}, test);
				const socket = mockSocket();
				instance.midware(socket, () => 0);
				socket._on('data.deep', key, 1);
				const fn = instance.db.onDeep.mock.calls[0][2];
				fn(deepKey, data);
				expect(test).toBeCalledWith(socket, 'deep', key);
				return common.delay(1).then(() => {
					expect(socket.emit).toBeCalledWith(`data.${key}$deep`, deepKey, data);
				});
			});

			it('should not emit if denied', () => {
				const key = 'test1';
				const test = jest.fn(() => 0);
				const instance = new Socketio.Socketio(mockDb(), {}, test);
				const socket = mockSocket();
				instance.midware(socket, () => 0);
				socket._on('data.deep', key, 1);
				const fn = instance.db.onDeep.mock.calls[0][2];
				fn('a', { b: 2 });
				expect(test).toBeCalledWith(socket, 'deep', key);
				return common.delay(1).then(() => {
					expect(socket.emit).not.toBeCalled();
				});
			});

			it('should fail gracefully', () => {
				const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
				const socket = mockSocket();
				instance.midware(socket, () => 0);
				socket._on('data.deep');
				expect(instance).toBeDefined();
			});
		});

		describe('ioGet', () => {
			it('should get data', () => {
				const key = 'a';
				const data = { b: 2 };
				const instance = new Socketio.Socketio(mockDb({ get: () => data }), {}, () => 1);
				const socket = mockSocket();
				instance.midware(socket, () => 0);
				const fn = jest.fn();
				socket._on('data.get', key, fn);
				return common.delay(1).then(() => {
					expect(fn).toBeCalledWith(data);
				});
			});

			it('should callback undefined if denied', () => {
				const instance = new Socketio.Socketio(mockDb(), {}, () => 0);
				const socket = mockSocket();
				instance.midware(socket, () => 0);
				const fn = jest.fn();
				socket._on('data.get', 'key', fn);
				return common.delay(1).then(() => {
					expect(fn).toBeCalledWith(undefined);
				});
			});

			it('should fail gracefully', () => {
				const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
				const socket = mockSocket();
				instance.midware(socket, () => 0);
				socket._on('data.get');
				expect(instance).toBeDefined();
			});
		});

		describe('ioAdd', () => {
			it('should add data', () => {
				const data = { a: 1, '$': 2 };
				const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
				const socket = mockSocket();
				instance.midware(socket, () => 0);
				socket._on('data.add', data);
				return common.delay(1).then(() => {
					expect(instance.db.add).toBeCalledWith(data);
				});
			});
		});

		describe('ioSet', () => {
			it('should set data', () => {
				const data = { a: 1, '$': 2 };
				const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
				const socket = mockSocket();
				instance.midware(socket, () => 0);
				socket._on('data.set', data);
				return common.delay(1).then(() => {
					expect(instance.db.set).toBeCalledWith(data);
				});
			});
		});

		describe('ioBroadcast', () => {
			it('should broadcast data', () => {
				const data = { a: 1, '$': 2 };
				const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
				const socket = mockSocket();
				instance.midware(socket, () => 0);
				socket._on('data.broadcast', data);
				return common.delay(1).then(() => {
					expect(instance.db.broadcast).toBeCalledWith(data);
				});
			});
		});

		describe('ioDel', () => {
			it('should del data', () => {
				const perms = { a: 0, b: 1 };
				const instance = new Socketio.Socketio(mockDb(), {}, (s, m, key) => perms[key]);
				const socket = mockSocket();
				instance.midware(socket, () => 0);
				socket._on('data.del', Object.keys(perms));
				return common.delay(1).then(() => {
					expect(instance.db.del).toBeCalledWith(['b']);
					expect(instance.db.del).toBeCalledTimes(1);
				});
			});

			it('should del list as string', () => {
				const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
				const socket = mockSocket();
				instance.midware(socket, () => 0);
				socket._on('data.del', 'a');
				return common.delay(1).then(() => {
					expect(instance.db.del).toBeCalledWith(['a']);
				});
			});
		});

		describe('onDisconnect', () => {
			it('should clean listeners', () => {
				const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
				const socket = mockSocket();
				instance.midware(socket, () => 0);
				instance.cleanRooms = jest.fn();
				instance.ioOff = jest.fn();
				socket._on('disconnect');
				expect(instance.cleanRooms).toBeCalled();
				expect(instance.ioOff).toBeCalledWith(socket, true);
			});
		});
	});

	describe('makeMidware', () => {
		it('should make midware on the instance', () => {
			const db = mockDb();
			const instance = new Socketio.Socketio(db, {}, () => 1);
			delete instance.midware;
			instance.makeMidware();
			expect(instance.midware).toEqual(expect.any(Function));
		});
	});

	describe('upkeep', () => {
		it('should run regularly', () => {
			global.setInterval = jest.fn();
			const db = mockDb();
			const instance = new Socketio.Socketio(db, { upkeep: 5 }, () => 1);
			instance.upkeep = jest.fn();
			expect(global.setInterval).toBeCalledWith(expect.any(Function), 5000);

			global.setInterval.mock.calls[0][0]();
			expect(instance.upkeep).toBeCalled();
		});

		it('should return a promise', () => {
			const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
			instance.io = mockIo();
			instance.checkRooms = jest.fn();
			return expect(instance.upkeep()).toEqual(expect.any(Promise));
		});

		it('should test every sockets room permisions', () => {
			const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
			instance.io = mockIo([{ id: 'a' }, { id: 'b' }]);
			instance.checkRooms = jest.fn();
			return instance.upkeep().then(() => {
				expect(instance.checkRooms).toBeCalledWith(instance.io.sockets.sockets.a);
				expect(instance.checkRooms).toBeCalledWith(instance.io.sockets.sockets.b);
			});
		});

		it('should fail gracefully', () => {
			const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
			instance.io = mockIo();
			instance.upkeep();
			expect(instance).toBeDefined();
		});

		it('should fail gracefully', () => {
			const instance = new Socketio.Socketio(mockDb(), {}, () => 1);
			instance.upkeep();
			expect(instance).toBeDefined();
		});
	});
});
