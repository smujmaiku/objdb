module.exports = Object.assign(
	require('./lib/objdb'),
	require('./lib/common'),
	{
		Emitter: require('./lib/emitter'),
	}
);
