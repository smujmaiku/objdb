const ObjDb = require('./objdb');

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
		it('should ', () => {
			// expect('tests to be written').toBe(true);
		});
	});

	describe('backup static', () => {
		it('should ', () => {
			// expect('tests to be written').toBe(true);
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
			const db = new ObjDb({}, { data });
			expect(db.data).toBe(data);
		});
	});

	describe('broadcast', () => {
		it('should ', () => {
			// expect('tests to be written').toBe(true);
		});
	});

	describe('get', () => {
		it('should ', () => {
			// expect('tests to be written').toBe(true);
		});
	});

	describe('set', () => {
		it('should ', () => {
			// expect('tests to be written').toBe(true);
		});
	});

	describe('del', () => {
		it('should ', () => {
			// expect('tests to be written').toBe(true);
		});
	});

	describe('clean', () => {
		it('should ', () => {
			// expect('tests to be written').toBe(true);
		});
	});

	describe('save', () => {
		it('should ', () => {
			// expect('tests to be written').toBe(true);
		});
	});

	describe('holdsave', () => {
		it('should ', () => {
			// expect('tests to be written').toBe(true);
		});
	});

	describe('restore', () => {
		it('should ', () => {
			// expect('tests to be written').toBe(true);
		});
	});

	describe('backup', () => {
		it('should ', () => {
			// expect('tests to be written').toBe(true);
		});
	});

	describe('upkeep', () => {
		it('should ', () => {
			// expect('tests to be written').toBe(true);
		});
	});
});
