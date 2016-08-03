# fast-json-stringify

__fast-json-stringify__ is x5 faster than `JSON.stringify()`.

Benchmarks:

```
JSON.stringify x 1,681,132 ops/sec ±0.59% (88 runs sampled)
fast-json-stringify x 5,117,658 ops/sec ±1.44% (87 runs sampled)
```

## Example

```js
const fastJson = require('fast-json-stringify')
const stringify = fastJson({
  title: 'Example Schema',
  type: 'object',
  properties: {
    firstName: {
      type: 'string'
    },
    lastName: {
      type: 'string'
    },
    age: {
      description: 'Age in years',
      type: 'integer'
    }
  }
})

console.log(stringify({
  firstName: 'Matteo',
  lastName: 'Collina',
  age: 32
}))
```

## API

### fastJsonStringify(schema)

Build a `stringify()` function based on
[jsonschema](http://json-schema.org/).

Supported types:

 * `integer'
 * `number'
 * `array'
 * `object'
 * `null'

And nested ones, too.
`Date` instances are serialized with `toISOString()`.

## License

MIT
