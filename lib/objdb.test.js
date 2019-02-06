const common = require('./common');
const ObjDb = require('./objdb');

jest.genMockFromModule('fs');
const fs = require('fs');
const mockStream = () => {
	const stream = {
		setEncoding: jest.fn(),
		on: jest.fn((n, cb) => { stream[`emit_${n}`] = cb; }),
		write: jest.fn((d, e, cb) => { stream.write_cb = cb; }),
		end: jest.fn(),
	};
	return stream;
};

describe('ObjDb', () => {
	describe('get static', () => {
		it('should get data by keys', () => {
			const db = { a: 1 };
			expect(ObjDb.get('a', db)).toBe(1);
		});

		it('should return keys', () => {
			const db = {
				o: { b: 1, c: 2 },
			};
			expect(ObjDb.get('o$keys', db)).toEqual(['b', 'c']);
			expect(ObjDb.get('z$keys', db)).toEqual([]);
		});

		it('should return type', () => {
			const db = {
				a: [],
				s: '',
			};
			expect(ObjDb.get('a$type', db)).toEqual('array');
			expect(ObjDb.get('s$type', db)).toEqual('string');
			expect(ObjDb.get('z$type', db)).toEqual('undefined');
		});

		it('should return size', () => {
			const db = {
				o: { b: 1, c: 2 },
				a: [3, 4, 5],
			};
			expect(ObjDb.get('o$size', db)).toEqual(2);
			expect(ObjDb.get('a$size', db)).toEqual(3);
			expect(ObjDb.get('z$size', db)).toEqual(0);
		});

		it('should fail gracefully', () => {
			expect(ObjDb.get('a.b', { a: 1 })).toBe(undefined);
			expect(ObjDb.get('a.b')).toBe(undefined);
			expect(ObjDb.get('')).toBe(undefined);
			expect(ObjDb.get('a$z')).toBe(undefined);
		});
	});

	describe('set static', () => {
		it('should set data', () => {
			const db = {};
			ObjDb.set('a', 1, db);
			ObjDb.set('b.c', 2, db);
			ObjDb.set('b.d', 3, db);
			expect(db).toEqual({ a: 1, b: { c: 2, d: 3 } });
		});

		it('should take an Object', () => {
			const db = {};
			ObjDb.set({
				'a': 1,
				'b.c': 2,
				'd$z': 3,
			}, db);
			expect(db).toEqual({ a: 1, b: { c: 2 } });
		});

		it('should delete when data is undefined', () => {
			const db = { a: 1, b: 2 };
			ObjDb.set('a', null, db);
			ObjDb.set('b', undefined, db);
			ObjDb.set('c', 0, db);
			expect(db).toEqual({ c: 0 });
		});

		it('should fail gracefully', () => {
			const db = { a: 1 };
			ObjDb.del('a.b.c', db);
			expect(db).toBe(db);
		});
	});

	describe('del static', () => {
		it('should delete single names', () => {
			const db = { a: 1, b: { c: 2, d: 3 } };
			ObjDb.del('a', db);
			ObjDb.del('b.c', db);
			expect(db).toEqual({ b: { d: 3 } });
		});

		it('should delete lists', () => {
			const db = { a: 1, b: { c: 2, d: 3 } };
			ObjDb.del(['a', 'b.d'], db);
			expect(db).toEqual({ b: { c: 2 } });
		});

		it('should clean empty Objects', () => {
			const db = { a: { b: 1 }, c: {}, d: { e: 2, f: 3 } };
			ObjDb.del(['a.b', 'd.f'], db);
			expect(db).toEqual({ c: {}, d: { e: 2 } });
		});

		it('should give feedback', () => {
			const db = { a: 1, b: 2, c: 3 };
			expect(ObjDb.del('a', db)).toBe(true);
			expect(ObjDb.del('a', db)).toBe(false);
			expect(ObjDb.del(['a', 'b', 'c'], db)).toEqual(['b', 'c']);
			expect(ObjDb.del(['a', 'b', 'c'], db)).toEqual([]);
		});
	});

	describe('restore static', () => {
		it('should return async Promise', () => {
			const stream = mockStream();

			expect(ObjDb.restore(stream, () => 0)).toEqual(expect.any(Promise));
		});

		it('should create a read stream', () => {
			const file = 'file~';
			const stream = mockStream();

			jest.spyOn(fs, 'createReadStream').mockImplementation(() => stream);
			ObjDb.restore(file, () => 0);
			expect(fs.createReadStream).toBeCalledWith(file, 'utf8');

			jest.restoreAllMocks();
		});

		it('should callback with parsed data', () => {
			const stream = mockStream();
			const cb = jest.fn();
			const data = `[]\n"more data"\n\n{"a":1}`;

			const promise = ObjDb.restore(stream, cb);
			expect(stream.on).toBeCalledWith('data', expect.any(Function));
			expect(stream.on).toBeCalledWith('end', expect.any(Function));

			stream.emit_data(data.slice(0, 7));
			stream.emit_data(data.slice(7));
			stream.emit_end();
			return promise.then(() => {
				expect(cb).toBeCalledWith([]);
				expect(cb).toBeCalledWith('more data');
				expect(cb).toBeCalledWith({ a: 1 });
				expect(cb).toBeCalledTimes(3);
			});
		});

		it('should fail gracefully on no data', () => {
			const stream = mockStream();
			const cb = jest.fn();

			const promise = ObjDb.restore(stream, cb);
			stream.emit_end();
			return promise.then(() => {
				expect(cb).toBeCalledTimes(0);
			});
		});

		it('should reject on error', () => {
			const stream = mockStream();
			const cb = jest.fn();
			const error = 'issues';

			const promise = ObjDb.restore(stream, cb);
			expect(stream.on).toBeCalledWith('error', expect.any(Function));
			stream.emit_error(error);
			return expect(promise).rejects.toThrow(error);
		});
	});

	describe('backup static', () => {
		it('should return async Promise', () => {
			const stream = mockStream();

			expect(ObjDb.backup(stream, [], () => 0)).toEqual(expect.any(Promise));
		});

		it('should create a write stream', () => {
			const file = 'file~';
			const stream = mockStream();

			jest.spyOn(fs, 'createWriteStream').mockImplementation(() => stream);
			ObjDb.backup(file, [], () => 0);
			expect(fs.createWriteStream).toBeCalledWith(file, 'utf8');

			jest.restoreAllMocks();
		});

		it('should callback with parsed data', () => {
			const stream = mockStream();
			const data = { a: 1, b: 'c' };
			const cb = jest.fn(k => data[k]);
			const list = ['a', 'b'];

			const promise = ObjDb.backup(stream, list, cb);
			return common.delay(1).then(() => {
				expect(cb).toBeCalledWith('a');
				expect(stream.write).toBeCalledWith('1\n', 'utf8', stream.write_cb);
				stream.write_cb();
				return common.delay(1);
			}).then(() => {
				expect(cb).toBeCalledWith('b');
				expect(stream.write).toBeCalledWith('"c"\n', 'utf8', stream.write_cb);
				stream.write_cb();
				return expect(promise).resolves.toBeUndefined();
			}).then(() => {
				expect(stream.end).toBeCalled();
			});
		});

		it('should reject on error', () => {
			const stream = mockStream();
			const error = 'issues';

			const data = { a: 1, b: 'c' };
			const cb = jest.fn(k => data[k]);
			const list = ['a', 'b'];

			const promise = ObjDb.backup(stream, list, cb);

			return common.delay(1).then(() => {
				stream.write_cb(error);
				return expect(promise).rejects.toThrow(error);
			});
		});

		it('should fail gracefully on invalid parameters', () => {
			expect(ObjDb.backup('')).rejects.toThrow('Invalid list');
			expect(ObjDb.backup('', '')).rejects.toThrow('Invalid list');
			expect(ObjDb.backup('', [])).rejects.toThrow('Invalid cb');
			expect(ObjDb.backup('', [], '')).rejects.toThrow('Invalid cb');
		});
	});

	describe('constructor', () => {
		it('should setup upkeep', () => {
			global.setInterval = jest.fn(fn => fn());
			const conf = { upkeep: 5 };

			const db = new ObjDb(conf);
			expect(db).toBeDefined();
			expect(global.setInterval).toBeCalledWith(expect.any(Function), conf.upkeep);
		});
	});

	describe('debug', () => {
		it('should call provided debug method', () => {
			const debug = jest.fn();
			const objDb = new ObjDb({}, {}, debug);
			const msg = 'bugs!';
			objDb.debug(msg, msg);
			expect(debug).toHaveBeenCalledWith(msg, msg);

			delete objDb._debug;
			objDb.debug(msg, msg);
			expect(debug).toHaveBeenCalledTimes(1);
		});
	});

	describe('data getter', () => {
		it('should safely return data', () => {
			const data = { some: 'data' };
			const db = new ObjDb({}, data);
			expect(db.data).toEqual(data);
		});
	});

	describe('get', () => {
		it('should return data', () => {
			const db = new ObjDb({}, {
				a: 1,
				'b.c': 2,
			});
			expect(db.get('a')).toBe(1);
			expect(db.get('b')).toEqual({ c: 2 });
			expect(db.get('b$keys')).toEqual(['c']);
			expect(db.get('b.c')).toEqual(2);
		});

		it('should return meta', () => {
			const db = new ObjDb({}, {
				'b.c': 1,
			});
			expect(db.get('b.c$meta')).toEqual(expect.any(Object));
		});

		it('should fail gracefully', () => {
			const db = new ObjDb();
			expect(db.get()).toBe(undefined);
			expect(db.get({})).toBe(undefined);
		});
	});

	describe('set', () => {
		it('should set data', () => {
			const db = new ObjDb();
			db.set('a', 1);
			db.set('b.c', 2);
			expect(db.get('a')).toEqual(1);
			expect(db.get('a$meta')).toEqual(expect.any(Object));
			expect(db.get('b.c')).toEqual(2);
			expect(db.get('b.c$meta')).toEqual(expect.any(Object));
		});

		it('should set meta', () => {
			const meta = { e: 1e12 };

			const db = new ObjDb();
			db.set('b.c', 2, meta);
			const resMeta = db.get('b.c$meta');
			expect(resMeta).toEqual(expect.any(Object));
			expect(resMeta.e).toEqual(meta.e);
			expect(resMeta.t).toEqual(expect.any(Number));
		});

		it('should take an Object', () => {
			const db = new ObjDb();
			db.set({
				'a': 1,
				'b.c': 2,
				'b.c$meta': { e: 1e12 },
			});
			expect(db.get('a')).toEqual(1);
			expect(db.get('a$meta')).toEqual(expect.any(Object));
			expect(db.get('b.c')).toEqual(2);
			expect(db.get('b.c$meta')).toEqual(expect.any(Object));
			expect(db.get('b.c$meta').e).toEqual(1e12);
		});

		it('should trigger functions', () => {
			const db = new ObjDb();

			jest.spyOn(db, 'clean');
			jest.spyOn(db, 'send');

			db.set('a', 1);
			expect(db.clean).toBeCalled();
			expect(db.send).toBeCalledWith('a');

			db.set('a', 1);
			expect(db.send).toBeCalledTimes(1);
			db.set('a', 2);
			expect(db.send).toBeCalledTimes(2);
		});

		it('should fail gracefully', () => {
			const db = new ObjDb();

			expect(db.set()).toBeUndefined();
			expect(db.set([])).toBeUndefined();
		});
	});

	describe('del', () => {
		it('should delete keys', () => {
			const db = new ObjDb({}, {
				a: 1,
				'b.c': 2,
			});

			db.del('a');
			expect(db.get('a')).toBeUndefined();
			db.del('b');
			expect(db.get('b.c')).toBeUndefined();
			expect(db.get('b')).toBeUndefined();
		});

		it('should delete lists of keys', () => {
			const db = new ObjDb({}, {
				a: 1,
				'b.c': 2,
			});

			db.del(['a', 'b']);
			expect(db.get('a')).toBeUndefined();
			expect(db.get('b')).toBeUndefined();
		});

		it('should trigger functions', () => {
			const db = new ObjDb();

			jest.spyOn(db, 'clean');
			jest.spyOn(db, 'send');

			db.del('a', 1);
			expect(db.clean).toBeCalled();
			expect(db.send).toBeCalledWith('a');
		});

		it('should fail gracefully', () => {
			const db = new ObjDb();

			expect(db.del()).toBeUndefined();
			expect(db.del(1)).toBeUndefined();
			expect(db.del({})).toBeUndefined();
		});
	});

	describe('clean', () => {
		it('should debounce', () => {
			let wait = 2;
			const db = new ObjDb({ debounce: wait++ });

			jest.spyOn(db, 'clean');
			db.clean();
			expect(db.clean).not.toBeCalledWith(true);
			return common.delay(wait++).then(() => {
				expect(db.clean).toBeCalledWith(true);
			});
		});

		it('should del expired data', () => {
			const db = new ObjDb();

			db._data.a = 1;
			db._meta.a = { e: 0 };
			expect(db.get('a')).toEqual(1);
			db.clean(true);
			expect(db.get('a')).toBeUndefined();
		});

		it('should del invalid meta', () => {
			const db = new ObjDb();

			db._data.a = 1;
			db._meta.b = {};
			db.clean(true);
			expect(db._data).toEqual({});
			expect(db._meta).toEqual({});
		});

		it('should keep data flagged with `p`', () => {
			const db = new ObjDb();

			db.set('a', 1, { e: 0, p: 1 });
			db.clean(true);
			expect(db.get('a')).toEqual(1);
		});
	});

	describe('restore', () => {
		it('should del everything', () => {
			const db = new ObjDb();

			jest.spyOn(db, 'del');
			jest.spyOn(db, 'clean');

			db.set('a', 1);
			db.restore();
			expect(db.del).toBeCalledWith(['a']);
			expect(db.clean).toBeCalledWith(true);
		});

		it('should retore with the stream', () => {
			const db = new ObjDb();
			const stream = mockStream();
			const row = {
				k: 'key',
				d: 'data',
				m: 'meta',
			};

			let restore;
			jest.spyOn(ObjDb, 'restore').mockImplementation((s, r) => { restore = r; });
			db.restore(stream);
			expect(ObjDb.restore).toBeCalledWith(stream, expect.any(Function));
			expect(restore).toEqual(expect.any(Function));

			jest.spyOn(db, 'set');
			restore(row);
			expect(db.set).toBeCalledWith(row.k, row.d, row.m);

			jest.restoreAllMocks();
		});
	});

	describe('backup', () => {
		it('should clean first', () => {
			const db = new ObjDb();

			jest.spyOn(db, 'clean');

			db.backup();
			expect(db.clean).toBeCalledWith(true);
		});

		it('should backup with the stream', () => {
			const db = new ObjDb();
			const stream = mockStream();

			let backup;
			jest.spyOn(ObjDb, 'backup').mockImplementation((s, l, b) => { backup = b; });
			db.set('a', 1);
			db.backup(stream);
			expect(ObjDb.backup).toBeCalledWith(stream, ['a'], expect.any(Function));
			expect(backup).toEqual(expect.any(Function));

			jest.spyOn(db, 'set');
			expect(backup('a')).toEqual({
				k: 'a',
				d: db.get('a'),
				m: db.get('a$meta'),
			});

			jest.restoreAllMocks();
		});
	});

	describe('upkeep', () => {
		it('should trigger functions', () => {
			const db = new ObjDb();

			jest.spyOn(db, 'clean');

			db.upkeep();
			expect(db.clean).toBeCalledWith(true);
		});
	});
});
