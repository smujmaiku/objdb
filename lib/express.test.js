const common = require('./common');
const Express = require('./express');

const mockDb = (db = {}) => ({
	get: jest.fn(db.get),
	add: jest.fn(db.add),
	set: jest.fn(db.set),
	broadcast: jest.fn(db.broadcast),
	del: jest.fn(db.del),
});

const mockRequest = (midware, opts = {}) => {
	const req = Object.assign({
		_parsedUrl: {
			pathname: opts.path || '/api/data/test',
		},
		get: jest.fn(k => opts[k]),
		method: 'get',
		body: '',
	}, opts);
	const res = {
		status: jest.fn(() => res),
		redirect: jest.fn(() => res),
		json: jest.fn(() => res),
		end: jest.fn(() => res),
	};
	const next = jest.fn();
	midware(req, res, next);
	return { req, res, next };
};

describe('Express', () => {
	it('should construct middleware', () => {
		const db = mockDb();
		const midware = Express(db);
		expect(midware).toEqual(expect.any(Function));
	});

	describe('opts parameter', () => {
		it('should allow a function as the test parameter', () => {
			const db = mockDb();
			const test = jest.fn();
			const midware = Express(db, test);
			expect(midware).toEqual(expect.any(Function));

			const { req } = mockRequest(midware);
			expect(test).toBeCalledWith(req, expect.any(String), 'test', undefined);
		});

		it('should allow a string as uri key', () => {
			const db = mockDb();
			const test = jest.fn();
			const midware = Express(db, '/api/', test);
			expect(midware).toEqual(expect.any(Function));

			const { req } = mockRequest(midware, {
				path: '/api/testkey',
			});
			expect(test).toBeCalledWith(req, expect.any(String), 'testkey', undefined);
		});

		it('should allow invalid types', () => {
			const db = mockDb();
			const test = jest.fn();
			const midware = Express(db, 0, test);
			expect(midware).toEqual(expect.any(Function));

			const { req } = mockRequest(midware);
			expect(test).toBeCalledWith(req, expect.any(String), 'test', undefined);
		});
	});

	describe('opts.uri parameter', () => {
		it('should append `/`', () => {
			const db = mockDb();
			const test = jest.fn();
			const midware = Express(db, {
				uri: '/api/',
			}, test);
			expect(midware).toEqual(expect.any(Function));

			const { req } = mockRequest(midware);
			expect(test).toBeCalledWith(req, expect.any(String), 'data.test', undefined);
		});
	});

	describe('test parameter', () => {
		it('should function', () => {
			const db = mockDb();
			const test = jest.fn();
			const midware = Express(db, {}, test);
			expect(midware).toEqual(expect.any(Function));

			const { req } = mockRequest(midware, {
				method: 'get',
				path: '/api/data/test$keys',
			});
			expect(test).toBeCalledWith(req, 'get', 'test', 'keys');
		});

		it('should allow invalid types', () => {
			const db = mockDb();
			const midware = Express(db, {}, 0);
			expect(midware).toEqual(expect.any(Function));

			mockRequest(midware);
		});
	});

	describe('Middleware', () => {
		it('should only handle correct uris', () => {
			const db = mockDb();
			const midware = Express(db, {}, () => 0);

			const req = mockRequest(midware, { path: '/index' });
			expect(req.next).toBeCalled();
		});

		it('should redirect to fix uris', () => {
			const db = mockDb();
			const midware = Express(db, {}, () => 0);

			const req1 = mockRequest(midware, { path: '/api/data' });
			expect(req1.res.redirect).toBeCalledWith(301, `/api/data/$keys`);

			const req2 = mockRequest(midware, { path: '/api/data/' });
			expect(req2.res.redirect).toBeCalledWith(301, `/api/data/$keys`);

			const req3 = mockRequest(midware, { path: '/api/data/test/$keys' });
			expect(req3.res.redirect).toBeCalledWith(301, `/api/data/test$keys`);

			const req4 = mockRequest(midware, { path: '/api/data/test/' });
			expect(req4.res.redirect).toBeCalledWith(301, `/api/data/test`);
		});

		describe('testing', () => {
			it('should double checks set on add', () => {
				const db = mockDb();
				const test = jest.fn(() => false);
				const midware = Express(db, {}, test);

				const req = mockRequest(midware, { method: 'post' });
				return common.delay(1).then(() => {
					expect(test).toBeCalledWith(req.req, 'add', 'test', undefined);
					expect(test).toBeCalledWith(req.req, 'set', 'test', undefined);
				});
			});

			it('should double checks set on cast', () => {
				const db = mockDb();
				const test = jest.fn(() => false);
				const midware = Express(db, {}, test);

				const req = mockRequest(midware, { method: 'cast' });
				return common.delay(1).then(() => {
					expect(test).toBeCalledWith(req.req, 'broadcast', 'test', undefined);
					expect(test).toBeCalledWith(req.req, 'set', 'test', undefined);
				});
			});

			it('should 4xx out when testing false', () => {
				const db = mockDb();
				const midware = Express(db, {}, () => 0);

				const req = mockRequest(midware);
				return common.delay(1).then(() => {
					expect(req.res.status).toBeCalledWith(401);
					expect(req.res.end).toBeCalled();
				});
			});
		});

		describe('method: GET as get', () => {
			it('should res.json data', () => {
				const data = { a: 1 };
				const db = mockDb({ get: () => data });
				const midware = Express(db);

				const req = mockRequest(midware);
				return common.delay(1).then(() => {
					expect(req.res.json).toBeCalledWith(data);
				});
			});

			it('should res.json meta', () => {
				const meta = ['a', 'b'];
				const db = mockDb({ get: () => meta });
				const midware = Express(db);

				const req = mockRequest(midware, { path: '/api/data/test$keys' });
				return common.delay(1).then(() => {
					expect(req.res.json).toBeCalledWith(meta);
				});
			});

			it('should go deeper', () => {
				const get = jest.fn();
				const db = mockDb({ get });
				const midware = Express(db);

				mockRequest(midware, { path: '/api/data/a/b/c/d' });
				return common.delay(1).then(() => {
					expect(get).toBeCalledWith('a.b.c.d');
				});
			});

			it('should 404 when undefined', () => {
				const db = mockDb();
				const midware = Express(db);

				const req = mockRequest(midware);
				return common.delay(1).then(() => {
					expect(req.res.status).toBeCalledWith(404);
					expect(req.res.end).toBeCalled();
				});
			});
		});

		describe('method: POST as add', () => {
			it('should res.json data', () => {
				const data = { a: 1 };
				const addData = { b: 2 };
				const metaData = { e: 1 };
				const db = mockDb({ add: () => addData });
				const midware = Express(db);

				const req = mockRequest(midware, {
					method: 'POST',
					body: data,
					'x-meta': common.jsonStringify(metaData),
				});
				return common.delay(1).then(() => {
					expect(db.add).toBeCalledWith('test', data, metaData);
					expect(req.res.json).toBeCalledWith(addData);
				});
			});
		});

		describe('method: PUT as set', () => {
			it('should res.json data', () => {
				const data = { a: 1 };
				const setData = { b: 2 };
				const metaData = { e: 1 };
				const db = mockDb({ set: () => setData });
				const midware = Express(db);

				const req = mockRequest(midware, {
					method: 'PUT',
					body: data,
					'x-meta': common.jsonStringify(metaData),
				});
				return common.delay(1).then(() => {
					expect(db.set).toBeCalledWith('test', data, metaData);
					expect(req.res.json).toBeCalledWith(setData);
				});
			});
		});

		describe('method: CAST as broadcast', () => {
			it('should res.json data', () => {
				const data = { a: 1 };
				const castData = { b: 2 };
				const metaData = { e: 1 };
				const db = mockDb({ broadcast: () => castData });
				const midware = Express(db);

				const req = mockRequest(midware, {
					method: 'CAST',
					body: data,
					'x-meta': common.jsonStringify(metaData),
				});
				return common.delay(1).then(() => {
					expect(db.broadcast).toBeCalledWith('test', data, metaData);
					expect(req.res.json).toBeCalledWith(castData);
				});
			});
		});

		describe('method: DELETE as del', () => {
			it('should res.json data', () => {
				const delData = { b: 2 };
				const db = mockDb({ del: () => delData });
				const midware = Express(db);

				const req = mockRequest(midware, {
					method: 'DELETE',
				});
				return common.delay(1).then(() => {
					expect(db.del).toBeCalledWith('test');
					expect(req.res.json).toBeCalledWith(delData);
				});
			});
		});

		it('should 5xx when failing out', () => {
			const db = mockDb();
			const test = jest.fn(() => Promise.reject(new Error()));
			const midware = Express(db, {}, test);

			const req = mockRequest(midware, { method: 'post' });
			return common.delay(1).then(() => {
				expect(req.res.status).toBeCalledWith(500);
				expect(req.res.end).toBeCalled();
			});
		});
	});
});
