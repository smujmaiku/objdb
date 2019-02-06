const common = require('./common');
const Emitter = require('./emitter');

describe('Emitter', () => {
	it('should construct', () => {
		expect(new Emitter()).toBeDefined();
		expect(new Emitter(1)._debounce).toEqual(1);
	});

	describe('getRelatedListeners', () => {
		it('should return an Array', () => {
			const emitter = new Emitter();
			expect(emitter.getRelatedListeners()).toEqual([]);
			expect(emitter.getRelatedListeners('a')).toEqual([]);
		});

		it('should return related listeners', () => {
			const emitter = new Emitter();
			emitter.on('a', () => 0);
			emitter.on('a.b', () => 0);
			emitter.on('a$meta', () => 0);
			emitter.on('c.d', () => 0);
			expect(emitter.getRelatedListeners('')).toEqual(['a', 'a.b', 'c.d']);
			expect(emitter.getRelatedListeners('a')).toEqual(['a', 'a.b']);
			expect(emitter.getRelatedListeners('a.b')).toEqual(['a', 'a.b']);
			expect(emitter.getRelatedListeners('a.c')).toEqual(['a']);
			expect(emitter.getRelatedListeners('c')).toEqual(['c.d']);
		});
	});

	describe('on', () => {
		it('should set a listener', () => {
			const emitter = new Emitter();
			emitter.on('a', () => 0);
			emitter.on('b.c$meta', () => 0);
			expect(emitter.getRelatedListeners('')).toEqual(['a', 'b.c']);
		});

		it('should set lists of listeners', () => {
			const emitter = new Emitter();
			emitter.on(['a', 'b'], () => 0);
			emitter.on('c$meta, d.e,f', () => 0);
			expect(emitter.getRelatedListeners('')).toEqual(['a', 'b', 'c', 'd.e', 'f']);
		});

		it('should not listen to invalid parameters', () => {
			const emitter = new Emitter();
			emitter.on('a');
			emitter.on('a', '');
			emitter.on('', () => 0);
			emitter.on({}, () => 0);
			emitter.on(1, () => 0);
			expect(emitter.getRelatedListeners('')).toEqual([]);
		});

		it('should emit initial data', () => {
			const cb = jest.fn();
			const data = { data: 'important' };

			const emitter = new Emitter();
			emitter._get = data;
			emitter.on('a', cb);

			return Promise.resolve().then(() => {
				expect(cb).toBeCalledWith(data);
			});
		});
	});

	describe('once', () => {
		it('should emit initial data', () => {
			const cb = jest.fn();
			const data = { data: 'important' };

			const emitter = new Emitter();
			emitter._get = data;
			emitter.once('a', cb);

			return Promise.resolve().then(() => {
				expect(cb).toBeCalledWith(data);

				emitter.emit('a', data);
				expect(cb).toBeCalledTimes(1);
			});
		});

		it('should emit once data exists', () => {
			const cb = jest.fn();
			const data = { data: 'important' };

			const emitter = new Emitter();
			emitter.once('a', cb);

			return Promise.resolve().then(() => {
				expect(cb).not.toBeCalled();

				emitter.emit('a', data);
				emitter.emit('a', data);
				expect(cb).toBeCalledWith(data);
				expect(cb).toBeCalledTimes(1);
			});
		});
	});

	describe('off', () => {
		it('should not fail on invalid parameters', () => {
			const cb = jest.fn();

			const emitter = new Emitter();
			emitter.on('c', cb);
			emitter.off();
			emitter.off(undefined, () => 0);
			emitter.off('b', cb);
			emitter.off('c');
			expect(emitter.getRelatedListeners('')).toEqual(['c']);
		});

		it('should remove a listener', () => {
			const cb = jest.fn();
			const data = { data: 'important' };

			const emitter = new Emitter();
			emitter.on('a', cb);
			emitter.on('a', () => 0);
			emitter.off('a', cb);
			emitter.emit('a', data);
			expect(emitter.getRelatedListeners('a')).toEqual(['a']);
			expect(cb).not.toBeCalled();
		});

		it('should remove groups of listeners', () => {
			const cb = jest.fn();
			const data = { data: 'important' };

			const emitter = new Emitter();
			emitter.on('a', cb);
			emitter.on('a', () => 0);
			emitter.off('a', true);
			emitter.emit('a', data);
			expect(emitter.getRelatedListeners('a')).toEqual([]);
			expect(cb).not.toBeCalled();
		});

		it('should remove lists of listeners', () => {
			const emitter = new Emitter();
			emitter.on('a', () => 0);
			emitter.on('b', () => 0);
			emitter.on('c', () => 0);
			emitter.off(['a', 'c'], true);
			expect(emitter.getRelatedListeners('')).toEqual(['b']);
		});

		it('should remove all listeners', () => {
			const emitter = new Emitter();
			emitter.on('a', () => 0);
			emitter.on('b', () => 0);
			emitter.off(true);
			expect(emitter.getRelatedListeners('')).toEqual([]);
		});

		it('should run the clean function', () => {
			const cb = jest.fn();
			cb._clean = jest.fn();

			const emitter = new Emitter();
			emitter.on('a', cb);
			emitter.off(true);
			expect(cb._clean).toBeCalled();
		});
	});

	describe('emit', () => {
		it('should not fail on invalid parameters', () => {
			const emitter = new Emitter();

			expect(emitter.emit()).toBe(emitter);
			expect(emitter.emit('a')).toBe(emitter);
		});

		it('should emit to listeners', () => {
			const acb = jest.fn();
			const akeycb = jest.fn();
			const bcb = jest.fn();
			const data = { a: 1, b: 2 };

			const emitter = new Emitter();
			emitter.on('a', acb);
			emitter.on('a$keys', akeycb);
			emitter.on('b', bcb);
			emitter.emit('a', data);
			expect(acb).toBeCalledWith(data);
			expect(akeycb).toBeCalledWith(Object.keys(data));
			expect(bcb).not.toBeCalled();
		});
	});

	describe('debounce', () => {
		it('should not fail on invalid parameters', () => {
			const emitter = new Emitter();
			expect(emitter.debounce('a')).toBe(emitter);
			emitter.on('a', () => 0);
			expect(emitter.debounce()).toBe(emitter);
			expect(emitter.debounce('a')).toBe(emitter);
			expect(emitter.debounce('a', undefined, '')).toBe(emitter);
		});

		it('should emit after debounce time', () => {
			const cb = jest.fn();
			const data = { data: 'important' };
			const wait = 2;

			const emitter = new Emitter();
			emitter.on('a', cb);
			emitter.debounce('a', data, wait);
			expect(cb).not.toBeCalled();
			return common.delay(wait).then(() => {
				expect(cb).toBeCalledWith(data);
			});
		});

		it('should debounce emitting', () => {
			const cb = jest.fn();
			const data = { data: 'important' };
			const wait = 2;

			const emitter = new Emitter();
			emitter.on('a', cb);
			emitter.debounce('a', '', wait);
			emitter.debounce('a', data, wait);
			return common.delay(wait).then(() => {
				expect(cb).toBeCalledWith(data);
				expect(cb).toBeCalledTimes(1);
			});
		});

		it('should resolve data as a function before emitting', () => {
			const cb = jest.fn();
			const data = { data: 'important' };
			const datacb = jest.fn(() => data);
			const wait = 2;

			const emitter = new Emitter();
			emitter.on('a', cb);
			emitter.debounce('a', datacb, wait);
			expect(cb).not.toBeCalled();
			return common.delay(wait).then(() => {
				expect(datacb).toBeCalled();
				expect(cb).toBeCalledWith(data);
			});
		});

		it('should emit again if the data function takes longer than the next debounce', () => {
			const cb = jest.fn();
			const data = { data: 'important' };
			const moredata = { more: 'data' };
			let dataresolve;
			const datacb = jest.fn(() => new Promise((resolve) => { dataresolve = resolve; }));
			const wait = 2;

			const emitter = new Emitter();
			emitter.on('a', cb);
			emitter.debounce('a', '', wait);
			emitter.debounce('a', datacb, wait);
			expect(cb).not.toBeCalled();
			return common.delay(wait + 1).then(() => {
				expect(datacb).toBeCalled();
				expect(cb).not.toBeCalled();
				emitter.debounce('a', '', wait);
				emitter.debounce('a', moredata, wait);
				return common.delay(wait + 1);
			}).then(() => {
				expect(cb).not.toBeCalled();
				dataresolve(data);
				return common.delay(1);
			}).then(() => {
				expect(cb).toBeCalledWith(data);
				return common.delay(wait + 1);
			}).then(() => {
				expect(cb).toBeCalledWith(moredata);
				expect(cb).toBeCalledTimes(2);
			});
		});
	});

	describe('send', () => {
		it('should debounce related emitters', () => {
			const db = new Emitter(5);

			db.on('a', () => 0);
			db.on('a.b', () => 0);
			db.on('a.c', () => 0);
			db.on('a.b.c', () => 0);
			db.on('b', () => 0);
			db.debounce = jest.fn((k, cb) => cb(k));
			db.get = jest.fn();
			db.send('a.b');

			expect(db.debounce).toBeCalledWith('a', expect.any(Function));
			expect(db.debounce).toBeCalledWith('a.b', expect.any(Function));
			expect(db.debounce).toBeCalledWith('a.b.c', expect.any(Function));
			expect(db.debounce).toBeCalledTimes(3);
			expect(db.get).toBeCalledWith('a');
			expect(db.get).toBeCalledWith('a.b');
			expect(db.get).toBeCalledWith('a.b.c');
			expect(db.get).toBeCalledTimes(3);
		});

		it('should allow directly calling emit', () => {
			const db = new Emitter(5);

			db.on('a', () => 0);
			db.emit = jest.fn();
			db._get = '1';
			db.send('a.b', false);

			return common.delay(1).then(() => {
				expect(db.emit).toBeCalledWith('a', '1');
			});
		});
	});

	describe('get', () => {
		it('should return this._get for testing', () => {
			const data = { data: 'important' };

			const emitter = new Emitter();
			emitter._get = data;
			expect(emitter.get()).toBe(data);
		});
	});
});
