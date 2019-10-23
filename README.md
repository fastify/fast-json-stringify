# fast-json-stringify

[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](http://standardjs.com/)  [![Build Status](https://dev.azure.com/fastify/fastify/_apis/build/status/fastify.fast-json-stringify?branchName=master)](https://dev.azure.com/fastify/fastify/_build/latest?definitionId=3&branchName=master)  [![Build Status](https://travis-ci.org/fastify/fast-json-stringify.svg?branch=master)](https://travis-ci.org/fastify/fast-json-stringify)  [![NPM downloads](https://img.shields.io/npm/dm/fast-json-stringify.svg?style=flat)](https://www.npmjs.com/package/fast-json-stringify)

__fast-json-stringify__ is significantly faster than `JSON.stringify()` for small payloads. Its performance advantage shrinks as your payload grows. It pairs well with [__flatstr__](https://www.npmjs.com/package/flatstr), which triggers a V8 optimization that improves performance when eventually converting the string to a `Buffer`.

##### Benchmarks
- Machine: `EX41S-SSD, Intel Core i7, 4Ghz, 64GB RAM, 4C/8T, SSD`.
- Node.js `v10.15.2`

```
FJS creation x 8,951 ops/sec ±0.51% (92 runs sampled)

JSON.stringify array x 5,146 ops/sec ±0.32% (97 runs sampled)
fast-json-stringify array x 8,402 ops/sec ±0.62% (95 runs sampled)
fast-json-stringify-uglified array x 8,474 ops/sec ±0.49% (93 runs sampled)

JSON.stringify long string x 13,061 ops/sec ±0.25% (98 runs sampled)
fast-json-stringify long string x 13,059 ops/sec ±0.21% (98 runs sampled)
fast-json-stringify-uglified long string x 13,099 ops/sec ±0.14% (98 runs sampled)

JSON.stringify short string x 6,295,988 ops/sec ±0.28% (98 runs sampled)
fast-json-stringify short string x 43,335,575 ops/sec ±1.24% (86 runs sampled)
fast-json-stringify-uglified short string x 40,042,871 ops/sec ±1.38% (93 runs sampled)

JSON.stringify obj x 2,557,026 ops/sec ±0.20% (97 runs sampled)
fast-json-stringify obj x 9,001,890 ops/sec ±0.48% (90 runs sampled)
fast-json-stringify-uglified obj x 9,073,607 ops/sec ±0.41% (94 runs sampled)
```

#### Table of contents:
- <a href="#example">`Example`</a>
- <a href="#api">`API`</a>
 - <a href="#fastJsonStringify">`fastJsonStringify`</a>
 - <a href="#specific">`Specific use cases`</a>
 - <a href="#required">`Required`</a>
 - <a href="#missingFields">`Missing fields`</a>
 - <a href="#patternProperties">`Pattern Properties`</a>
 - <a href="#additionalProperties">`Additional Properties`</a>
 - <a href="#anyof">`AnyOf`</a>
 - <a href="#ref">`Reuse - $ref`</a>
 - <a href="#long">`Long integers`</a>
 - <a href="#uglify">`Uglify`</a>
 - <a href="#nullable">`Nullable`</a>
- <a href="#caveat">`Caveat`</a>
- <a href="#acknowledgements">`Acknowledgements`</a>
- <a href="#license">`License`</a>


<a name="example"></a>
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
    },
    reg: {
      type: 'string'
    }
  }
})

console.log(stringify({
  firstName: 'Matteo',
  lastName: 'Collina',
  age: 32,
  reg: /"([^"]|\\")*"/
}))
```
<a name="api"></a>
## API
<a name="fastJsonStringify"></a>
### fastJsonStringify(schema)

Build a `stringify()` function based on
[jsonschema](http://json-schema.org/).

Supported types:

 * `'string'`
 * `'integer'`
 * `'number'`
 * `'array'`
 * `'object'`
 * `'boolean'`
 * `'null'`

And nested ones, too.

<a name="specific"></a>
#### Specific use cases

| Instance   | Serialized as                |
| -----------|------------------------------|
| `Date`     | `string` via `toISOString()` |
| `RegExp`   | `string`                     |

<a name="required"></a>
#### Required
You can set specific fields of an object as required in your schema by adding the field name inside the `required` array in your schema.
Example:
```javascript
const schema = {
  title: 'Example Schema with required field',
  type: 'object',
  properties: {
    nickname: {
      type: 'string'
    },
    mail: {
      type: 'string'
    }
  },
  required: ['mail']
}
```
If the object to stringify is missing the required field(s), `fast-json-stringify` will throw an error.

<a name="missingFields"></a>
#### Missing fields
If a field *is present* in the schema (and is not required) but it *is not present* in the object to stringify, `fast-json-stringify` will not write it in the final string.
Example:
```javascript
const stringify = fastJson({
  title: 'Example Schema',
  type: 'object',
  properties: {
    nickname: {
      type: 'string'
    },
    mail: {
      type: 'string'
    }
  }
})

