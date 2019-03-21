/*!
 * Object DB <https://github.com/smujmaiku/objdb>
 * Copyright(c) 2017-2019 Michael Szmadzinski
 * MIT Licensed
 */

/**
 * @param {*} data
 * @returns {boolean}
 */
function isUndefined(data) {
	return getType(data) === 'undefined';
}

/**
 * @param {*} data
 * @returns {boolean}
 */
function isEmpty(data) {
	return isUndefined(data) || (data instanceof Object && getSize(data) < 1);
}

/**
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
function isEqual(a, b) {
	if (a === b) return true;
	if (getType(a) !== getType(b)) return false;
	if (a instanceof Array) {
		if (a.length !== b.length) return false;
		return a.every((v, i) => isEqual(v, b[i]));
	} else if (a instanceof Object) {
		if (!isEqual(Object.keys(a).sort(), Object.keys(b).sort())) return false;
		return Object.keys(a).every(k => isEqual(a[k], b[k]));
	}
	return false;
}

/**
 * @param {*} data
 * @returns {string} type
 */
function getType(data) {
	const type = typeof data;
	if (type !== 'object') return type;
	if (data instanceof Promise) return 'promise';
	if (data instanceof Array) return 'array';
	if (data instanceof Object) return 'object';
	return typeof undefined;
}

/**
 * @param {*} data
 * @returns {Array} keys
 */
function getKeys(data) {
	if (!(data instanceof Object)) return [];
	return Object.keys(data);
}

/**
 * @param {*} data
 * @returns {number} size
 */
function getSize(data) {
	return getKeys(data).length;
}

/**
 * @param {number} wait ms
 * @returns {Promise}
 */
function delay(wait) {
	return new Promise(resolve => setTimeout(resolve, wait));
}

/**
 * @param {Object} obj
 * @param {Function} cb
 * @param {Array} metas
 * @returns {Array}
 */
function eachKey(obj, cb, metas = []) {
	return Object.keys(obj)
		.filter(k => k.indexOf('$') < 0)
		.map(k => cb.apply(cb, [k, obj[k]].concat(metas.map(m => obj[`${k}$${m}`]))));
}

/**
 * @param {*} value
 * @returns {string}
 */
function jsonStringify(value) {
	try {
		const string = JSON.stringify(value);
		if (getType(string) === 'string') return string;
		return '';
	} catch (e) {
		return '';
	}
}

/**
 * @param {string} value
 * @returns {*}
 */
function jsonParse(value) {
	try {
		return JSON.parse(value);
	} catch (e) {
		return undefined;
	}
}

/**
 * @param {Array} list
 * @returns {Promise}
 */
function promiseMap(list) {
	const todo = [].concat(list);
	const results = [];

	const next = (res) => {
		results.push(res);
		const check = todo.shift();
		if (!check) return results.slice(1);
		return Promise.resolve(check()).then(next);
	};

	return Promise.resolve(next());
};

module.exports = {
	isUndefined,
	isEmpty,
	isEqual,
	getType,
	getKeys,
	getSize,
	delay,
	eachKey,
	jsonStringify,
	jsonParse,
	promiseMap,
};
