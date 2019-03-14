const Cleaner = require('./cleaner');
const common = require('./common');

const now = 1451718e6;
global.Date.now = jest.fn(() => now);
jest.spyOn(global, 'setTimeout');

describe('Cleaner', () => {
	it('should construct', () => {
		expect(new Cleaner(() => [], () => [])).toBeDefined();
	});

	describe('start', () => {
		it('should start the cleaner', () => {
			const cleaner = new Cleaner(() => [], () => []);
			cleaner._stop = true;
			cleaner.newTimer = jest.fn();
			cleaner.start();
			expect(cleaner._stop).toBe(false);
			expect(cleaner.newTimer).toBeCalled();
		});
	});

	describe('stop', () => {
		it('should start the cleaner', () => {
			const cleaner = new Cleaner(() => [], () => []);
			global.clearTimeout = jest.fn();
			cleaner.clean = jest.fn();
			cleaner.stop();
			expect(cleaner._stop).toBe(true);
			expect(global.clearTimeout).toBeCalled();
		});
	});

	describe('newTimer', () => {
		it('should setTimer with lowest value found', () => {
			const find = jest.fn(() => [5, 3, 7]);
			const cleaner = new Cleaner(find, () => []);
			cleaner.setTimer = jest.fn();
			find.mockClear();

			cleaner.stop();
			cleaner._hold = false;
			cleaner._stop = false;
			return cleaner.newTimer().then(() => {
				expect(cleaner.find).toBeCalledWith(Date.now() + cleaner.upkeepDelay);
				expect(cleaner.setTimer).toBeCalledWith(3);
			});
		});

		it('should not setTimer above the a max', () => {
			const find = jest.fn(() => [2e12]);
			const cleaner = new Cleaner(find, () => []);
			cleaner.setTimer = jest.fn();
			find.mockClear();

			cleaner.stop();
			cleaner._hold = false;
			cleaner._stop = false;
			return cleaner.newTimer().then(() => {
				expect(cleaner.setTimer).toBeCalledWith(now + cleaner.upkeepDelay);
			});
		});

		it('should not run if timer is already set', () => {
			const find = jest.fn(() => []);
			const cleaner = new Cleaner(find, () => []);
			find.mockClear();

			cleaner._cleani = 1;
			cleaner.newTimer();

			expect(cleaner.find).not.toBeCalled();
		});

		it('should not run if stopped or on hold', () => {
			const find = jest.fn(() => []);
			const cleaner = new Cleaner(find, () => []);
			find.mockClear();

			cleaner._hold = false;
			cleaner._stop = true;
			cleaner.newTimer();

			cleaner._hold = true;
			cleaner._stop = false;
			cleaner.newTimer();

			expect(cleaner.find).not.toBeCalled();
		});
	});

	describe('setTimer', () => {
		it('should setup timer for expiring time', () => {
			const cleaner = new Cleaner(() => [], () => []);
			cleaner.stop();
			cleaner._hold = false;
			cleaner._stop = false;

			const time = 2e3;
			const expire = time + now;
			setTimeout.mockClear();
			cleaner.setTimer(expire);

			expect(setTimeout).toBeCalledWith(expect.any(Function), time);
			cleaner.cleanData = jest.fn();
			setTimeout.mock.calls[0][0]();
			expect(cleaner.cleanData).toBeCalled();
		});

		it('should not setTimeout under minimum', () => {
			const cleaner = new Cleaner(() => [], () => []);
			cleaner.stop();
			cleaner._hold = false;
			cleaner._stop = false;

			const time = 2;
			const expire = time + now;
			setTimeout.mockClear();
			cleaner.setTimer(expire);

			expect(setTimeout).toBeCalledWith(expect.any(Function), cleaner.expireDelay);
		});

		it('should not set if already running sooner', () => {
			const cleaner = new Cleaner(() => [], () => []);
			cleaner.stop();
			cleaner._hold = false;
			cleaner._stop = false;

			const time = 2e3;
			const expire = time + now;
			cleaner.setTimer(expire);
			setTimeout.mockClear();
			cleaner.setTimer(expire + 1);

			expect(setTimeout).not.toBeCalled();
		});

		it('should not run if stopped or on hold', () => {
			const cleaner = new Cleaner(() => [], () => []);
			Date.now.mockClear();

			cleaner._hold = false;
			cleaner._stop = true;
			cleaner.setTimer(1);

			cleaner._hold = true;
			cleaner._stop = false;
			cleaner.setTimer(1);

			expect(Date.now).not.toBeCalled();
		});

		it('should fail gracefully', () => {
			const cleaner = new Cleaner(() => [], () => []);
			cleaner.stop();
			cleaner._hold = false;
			cleaner._stop = false;

			setTimeout.mockClear();
			cleaner.setTimer(NaN);

			expect(setTimeout).not.toBeCalled();
		});
	});

	describe('cleanData', () => {
		it('should del', () => {
			const del = jest.fn();
			const cleaner = new Cleaner(() => [], del);
			cleaner.cleanData();
			expect(del).toBeCalledWith(now);
		});

		it('should reset newTimer', () => {
			const cleaner = new Cleaner(() => [], () => []);
			cleaner.newTimer = jest.fn();
			return cleaner.cleanData().then(() => {
				expect(cleaner.newTimer).toBeCalled();
			});
		});

		it('should timeout and recover', () => {
			const del = jest.fn(() => new Promise(() => {}));
			const cleaner = new Cleaner(() => [], del);
			cleaner.newTimer = jest.fn();
			cleaner.upkeepDelay = 10;
			cleaner._hold = false;
			cleaner.cleanData();
			return common.delay(cleaner.upkeepDelay + 1).then(() => {
				expect(cleaner.newTimer).toBeCalled();
			});
		});

		it('should recover from failed del', () => {
			const del = () => Promise.reject(new Error());
			const cleaner = new Cleaner(() => [], del);
			cleaner.newTimer = jest.fn();
			return cleaner.cleanData().then(() => {
				expect(cleaner.newTimer).toBeCalled();
			});
		});

		it('should not run if on hold', () => {
			const del = jest.fn(() => new Promise(() => {}));
			const cleaner = new Cleaner(() => [], del);
			cleaner.cleanData();
			expect(cleaner._hold).toBe(true);

			cleaner.cleanData();
			expect(del).toBeCalledTimes(1);
		});
	});
});
