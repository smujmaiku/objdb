const common = require('./common');
const Socketio = require('./socketio');

const mockDb = (db = {}) => ({
	on: jest.fn(db.on),
	once: jest.fn(db.once),
	deep: jest.fn(db.deep),
	off: jest.fn(db.off),
	add: jest.fn(db.add),
	set: jest.fn(db.set),
	broadcast: jest.fn(db.broadcast),
	del: jest.fn(db.del),
});

const mockIo = () => {

};

const mockSocket = (io = mockIo) => {
	const socket = {
		_on: (key, a, b) => socket.on.calls.forEach((k, cb) => { if (k === key) cb(a, b); }),
		on: jest.fn(),
		off: jest.fn(),
	};
	return socket;
};

describe('Socketio', () => {
	it('should construct middleware', () => {
		const db = mockDb();
		const midware = Socketio(db);
		expect(midware).toEqual(expect.any(Function));
	});

	it('should pass the instance in middleware', () => {
		const db = mockDb();
		const { instance } = Socketio(db);
		expect(instance).toEqual(expect.any(Socketio.Socketio));
	});

	describe('opts parameter', () => {
		it('should allow a function as the test parameter', () => {
			const db = mockDb();
			const test = jest.fn();
			const midware = Socketio(db, test);
			expect(midware).toEqual(expect.any(Function));
			expect(midware.instance.test).toEqual(test);
		});

		it('should allow a string as uri key', () => {
			const db = mockDb();
			const midware = Socketio(db, 'api.');
			expect(midware).toEqual(expect.any(Function));
			expect(midware.instance.opts.uri).toEqual('api.');
		});

		it('should allow invalid types', () => {
			const db = mockDb();
			const midware = Socketio(db, 0);
			expect(midware).toEqual(expect.any(Function));
		});
	});

	describe('opts.uri parameter', () => {
		it('should append `.`', () => {
			const db = mockDb();
			const midware = Socketio(db, {
				uri: 'api',
			});
			expect(midware).toEqual(expect.any(Function));
			expect(midware.instance.opts.uri).toEqual('api.');
		});
	});

	describe('opts.upkeep parameter', () => {
		it('should take seconds', () => {
			const db = mockDb();
			const midware = Socketio(db, {
				upkeep: 5,
			});
			expect(midware).toEqual(expect.any(Function));
			expect(midware.instance.opts.upkeep).toEqual(5);
		});

		it('should be minimum 1 second', () => {
			const db = mockDb();
			const midware = Socketio(db, {
				upkeep: 0,
			});
			expect(midware).toEqual(expect.any(Function));
			expect(midware.instance.opts.upkeep).toEqual(1);
		});

		it('should default to 60', () => {
			const db = mockDb();
			const midware = Socketio(db, {
				upkeep: '1',
			});
			expect(midware).toEqual(expect.any(Function));
			expect(midware.instance.opts.upkeep).toEqual(60);
		});

		it('should fail to 60', () => {
			const db = mockDb();
			const midware = Socketio(db, {
				upkeep: NaN,
			});
			expect(midware).toEqual(expect.any(Function));
			expect(midware.instance.opts.upkeep).toEqual(60);
		});
	});

	describe('test parameter', () => {
		it('should function', () => {
			const db = mockDb();
			const test = jest.fn();
			const midware = Socketio(db, {}, test);
			expect(midware).toEqual(expect.any(Function));
			expect(midware.instance.test).toEqual(test);
		});

		it('should allow invalid types', () => {
			const db = mockDb();
			const midware = Socketio(db, {}, 0);
			expect(midware).toEqual(expect.any(Function));
			expect(midware.instance.test()).toBeTruthy();
		});
	});

	describe('getSocketRooms', () => {

	});

	describe('getRoomSockets', () => {

	});

	describe('makeRoom', () => {

	});

	describe('delRoom', () => {

	});

	describe('joinRoom', () => {

	});

	describe('leaveRoom', () => {

	});

	describe('checkRooms', () => {

	});

	describe('ioOff', () => {

	});

	describe('ioOn', () => {

	});

	describe('ioDeep', () => {

	});

	describe('ioOnce', () => {

	});

	describe('ioGet', () => {

	});

	describe('ioAdd', () => {

	});

	describe('ioSet', () => {

	});

	describe('ioBroadcast', () => {

	});

	describe('ioDel', () => {

	});

	describe('upkeep', () => {
		it('should run regularly', () => {
			const db = mockDb();
			const instance = new Socketio.Socketio(db, { upkeep: 1 }, () => 1);
			instance.upkeep = jest.fn();
			return common.delay(1010).then(() => {
				expect(instance.upkeep).toBeCalled();
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

	describe('midware', () => {

	});
});
