# fast-json-stringify

![CI](https://github.com/fastify/fast-json-stringify/workflows/CI/badge.svg)
[![NPM version](https://img.shields.io/npm/v/fast-json-stringify.svg?style=flat)](https://www.npmjs.com/package/fast-json-stringify)
[![Known Vulnerabilities](https://snyk.io/test/github/fastify/fast-json-stringify/badge.svg)](https://snyk.io/test/github/fastify/fast-json-stringify)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://standardjs.com/)
[![NPM downloads](https://img.shields.io/npm/dm/fast-json-stringify.svg?style=flat)](https://www.npmjs.com/package/fast-json-stringify)


__fast-json-stringify__ is significantly faster than `JSON.stringify()` for small payloads. Its performance advantage shrinks as your payload grows. It pairs well with [__flatstr__](https://www.npmjs.com/package/flatstr), which triggers a V8 optimization that improves performance when eventually converting the string to a `Buffer`.

##### Benchmarks

- Machine: `EX41S-SSD, Intel Core i7, 4Ghz, 64GB RAM, 4C/8T, SSD`.
- Node.js `v12.16.2`

```
FJS creation x 59,805 ops/sec ±0.23% (91 runs sampled)

JSON.stringify array x 5,330 ops/sec ±0.54% (97 runs sampled)
fast-json-stringify array x 6,995 ops/sec ±0.24% (94 runs sampled)

JSON.stringify long string x 15,108 ops/sec ±0.13% (100 runs sampled)
fast-json-stringify long string x 15,089 ops/sec ±0.15% (98 runs sampled)

JSON.stringify short string x 13,214,696 ops/sec ±0.19% (97 runs sampled)
fast-json-stringify short string x 33,378,500 ops/sec ±0.27% (95 runs sampled)

JSON.stringify obj x 3,172,653 ops/sec ±0.15% (98 runs sampled)
fast-json-stringify obj x 13,537,123 ops/sec ±0.19% (95 runs sampled)
```

#### Table of contents:
- <a href="#example">`Example`</a>
- <a href="#options">`Options`</a>
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
 - <a href="#integer">`Integers`</a>
 - <a href="#nullable">`Nullable`</a>
- <a href="#security">`Security Notice`</a>
- <a href="#acknowledgements">`Acknowledgements`</a>
- <a href="#license">`License`</a>


<a name="example"></a>
Try it out on RunKit: <a href="https://runkit.com/npm/fast-json-stringify">https://runkit.com/npm/fast-json-stringify</a>
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

<a name="options"></a>
## Options

Optionally, you may provide to `fast-json-stringify` an option object as second parameter:

```js
const fastJson = require('fast-json-stringify')
const stringify = fastJson(mySchema, {
  schema: { ... },
  ajv: { ... },
  rounding: 'ceil'
})
```

- `schema`: external schemas references by $ref property. [More details](#ref)
- `ajv`: ajv instance's settings for those properties that require `ajv`. [More details](#anyof)
- `rounding`: setup how the `integer` types will be rounded when not integers. [More details](#integer)


<a name="api"></a>
## API
<a name="fastJsonStringify"></a>
### fastJsonStringify(schema)

Build a `stringify()` function based on [jsonschema](https://json-schema.org/).

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

| Instance | Serialized as                |
| -------- | ---------------------------- |
| `Date`   | `string` via `toISOString()` |
| `RegExp` | `string`                     |
| `BigInt` | `integer` via `toString`     |

[JSON Schema built-in formats](https://json-schema.org/understanding-json-schema/reference/string.html#built-in-formats) for dates are supported and will be serialized as:

| Format      | Serialized format example  |
| ----------- | -------------------------- |
| `date-time` | `2020-04-03T09:11:08.615Z` |
| `date`      | `2020-04-03`               |
| `time`      | `09:11:08`                 |

Example with a MomentJS object:

```javascript
const moment = require('moment')

const stringify = fastJson({
  title: 'Example Schema with string date-time field',
  type: 'string',
  format: 'date-time'
})

console.log(stringify(moment())) // '"YYYY-MM-DDTHH:mm:ss.sssZ"'
```


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
The additional properties will always be serialzied at the end of the object.
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

console.log(stringify(obj)) // '{"nickname":"nick","matchfoo":"42","otherfoo":"str","matchnum":3,"nomatchstr":"valar morghulis",nomatchint:"313"}'
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
})
```

When specifying object JSON schemas for *anyOf*, add *required* validation keyword to match only the objects with the properties you want.

Example:
```javascript
const stringify = fastJson({
  title: 'Example Schema',
  type: 'array',
  items: {
    anyOf: [
      {
        type: 'object',
        properties: {
          savedId: { type: 'string' }
        },
        // without "required" validation any object will match
        required: ['saveId']
      },
      {
        type: 'object',
        properties: {
          error: { type: 'string' }
        },
        required: ['error']
      }
    ]
  }
})
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

**NB** Do not declare the properties twice or you will print them twice!

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
By default the library will automatically handle [BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt) from Node.js v10.3 and above.
If you can't use BigInts in your environment, long integers (64-bit) are also supported using the [long](https://github.com/dcodeIO/long.js) module.
Example:
```javascript
// => using native BigInt
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
  id: 18446744073709551615n
}

console.log(stringify(obj)) // '{"id":18446744073709551615}'

// => using the long library
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

<a name="integer"></a>
#### Integers
The `type: integer` property will be truncated if a floating point is provided.
You can customize this behaviour with the `rounding` option that will accept [`round`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round), [`ceil`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/ceil) or [`floor`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/floor):

```js
const stringify = fastJson(schema, { rounding: 'ceil' })
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

<a name="security"></a>
## Security notice

Treat the schema definition as application code, it
is not safe to use user-provided schemas.

In order to achieve lowest cost/highest performance redaction `fast-json-stringify`
creates and compiles a function (using the `Function` constructor) on initialization.
While the `schema` is currently validated for any developer errors,
there is no guarantee that supplying user-generated schema could not
expose your application to remote attacks.

<a name="debug"></a>
### Debug Mode

The debug mode can be activated during your development to understand what is going on when things do not
work as you expect.

```js
const debugCompiled = fastJson({
  title: 'default string',
  type: 'object',
  properties: {
    firstName: {
      type: 'string'
    }
  }
}, { debugMode: true })

console.log(debugCompiled) // it is an array of functions that can create your `stringify` function
console.log(debugCompiled.toString()) // print a "ready to read" string function, you can save it to a file

const rawString = debugCompiled.toString()
const stringify = fastJson.restore(rawString) // use the generated string to get back the `stringify` function
console.log(stringify({ firstName: 'Foo', surname: 'bar' })) // '{"firstName":"Foo"}'
```

<a name="acknowledgements"></a>
## Acknowledgements

This project was kindly sponsored by [nearForm](https://nearform.com).

<a name="license"></a>
## License

MIT
