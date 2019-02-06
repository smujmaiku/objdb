# Object DB

A simple Object database with emitter.

## Installation

`npm i smujmaiku/objdb`

## Methods

```js
const db = new ObjDb();

db.set('a.b', 1);
db.get('a')
// { b: 1 }

db.on('c', console.log);
db.set('c.d', 2);
// { d: 2 }
```

### `constructor([conf], [db], [debug])`

`conf` is an Object of configurations:

* `debounce`: Time in ms to debounce emits.
* `upkeep`: Time in ms to run cleaning functions.
* `expire`: Default time in ms to expire set data.
* `permanent`: Default set data to not expire.

`db` parameter is sent directly to the `set(db)` method.
`debug` allows providing a function to send some debugging information to.

### `on(name, cb)`

Creates a listener on the `name` provided.

### `once(name, cb)`

Creates a one time listener on the `name` provided.
This will fire immediately if data already exists at that `name`.

### `off(name, [cb])`

Releases a listener matching the `name`.
Should a `cb` be provided that will be matched as well.
Providing `true` as the `name` will release all listeners.

### `get(name)`

Returns data at the `name`.

### `set(name, data, [meta])`

Sets `data` at the `name`.
This will debounce firing emitters related to this `name`.
`meta` Object data will be stored separate of the data and can contain the following:

* `e`: Time to expire against `Date.now()`
* `p`: Flag as permanent and to not expire.

### `set(obj)`

`data` and `meta` Objects can be combined into a single Object `obj` and provided as a single argument.

```js
set({
	'a': 1,
	'a$meta': { p: true },
	'b.c': 2,
});
```

Equals:

```js
set('a', 1, { p: true });
set('b.c', 2);
```

### `del(names)`

Deletes `names` data.
Can be provided an Array of `names`.
This will debounce firing emitters related to these `names`.

### `restore(stream)`

Restores a database from a file `stream`.
Providing a path as the `stream` will create the file stream for that path.

### `backup(stream)`

Creates a database backup to a file `stream`.
Providing a path as the `stream` will create the file stream for that path.

## License

Copyright (c) 2017-2019, Michael Szmadzinski. (MIT License)