const obj = {
  mail: 'mail@example.com'
}

console.log(stringify(obj)) // '{"mail":"mail@example.com"}'
```

<a name="defaults"></a>
#### Defaults
`fast-json-stringify` supports `default` jsonschema key in order to serialize a value
if it is `undefined` or not present.

Example:
```javascript
const stringify = fastJson({
  title: 'Example Schema',
  type: 'object',
  properties: {
    nickname: {
      type: 'string',
      default: 'the default string'
    }
  }
})

console.log(stringify({})) // '{"nickname":"the default string"}'
console.log(stringify({nickname: 'my-nickname'})) // '{"nickname":"my-nickname"}'
```

<a name="patternProperties"></a>
#### Pattern properties
`fast-json-stringify` supports pattern properties as defined by JSON schema.
*patternProperties* must be an object, where the key is a valid regex and the value is an object, declared in this way: `{ type: 'type' }`.
*patternProperties* will work only for the properties that are not explicitly listed in the properties object.
Example:
```javascript
const stringify = fastJson({
  title: 'Example Schema',
  type: 'object',
  properties: {
    nickname: {
      type: 'string'
    }
  },
  patternProperties: {
    'num': {
      type: 'number'
    },
    '.*foo$': {
      type: 'string'
    }
  }
})

const obj = {
  nickname: 'nick',
  matchfoo: 42,
  otherfoo: 'str'
  matchnum: 3
}

console.log(stringify(obj)) // '{"matchfoo":"42","otherfoo":"str","matchnum":3,"nickname":"nick"}'
```

<a name="additionalProperties"></a>
#### Additional properties
`fast-json-stringify` supports additional properties as defined by JSON schema.
*additionalProperties* must be an object or a boolean, declared in this way: `{ type: 'type' }`.
*additionalProperties* will work only for the properties that are not explicitly listed in the *properties* and *patternProperties* objects.

If *additionalProperties* is not present or is set to `false`, every property that is not explicitly listed in the *properties* and *patternProperties* objects,will be ignored, as described in <a href="#missingFields">Missing fields</a>.
Missing fields are ignored to avoid having to rewrite objects before serializing. However, other schema rules would throw in similar situations.
If *additionalProperties* is set to `true`, it will be used by `JSON.stringify` to stringify the additional properties. If you want to achieve maximum performance, we strongly encourage you to use a fixed schema where possible.
Example:
```javascript
const stringify = fastJson({
  title: 'Example Schema',
  type: 'object',
  properties: {
    nickname: {
      type: 'string'
    }
  },
  patternProperties: {
    'num': {
      type: 'number'
    },
    '.*foo$': {
      type: 'string'
    }
  },
  additionalProperties: {
    type: 'string'
  }
})

const obj = {
  nickname: 'nick',
  matchfoo: 42,
  otherfoo: 'str'
  matchnum: 3,
  nomatchstr: 'valar morghulis',
  nomatchint: 313
}

