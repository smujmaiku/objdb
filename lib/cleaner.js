
/*!
 * Object DB <https://github.com/smujmaiku/objdb>
 * Copyright(c) 2017-2019 Michael Szmadzinski
 * MIT Licensed
 */

const common = require('./common');

const EXPIRE_DELAY = 500;	// Half second
const UPKEEP_DELAY = 30000;	// Half minute

class Cleaner {
	/**
	 * @param {Function} find
	 * @param {Function} del
	 */
	constructor(find, del) {
		this.expireDelay = EXPIRE_DELAY;
		this.upkeepDelay = UPKEEP_DELAY;
		this.find = find;
		this.del = del;
		this.start();
	}

	start() {
		this._stop = false;
		this.newTimer();
	}

	stop() {
		this._stop = true;
		clearTimeout(this._expirei);
	}

	/**
	 * @returns {Promise}
	 */
	newTimer() {
		if (this._cleani) return;
		if (this._stop || this._hold) return;

		let max = Date.now() + this.upkeepDelay;

		return Promise.resolve(this.find(max)).then(list => {
			const expire = list.reduce((v, row) => Math.min(v, row), max);
			this.setTimer(expire);
		});
	}

	/**
	 * @param {number} expire
	 */
	setTimer(expire) {
		if (this._stop || this._hold) return;

		const now = Date.now();
		const time = Math.max(this.expireDelay, expire - now);

		if (this._expiret && time > this._expiret - now) return;

		clearTimeout(this._expirei);
		this._expiret = time + now;
		this._expirei = setTimeout(() => this.cleanData(), time);
	}

	/**
	 * @returns {Promise}
	 */
	cleanData() {
		if (this._hold) return Promise.resolve();
		this._hold = true;
		clearTimeout(this._expirei);

		let now = Date.now();

		return Promise.race([
			this.del(now),
			common.delay(this.upkeepDelay),
		]).catch(() => undefined).then(() => {
			this._hold = false;
			clearTimeout(this._expirei);
			delete this._expiret;
			delete this._expirei;
			return this.newTimer();
		});
	}
}

module.exports = Cleaner;
