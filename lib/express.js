/*!
 * Object DB <https://github.com/smujmaiku/objdb>
 * Copyright(c) 2017-2019 Michael Szmadzinski
 * MIT Licensed
 * For use with Express
 * https://www.npmjs.com/package/express
 */

const common = require('./common');

/**
 * @param {Object} db
 * @param {Function} db.get
 * @param {Function} db.set
 * @param {Function} db.add
 * @param {Function} db.del
 * @param {Object|string} opts
 * @param {string} opts.uri
 * @param {Function|undefined} test
 * @returns {Function}
 */
function Express(db, opts, test) {
	if (common.getType(opts) === 'function') return Express(db, {}, opts);
	if (common.getType(opts) === 'string') return Express(db, { uri: opts }, test);
	if (common.getType(opts) !== 'object') return Express(db, {}, test);
	if (common.getType(opts.uri) !== 'string') opts.uri = '/api/data';
	if (!opts.uri.endsWith('/')) opts.uri += '/';
	if (common.getType(test) !== 'function') return Express(db, opts, () => 1);

	return (req, res, next) => {
		if (req._parsedUrl.pathname === opts.uri.slice(0, -1)) return res.redirect(301, `${opts.uri}$keys`);
		if (!req._parsedUrl.pathname.startsWith(opts.uri)) return next();
		let [path, metaKey] = req._parsedUrl.pathname.slice(opts.uri.length).split('$');
		let metaData = common.jsonParse(req.get('x-meta')) || req.get('x-meta');
		let key = path.replace('/', '.');
		let method = {
			get: 'get',
			post: 'add',
			put: 'set',
			cast: 'broadcast',
			delete: 'del',
		}[req.method.toLowerCase()];

		if (!key && !metaKey) return res.redirect(301, `${opts.uri}$keys`);
		if (path.length > 1 && path.slice(-1) === '/') return res.redirect(301, `${opts.uri}${path.slice(0, -1)}${metaKey ? `$${metaKey}` : ''}`);

		Promise.resolve(test(req, method, key, metaKey)).then((allow) => {
			if (allow) return allow;
			if (['broadcast', 'add'].includes(method)) return test(req, 'set', key, metaKey);
		}).then((allow) => {
			if (!allow) return res.status(401).end();

			switch (method) {
			case 'add':
				return Promise.resolve(db.add(key, req.body, metaData)).then((data) => {
					res.json(data);
				});

			case 'set':
				return Promise.resolve(db.set(key, req.body, metaData)).then((data) => {
					res.json(data);
				});

			case 'broadcast':
				return Promise.resolve(db.broadcast(key, req.body, metaData)).then((data) => {
					res.json(data);
				});

			case 'del':
				return Promise.resolve(db.del(key)).then((data) => {
					res.json(data);
				});
			}

			return Promise.resolve(db.get(`${key}${metaKey ? `$${metaKey}` : ''}`)).then((data) => {
				if (data === undefined) return res.status(404).end();
				res.json(data);
			});
		}).catch(() => res.status(500).end());
	};
}

module.exports = Express;
