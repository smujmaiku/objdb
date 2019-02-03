const expect = require('expect');
const ObjDb = require('../lib/objdb');

describe('ObjDb', function() {
	describe('isEqual static', () => {
		it('should check types', () => {
			expect(ObjDb.isEqual(null, 0)).toBe(false);
			expect(ObjDb.isEqual({}, [])).toBe(false);
			expect(ObjDb.isEqual('1', 1)).toBe(false);
		});

		it('should allow different Objects passed', () => {
			expect(ObjDb.isEqual({}, {})).toBe(true);
			expect(ObjDb.isEqual([], [])).toBe(true);
		});

		it('should deeply verify', () => {
			expect(ObjDb.isEqual({ b: { c: 3 }, a: 2 }, { a: 2, b: { c: 3 } })).toBe(true);
			expect(ObjDb.isEqual({ b: { c: 3 }, a: 2 }, { a: 2, b: { c: 3, d: 4 } })).toBe(false);
			expect(ObjDb.isEqual({ b: { c: 3 }, a: 2 }, { a: 2, b: { c: 4 } })).toBe(false);
			expect(ObjDb.isEqual({ b: { 0: 'a' }, a: 2 }, { a: 2, b: ['a'] })).toBe(false);
		});
	});

	describe('getKeys static', () => {
		it('should return keys', () => {
			expect(ObjDb.getKeys({ a: 1, b: 2 })).toEqual(['a', 'b']);
			expect(ObjDb.getKeys(['a', 'b'])).toEqual(['0', '1']);
		});

		it('should fail gracefully', () => {
			expect(ObjDb.getKeys('s')).toEqual([]);
			expect(ObjDb.getKeys(1)).toEqual([]);
			expect(ObjDb.getKeys()).toEqual([]);
		});
	});

	describe('getType static', () => {
		it('should return proper types', () => {
			expect(ObjDb.getType({})).toEqual('object');
			expect(ObjDb.getType([])).toEqual('array');
			expect(ObjDb.getType(null)).toEqual('undefined');
			expect(ObjDb.getType(false)).toEqual('boolean');
			expect(ObjDb.getType(0)).toEqual('number');
			expect(ObjDb.getType('')).toEqual('string');
			expect(ObjDb.getType(undefined)).toEqual('undefined');
			expect(ObjDb.getType()).toEqual('undefined');
		});
	});

	describe('getSize static', () => {
		it('should return size of Object', () => {
			expect(ObjDb.getSize({ a: 1, b: 2 })).toBe(2);
			expect(ObjDb.getSize(['a'])).toEqual(1);
		});

		it('should fail gracefully', () => {
			expect(ObjDb.getSize('s')).toBe(0);
			expect(ObjDb.getSize(1)).toBe(0);
			expect(ObjDb.getSize()).toBe(0);
		});
	});

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

		it('should fail gracefully', () => {
			expect(ObjDb.get('a.b', { a: 1 })).toBe(undefined);
			expect(ObjDb.get('a.b')).toBe(undefined);
			expect(ObjDb.get('')).toBe(undefined);
		});
	});

	describe('set static', () => {
		it('should set data', () => {
			const db = {};
			ObjDb.set('a', 1, db);
			ObjDb.set('b.c', 2, db);
			expect(db).toEqual({ a: 1, b: { c: 2 } });
		});

		it('should delete when data is undefined', () => {
			const db = { a: 1, b: 2 };
			ObjDb.set('a', null, db);
			ObjDb.set('b', undefined, db);
			ObjDb.set('c', 0, db);
			expect(db).toEqual({ c: 0 });
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

	describe('debug', () => {
		it('should ', () => {
			// expect('tests to be written').toBe(true);
		});
	});

	describe('on', () => {
		it('should ', () => {
			// expect('tests to be written').toBe(true);
		});
	});

	describe('once', () => {
		it('should ', () => {
			// expect('tests to be written').toBe(true);
		});
	});

	describe('off', () => {
		it('should ', () => {
			// expect('tests to be written').toBe(true);
		});
	});

	describe('emit', () => {
		it('should ', () => {
			// expect('tests to be written').toBe(true);
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
