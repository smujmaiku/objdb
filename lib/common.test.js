const common = require('./common');

describe('common', () => {
	describe('isUndefined', () => {
		it('should detect undefined types', () => {
			expect(common.isUndefined(null)).toBe(true);
			expect(common.isUndefined(undefined)).toBe(true);
			expect(common.isUndefined()).toBe(true);
			expect(common.isUndefined(0)).toBe(false);
		});
	});

	describe('isEmpty', () => {
		it('should detect undefined types', () => {
			expect(common.isEmpty(null)).toBe(true);
			expect(common.isEmpty(0)).toBe(false);
		});

		it('should detect empty Objects', () => {
			expect(common.isEmpty({})).toBe(true);
			expect(common.isEmpty({ a: 1 })).toBe(false);
			expect(common.isEmpty([])).toBe(true);
			expect(common.isEmpty([1])).toBe(false);
		});
	});

	describe('isEqual', () => {
		it('should check types', () => {
			expect(common.isEqual(null, 0)).toBe(false);
			expect(common.isEqual({}, [])).toBe(false);
			expect(common.isEqual('1', 1)).toBe(false);
		});

		it('should allow different Objects passed', () => {
			expect(common.isEqual({}, {})).toBe(true);
			expect(common.isEqual([], [])).toBe(true);
		});

		it('should deeply verify', () => {
			expect(common.isEqual({ b: { c: 3 }, a: 2 }, { a: 2, b: { c: 3 } })).toBe(true);
			expect(common.isEqual({ b: { c: 3 }, a: 2 }, { a: 2, b: { c: 3, d: 4 } })).toBe(false);
			expect(common.isEqual({ b: { c: 3 }, a: 2 }, { a: 2, b: { c: 4 } })).toBe(false);
			expect(common.isEqual({ b: { 0: 'a' }, a: 2 }, { a: 2, b: ['a'] })).toBe(false);
		});
	});

	describe('getKeys', () => {
		it('should return keys', () => {
			expect(common.getKeys({ a: 1, b: 2 })).toEqual(['a', 'b']);
			expect(common.getKeys(['a', 'b'])).toEqual(['0', '1']);
		});

		it('should fail gracefully', () => {
			expect(common.getKeys('s')).toEqual([]);
			expect(common.getKeys(1)).toEqual([]);
			expect(common.getKeys()).toEqual([]);
		});
	});

	describe('getType', () => {
		it('should return proper types', () => {
			expect(common.getType({})).toEqual('object');
			expect(common.getType([])).toEqual('array');
			/* eslint-disable-next-line */
			expect(common.getType(new Function())).toEqual('function');
			expect(common.getType(function() {})).toEqual('function');
			expect(common.getType(() => 0)).toEqual('function');
			expect(common.getType(Promise.resolve())).toEqual('promise');
			expect(common.getType(null)).toEqual('undefined');
			expect(common.getType(false)).toEqual('boolean');
			expect(common.getType(0)).toEqual('number');
			expect(common.getType('')).toEqual('string');
			expect(common.getType(undefined)).toEqual('undefined');
			expect(common.getType()).toEqual('undefined');
		});
	});

	describe('getSize', () => {
		it('should return size of Object', () => {
			expect(common.getSize({ a: 1, b: 2 })).toBe(2);
			expect(common.getSize(['a'])).toEqual(1);
		});

		it('should fail gracefully', () => {
			expect(common.getSize('s')).toBe(0);
			expect(common.getSize(1)).toBe(0);
			expect(common.getSize()).toBe(0);
		});
	});

	describe('delay', () => {
		it('should wait', () => {
			let before = 0;
			let after = 0;
			let wait = 2;

			setTimeout(() => { before = 1; }, wait++);
			const delay = common.delay(wait++);
			setTimeout(() => { after = 1; }, wait++);

			return delay.then(() => {
				expect(before).toEqual(1);
				expect(after).toEqual(0);
			});
		});
	});
});