console.log(stringify(obj)) // '{"matchfoo":"42","otherfoo":"str","matchnum":3,"nomatchstr":"valar morghulis",nomatchint:"313","nickname":"nick"}'
```

#### AnyOf

`fast-json-stringify` supports the anyOf keyword as defined by JSON schema. *anyOf* must be an array of valid JSON schemas. The different schemas will be tested in the specified order. The more schemas `stringify` has to try before finding a match, the slower it will be.

*anyOf* uses [ajv](https://www.npmjs.com/package/ajv) as a JSON schema validator to find the schema that matches the data. This has an impact on performance—only use it as a last resort.

Example:
```javascript
const stringify = fastJson({
  title: 'Example Schema',
  type: 'object',
  properties: {
    'undecidedType': {
      'anyOf': [{
	type: 'string'
      }, {
	type: 'boolean'
      }]
    }
  }
}
```

<a name="if-then-else"></a>
#### If/then/else
`fast-json-stringify` supports `if/then/else` jsonschema feature. See [ajv documentation](https://ajv.js.org/keywords.html#ifthenelse).

Example:
```javascript
const stringify = fastJson({
  'type': 'object',
  'properties': {
  },
  'if': {
    'properties': {
      'kind': { 'type': 'string', 'enum': ['foobar'] }
    }
  },
  'then': {
    'properties': {
      'kind': { 'type': 'string', 'enum': ['foobar'] },
      'foo': { 'type': 'string' },
      'bar': { 'type': 'number' }
    }
  },
  'else': {
    'properties': {
      'kind': { 'type': 'string', 'enum': ['greeting'] },
      'hi': { 'type': 'string' },
      'hello': { 'type': 'number' }
    }
  }
})

console.log(stringify({
  kind: 'greeting',
  foo: 'FOO',
  bar: 42,
  hi: 'HI',
  hello: 45
})) // {"kind":"greeting","hi":"HI","hello":45}
console.log(stringify({
  kind: 'foobar',
  foo: 'FOO',
  bar: 42,
  hi: 'HI',
  hello: 45
})) // {"kind":"foobar","foo":"FOO","bar":42}
```

**NB:** don't declare the properties twice or you'll print them twice!

<a name="ref"></a>
#### Reuse - $ref
If you want to reuse a definition of a value, you can use the property `$ref`.
The value of `$ref` must be a string in [JSON Pointer](https://tools.ietf.org/html/rfc6901) format.
Example:
```javascript
const schema = {
  title: 'Example Schema',
  definitions: {
    num: {
      type: 'object',
      properties: {
        int: {
          type: 'integer'
        }
      }
    },
    str: {
      type: 'string'
    }
  },
  type: 'object',
  properties: {
    nickname: {
      $ref: '#/definitions/str'
    }
  },
  patternProperties: {
    'num': {
      $ref: '#/definitions/num'
    }
  },
  additionalProperties: {
    $ref: '#/definitions/def'
  }
}

const stringify = fastJson(schema)
```
If you need to use an external definition, you can pass it as an option to `fast-json-stringify`.
Example:
```javascript
const schema = {
  title: 'Example Schema',
  type: 'object',
  properties: {
    nickname: {
      $ref: 'strings#/definitions/str'
    }
  },
  patternProperties: {
    'num': {
      $ref: 'numbers#/definitions/num'
    }
  },
  additionalProperties: {
    $ref: 'strings#/definitions/def'
  }
}

const externalSchema = {
  numbers: {
    definitions: {
      num: {
        type: 'object',
        properties: {
          int: {
            type: 'integer'
          }
        }
      }
    }
  },
  strings: require('./string-def.json')
}

const stringify = fastJson(schema, { schema: externalSchema })
```
External definitions can also reference each other.
Example:
```javascript
const schema = {
  title: 'Example Schema',
  type: 'object',
  properties: {
    foo: {
      $ref: 'strings#/definitions/foo'
    }
  }
}

const externalSchema = {
  strings: {
    definitions: {
      foo: {
        $ref: 'things#/definitions/foo'
      }
    }
  },
  things: {
    definitions: {
      foo: {
        type: 'string'
      }
    }
  }
}

const stringify = fastJson(schema, { schema: externalSchema })
```

<a name="long"></a>
#### Long integers
Long integers (64-bit) are supported using the [long](https://github.com/dcodeIO/long.js) module.
Example:
```javascript
const Long = require('long')

const stringify = fastJson({
  title: 'Example Schema',
  type: 'object',
  properties: {
    id: {
      type: 'integer'
    }
  }
})

const obj = {
  id: Long.fromString('18446744073709551615', true)
}

console.log(stringify(obj)) // '{"id":18446744073709551615}'
```

<a name="uglify"></a>
#### Uglify
If you want to squeeze a little bit more performance out of the serialization at the cost of readability in the generated code, you can pass `uglify: true` as an option.
Note that you have to manually install `uglify-es` in order for this to work. Only version 3 is supported.
Example:

Note that if you are using Node 8.3.0 or newer, there are no performance gains from using Uglify. See https://www.nearform.com/blog/node-js-is-getting-a-new-v8-with-turbofan/

```javascript

const stringify = fastJson({
  title: 'Example Schema',
  type: 'object',
  properties: {
    id: {
      type: 'integer'
    }
  }
}, { uglify: true })

// stringify is now minified code
console.log(stringify({ some: 'object' })) // '{"some":"object"}'
```

<a name="nullable"></a>
#### Nullable

According to the [Open API 3.0 specification](https://swagger.io/docs/specification/data-models/data-types/#null), a value that can be null must be declared `nullable`.

##### Nullable object
```javascript
const stringify = fastJson({
  'title': 'Nullable schema',
  'type': 'object',
  'nullable': true,
  'properties': {
    'product': {
      'nullable': true,
      'type': 'object',
      'properties': {
        'name': {
          'type': 'string'
        }
      }
    }
  }
})

console.log(stringify({product: {name: "hello"}})) // "{"product":{"name":"hello"}}"
console.log(stringify({product: null})) // "{"product":null}"
console.log(stringify(null)) // null
```

Otherwise, instead of raising an error, null values will be coerced as follows:

- `integer` -> `0`
- `number` -> `0`
- `string` -> `""`
- `boolean` -> `false`

<a name="caveat"></a>
## Caveat

In order to achieve lowest cost/highest performance redaction `fast-json-stringify`
creates and compiles a function (using the `Function` constructor) on initialization.
While the `schema` is currently validated for any developer errors, it's recommended against
allowing user input to directly supply a schema.
It can't be guaranteed that allowing user input for the schema couldn't feasibly expose an attack
vector.

<a name="acknowledgements"></a>
## Acknowledgements

This project was kindly sponsored by [nearForm](http://nearform.com).

<a name="license"></a>
## License

MIT
