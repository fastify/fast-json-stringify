# fast-json-stringify

[![CI](https://github.com/fastify/fast-json-stringify/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/fastify/fast-json-stringify/actions/workflows/ci.yml)
[![NPM version](https://img.shields.io/npm/v/fast-json-stringify.svg?style=flat)](https://www.npmjs.com/package/fast-json-stringify)
[![neostandard javascript style](https://img.shields.io/badge/code_style-neostandard-brightgreen?style=flat)](https://github.com/neostandard/neostandard)
[![NPM downloads](https://img.shields.io/npm/dm/fast-json-stringify.svg?style=flat)](https://www.npmjs.com/package/fast-json-stringify)

__fast-json-stringify__ serializes JSON payloads described by a JSON Schema: undeclared properties are stripped, types are coerced and formats applied, so the output is exactly what the schema declares. How fast it is relative to `JSON.stringify()` depends on the Node.js version:

- On Node.js 24 and older, the generated code is faster than `JSON.stringify()` on short strings and dates and slower on objects: about 1.3x slower on a three-property object, 2-3x slower on realistic API responses.
- On Node.js 25+, V8 ships a `JSON.stringify()` fast path that no JavaScript code can beat on plain data. With [`objectMechanism: 'native'`](#objectmechanism) fast-json-stringify delegates to that fast path while still applying the schema, serializing within 2-6% of a bare `JSON.stringify()` on plain objects and several times faster than it on real-world payloads (`Date` fields, undeclared ORM columns, class instances), where the fast path bails out. If you run on Node.js 25+, enable it (see [when to use it](#objectmechanism)).


### How it works

fast-json-stringify requires a [JSON Schema Draft 7](https://json-schema.org/specification-links#draft-7) input to generate a fast `stringify` function.

##### Benchmarks

**Node.js 26** (`v26.12.0`, fast-json-stringify 7.3.5), machine `Apple Silicon, macOS`. `fast-json-stringify [native]` is `objectMechanism: 'native'`:

```
AJV creation and first stringify x 7,502,118 ops/sec ±0.45% (7249640 runs sampled)
json-accelerator creation and first stringify x 1,263,084 ops/sec ±2.30% (1229682 runs sampled)
compile-json-stringify creation and first stringify x 714,957 ops/sec ±0.26% (700461 runs sampled)
fast-json-stringify creation and first stringify x 118,538 ops/sec ±0.69% (111943 runs sampled)
JSON.stringify array x 29,428 ops/sec ±0.27% (29069 runs sampled)
fast-json-stringify [default] array x 10,645 ops/sec ±0.38% (10486 runs sampled)
fast-json-stringify [json-stringify] array x 10,641 ops/sec ±0.37% (10486 runs sampled)
json-accelerator array x 10,285 ops/sec ±0.40% (10119 runs sampled)
compile-json-stringify array x 9,536 ops/sec ±0.38% (9405 runs sampled)
AJV array x 9,058 ops/sec ±0.51% (8861 runs sampled)
fast-json-stringify [json-stringify] large array x 1,382 ops/sec ±0.41% (1376 runs sampled)
JSON.stringify large array x 1,371 ops/sec ±0.46% (1364 runs sampled)
fast-json-stringify [default] large array x 496 ops/sec ±3.09% (465 runs sampled)
compile-json-stringify large array x 432 ops/sec ±1.25% (426 runs sampled)
AJV large array x 372 ops/sec ±4.04% (332 runs sampled)
fast-json-stringify long string x 63,760 ops/sec ±0.08% (63551 runs sampled)
JSON.stringify long string x 63,415 ops/sec ±0.10% (63066 runs sampled)
json-accelerator long string x 62,846 ops/sec ±0.19% (62280 runs sampled)
compile-json-stringify long string x 61,975 ops/sec ±0.15% (61243 runs sampled)
AJV long string x 28,146 ops/sec ±0.13% (27970 runs sampled)
compile-json-stringify short string x 23,022,913 ops/sec ±0.05% (22111249 runs sampled)
JSON.stringify short string x 21,723,683 ops/sec ±0.59% (19993757 runs sampled)
json-accelerator short string x 21,707,301 ops/sec ±1.86% (19787846 runs sampled)
fast-json-stringify short string x 21,638,305 ops/sec ±1.59% (19745443 runs sampled)
AJV short string x 15,821,850 ops/sec ±4.40% (13672118 runs sampled)
JSON.stringify obj x 13,866,829 ops/sec ±1.20% (12601821 runs sampled)
fast-json-stringify [native] obj x 13,563,393 ops/sec ±4.20% (12292389 runs sampled)
fast-json-stringify obj x 7,952,375 ops/sec ±0.14% (7846666 runs sampled)
json-accelerator obj x 7,793,437 ops/sec ±0.28% (7602119 runs sampled)
AJV obj x 7,558,615 ops/sec ±3.23% (7022145 runs sampled)
compile-json-stringify obj x 7,321,680 ops/sec ±4.99% (6868015 runs sampled)
fast-json-stringify date x 2,388,475 ops/sec ±0.05% (2376821 runs sampled)
json-accelerate date x 2,382,662 ops/sec ±2.54% (2319591 runs sampled)
JSON.stringify date x 1,691,933 ops/sec ±0.04% (1686490 runs sampled)
compile-json-stringify date x 1,691,225 ops/sec ±0.06% (1682910 runs sampled)
JSON.stringify user profile response x 860,216 ops/sec ±0.43% (849697 runs sampled)
fast-json-stringify [native] user profile response x 814,035 ops/sec ±0.08% (810499 runs sampled)
fast-json-stringify user profile response x 511,317 ops/sec ±0.04% (509913 runs sampled)
JSON.stringify order response x 116,554 ops/sec ±0.07% (116189 runs sampled)
fast-json-stringify [native] order response x 110,042 ops/sec ±0.13% (109666 runs sampled)
fast-json-stringify order response x 84,933 ops/sec ±0.10% (84579 runs sampled)
JSON.stringify paginated products response x 16,299 ops/sec ±0.15% (16273 runs sampled)
fast-json-stringify [native] paginated products response x 15,511 ops/sec ±0.06% (15496 runs sampled)
fast-json-stringify paginated products response x 10,584 ops/sec ±0.20% (10531 runs sampled)
```

The benchmark above only uses plain objects. On an ORM-like payload (a seven-property object with two undeclared columns and two `Date` fields, measured in [#906](https://github.com/fastify/fast-json-stringify/pull/906)) `objectMechanism: 'native'` runs at 4.28M ops/sec against 575k for `JSON.stringify`, about 7x faster, and `JSON.stringify` also emits the undeclared columns.

**Node.js 24** (`v24.22.0`, fast-json-stringify 7.3.5), same machine. Without the V8 fast path `objectMechanism: 'native'` is a no-op, so `[native]` matches the default:

```
AJV creation and first stringify x 7,999,102 ops/sec ±0.10% (7869618 runs sampled)
json-accelerator creation and first stringify x 929,052 ops/sec ±6.69% (885518 runs sampled)
compile-json-stringify creation and first stringify x 280,806 ops/sec ±0.11% (278793 runs sampled)
fast-json-stringify creation and first stringify x 81,224 ops/sec ±0.41% (79266 runs sampled)
JSON.stringify array x 15,390 ops/sec ±0.12% (15359 runs sampled)
fast-json-stringify [default] array x 12,025 ops/sec ±0.29% (11912 runs sampled)
AJV array x 10,402 ops/sec ±0.32% (10296 runs sampled)
compile-json-stringify array x 10,227 ops/sec ±0.27% (10150 runs sampled)
json-accelerator array x 9,452 ops/sec ±0.26% (9386 runs sampled)
fast-json-stringify [json-stringify] array x 7,331 ops/sec ±0.24% (7292 runs sampled)
fast-json-stringify [json-stringify] large array x 716 ops/sec ±0.53% (714 runs sampled)
JSON.stringify large array x 713 ops/sec ±0.63% (710 runs sampled)
fast-json-stringify [default] large array x 547 ops/sec ±0.63% (545 runs sampled)
AJV large array x 468 ops/sec ±1.21% (463 runs sampled)
compile-json-stringify large array x 454 ops/sec ±1.60% (444 runs sampled)
json-accelerator long string x 50,592 ops/sec ±0.09% (50449 runs sampled)
fast-json-stringify long string x 50,122 ops/sec ±0.08% (49965 runs sampled)
JSON.stringify long string x 50,105 ops/sec ±0.09% (49933 runs sampled)
compile-json-stringify long string x 50,013 ops/sec ±0.07% (49909 runs sampled)
AJV long string x 25,887 ops/sec ±0.11% (25811 runs sampled)
fast-json-stringify short string x 23,893,227 ops/sec ±0.03% (24574663 runs sampled)
json-accelerator short string x 23,795,235 ops/sec ±0.03% (24084452 runs sampled)
compile-json-stringify short string x 23,277,974 ops/sec ±0.04% (22621881 runs sampled)
JSON.stringify short string x 17,931,192 ops/sec ±0.03% (15868126 runs sampled)
AJV short string x 16,794,776 ops/sec ±0.03% (14948140 runs sampled)
compile-json-stringify obj x 10,759,909 ops/sec ±0.04% (10342960 runs sampled)
AJV obj x 8,020,994 ops/sec ±2.50% (7751282 runs sampled)
JSON.stringify obj x 7,183,553 ops/sec ±0.09% (7003762 runs sampled)
json-accelerator obj x 7,164,298 ops/sec ±5.91% (6769549 runs sampled)
fast-json-stringify obj x 5,642,056 ops/sec ±0.14% (5534922 runs sampled)
fast-json-stringify [native] obj x 5,580,243 ops/sec ±5.59% (5322880 runs sampled)
json-accelerate date x 2,482,753 ops/sec ±3.17% (2413223 runs sampled)
fast-json-stringify date x 2,450,987 ops/sec ±2.81% (2386442 runs sampled)
JSON.stringify date x 1,671,128 ops/sec ±5.99% (1612569 runs sampled)
compile-json-stringify date x 1,667,451 ops/sec ±0.10% (1658170 runs sampled)
JSON.stringify user profile response x 724,269 ops/sec ±0.07% (721859 runs sampled)
fast-json-stringify [native] user profile response x 355,683 ops/sec ±0.12% (352431 runs sampled)
fast-json-stringify user profile response x 354,563 ops/sec ±0.11% (352466 runs sampled)
JSON.stringify order response x 138,114 ops/sec ±0.42% (137243 runs sampled)
fast-json-stringify order response x 55,713 ops/sec ±0.10% (55492 runs sampled)
fast-json-stringify [native] order response x 55,113 ops/sec ±0.15% (54840 runs sampled)
JSON.stringify paginated products response x 18,413 ops/sec ±0.06% (18395 runs sampled)
fast-json-stringify paginated products response x 6,279 ops/sec ±0.58% (6245 runs sampled)
fast-json-stringify [native] paginated products response x 6,217 ops/sec ±0.14% (6204 runs sampled)
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
 - <a href="#AnyOf-and-OneOf">`AnyOf` and `OneOf`</a>
 - <a href="#ref">`Reuse - $ref`</a>
 - <a href="#long">`Long integers`</a>
 - <a href="#integer">`Integers`</a>
 - <a href="#nullable">`Nullable`</a>
 - <a href="#largearrays">`Large Arrays`</a>
- <a href="#security">`Security Notice`</a>
- <a href="#debug">`Debug Mode`</a>
- <a href="#standalone">`Standalone Mode`</a>
- <a href="#acknowledgments">`Acknowledgments`</a>
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

<a name="options"></a>
## Options

Optionally, you may provide to `fast-json-stringify` an option object as the second parameter:

```js
const fastJson = require('fast-json-stringify')
const stringify = fastJson(mySchema, {
  schema: { ... },
  ajv: { ... },
  rounding: 'ceil',
  maxDepth: 100
})
```

- `schema`: external schemas references by $ref property. [More details](#ref)
- `ajv`: [ajv v8 instance's settings](https://ajv.js.org/options.html) for those properties that require `ajv`. [More details](#anyof) Schema strictness defaults to `false`; pass `ajv: { strictSchema: true }` to reject unknown schema keywords or `ajv: { strictSchema: 'log' }` to log warnings. This applies only to schema paths compiled by Ajv, not to every schema processed by fast-json-stringify.
- `rounding`: setup how the `integer` types will be rounded when not integers. [More details](#integer)
- `maxDepth`: maximum number of nested schema levels allowed during compilation.
Defaults to `100` and may be set from `0` to `100`. Schemas that exceed this limit
are rejected before compilation.
- `inlineValidators`: when using standalone mode, embed Ajv-generated validator functions in the output instead of compiling schemas at runtime. [More details](#standalone)
- `largeArrayMechanism`: set the mechanism that should be used to handle large
(by default `20000` or more items) arrays. [More details](#largearrays)
- `objectMechanism`: set the mechanism used to serialize objects. `'native'` projects the input into schema-shaped scratch objects and delegates to the native `JSON.stringify`, which is much faster on Node.js 25+. [More details](#objectmechanism)
- `compileValidators`: when `true`, the `ajv` validators used by `anyOf`, `oneOf` and `if/then/else` are compiled during `build()` instead of lazily, on the first serialization that reaches them. This makes `build()` slower but removes a potentially large one-off cost
from the first `stringify()` call. Defaults to `false`.


<a name="api"></a>
## API
<a name="fastJsonStringify"></a>
### fastJsonStringify(schema)

Build a `stringify()` function based on [jsonschema draft 7 spec](https://json-schema.org/specification-links#draft-7).

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

[JSON Schema built-in formats](https://json-schema.org/draft/2020-12/draft-bhutton-json-schema-validation-00#rfc.section.7.3.1) for dates are supported and will be serialized as:

| Format      | Serialized format example  |
| ----------- | -------------------------- |
| `date-time` | `2020-04-03T09:11:08.615Z` |
| `date`      | `2020-04-03`               |
| `time`      | `09:11:08`                 |

**Note**: In the case of a string formatted Date and not Date Object, the value is not reformatted nor validated: it should already be properly formatted. It is only escaped, so that the resulting document is always valid JSON.

Example with a Date object:

```javascript
const stringify = fastJson({
  title: 'Example Schema with string date-time field',
  type: 'string',
  format: 'date-time'
})

const date = new Date()
console.log(stringify(date)) // '"YYYY-MM-DDTHH:mm:ss.sssZ"'
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
  otherfoo: 'str',
  matchnum: 3
}

console.log(stringify(obj)) // '{"matchfoo":"42","otherfoo":"str","matchnum":3,"nickname":"nick"}'
```

<a name="additionalProperties"></a>
#### Additional properties
`fast-json-stringify` supports additional properties as defined by JSON schema.
*additionalProperties* must be an object or a boolean, declared in this way: `{ type: 'type' }`.
*additionalProperties* will work only for the properties that are not explicitly listed in the *properties* and *patternProperties* objects.

If *additionalProperties* is not present or is set to `false`, every property that is not explicitly listed in the *properties* and *patternProperties* objects will be ignored, as described in <a href="#missingFields">Missing fields</a>.
Missing fields are ignored to avoid having to rewrite objects before serializing. However, other schema rules would throw in similar situations.
If *additionalProperties* is set to `true`, it will be used by `JSON.stringify` to stringify the additional properties. If you want to achieve maximum performance, we strongly encourage you to use a fixed schema where possible.
The additional properties will always be serialized at the end of the object.
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
  otherfoo: 'str',
  matchnum: 3,
  nomatchstr: 'valar morghulis',
  nomatchint: 313
}

console.log(stringify(obj)) // '{"nickname":"nick","matchfoo":"42","otherfoo":"str","matchnum":3,"nomatchstr":"valar morghulis",nomatchint:"313"}'
```

#### AnyOf and OneOf

`fast-json-stringify` supports the **anyOf** and **oneOf** keywords as defined by JSON schema. Both must be an array of valid JSON schemas. The different schemas will be tested in the specified order. The more schemas `stringify` has to try before finding a match, the slower it will be.

*anyOf* and *oneOf* use [ajv](https://www.npmjs.com/package/ajv) as a JSON schema validator to find the schema that matches the data. This has an impact on performance—only use it as a last resort.

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
        required: ['savedId']
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
The value of `$ref` must be a string in [JSON Pointer](https://datatracker.ietf.org/doc/html/rfc6901) format.
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
By default, the library will handle automatically [BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt).

<a name="integer"></a>
#### Integers
The `type: integer` property will be truncated if a floating point is provided.
You can customize this behavior with the `rounding` option that will accept [`round`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round), [`ceil`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/ceil), [`floor`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/floor), or [`trunc`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc). Default is `trunc`:

```js
const stringify = fastJson(schema, { rounding: 'ceil' })
```


<a name="nullable"></a>
#### Nullable

According to the [Open API 3.0 specification](https://swagger.io/docs/specification/v3_0/data-models/data-types/#null), a value that can be null must be declared `nullable`.

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
- `object` -> `{}`
- `array` -> `[]`

<a name="largearrays"></a>
#### Large Arrays

Large arrays are, for the scope of this document, defined as arrays containing,
by default, `20000` elements or more. That value can be adjusted via the option
parameter `largeArraySize`.

At some point the overhead caused by the default mechanism used by
`fast-json-stringify` to handle arrays starts increasing exponentially, leading
to slow overall executions.

##### Settings

In order to improve that the user can set the `largeArrayMechanism` and
`largeArraySize` options.

`largeArrayMechanism`'s default value is `default`. Valid values for it are:

- `default` - This option keeps the full feature set of this lib: every element
is still coerced to the type declared in `items`, and type errors are still
thrown. Arrays of plain primitives (`string`, `number`, `integer`) use a
copy-then-`JSON.stringify` strategy with their own length cutoffs, see
[Primitive arrays](#primitive-arrays) below; `largeArraySize` does not affect
them.
- `json-stringify` - This option will remove support for schema validation
within **large arrays** completely. By doing so the overhead previously
mentioned is nulled, greatly improving execution time. Mind there's no change
in behavior for arrays not considered _large_

`largeArraySize`'s default value is `20000`. Valid values for it are
integer-like values, such as:

- `20000`
- `2e4`
- `'20000'`
- `'2e4'` - _note this will be converted to `2`, not `20000`_
- `1.5` - _note this will be converted to `1`_

<a name="primitive-arrays"></a>
##### Primitive arrays

With `largeArrayMechanism: 'default'`, arrays whose `items` schema is a plain
`{ type: 'string' }`, `{ type: 'number' }` or `{ type: 'integer' }` (no
`format`, `nullable`, `const`, or combinator keyword; a `$ref` to a plain
string schema also qualifies, a `$ref` for `number`/`integer` does not) are
serialized by copying the elements into a fresh array and calling the native
`JSON.stringify` on the copy, which is several times faster than appending one
element at a time. This happens at or above a length cutoff that does not
depend on `largeArraySize`. The cutoffs are the array lengths above which the
copy beats the per-element loop, and they depend on the V8 version:

| Node.js | `string` | `number` | `integer` |
|---|---:|---:|---:|
| 22 and later | 8 elements | 128 elements | 512 elements |
| 20 | 128 elements | 300000 elements | 300000 elements |

Below the cutoff the array is serialized element by element as before. Above
it, the elements are copied until one is found that is not already of the
declared type (not a string, not a `number`, or not an integer for `integer`);
that element and the ones after it go through the regular per-element coercion
and validation (`null` still becomes `""` or `0`, `rounding` still applies,
`NaN` still throws). The output is byte-identical either way. Arrays of
`boolean`, `null`, objects, or any other `items` schema are not affected.

In [standalone mode](#standalone) the cutoffs are baked into the generated
code, so the generated module inherits the cutoffs of the Node.js version that
ran `build()`, not of the one that runs the module.

<a name="objectmechanism"></a>
#### Object mechanism

By default every object is serialized by generated code that appends the JSON
text property by property. Since V8 13.8 (Node.js 25+) the native
`JSON.stringify` has a side-effect-free fast path that no JavaScript string
building can match, but that fast path bails out as soon as the input carries a
`Date`, a `toJSON`, a class prototype or any property that is not plain data.

With `objectMechanism: 'native'`, `fast-json-stringify` instead *projects* the
input into preallocated scratch objects whose keys are exactly the schema
properties, in schema order, and hands the scratch to the native
`JSON.stringify`. The scratch is plain by construction, so the fast path is
always taken, whatever the input looks like, while the schema is still applied:
undeclared properties are dropped, `required` is enforced, `default` applied,
types coerced and `format: date-time` / `date` / `time` rendered as before.
The output is byte-identical to the default mechanism.

```js
const stringify = fastJson(schema, { objectMechanism: 'native' })
```

The projection covers schemas made only of:

- `object` with `properties` (no `additionalProperties`, `patternProperties`,
  `nullable`, `dependencies`, combinators or `$ref`), with at least one property;
- `string` (optionally with `format: date-time`, `date` or `time`), `number`,
  `integer`, `boolean`, without `nullable`, `const`, `enum`, combinators or `$ref`;
- the two-element forms `['string', 'null']`, `['number', 'null']` and
  `['boolean', 'null']` (in either order), with the same strict type dispatch
  as the default mechanism;
- `array` whose `items` is one such schema (no tuples), nested to any depth;
  every array element gets its own scratch objects.

Any other schema silently uses the default mechanism, so the option is always
safe to enable. The projection only pays off where V8 has the fast path, so on
Node.js 24 and older the option is a no-op and the default mechanism is used.
On Node.js 25+ the projection serializes plain objects within 3-15% of a bare
`JSON.stringify` (2-6% on the fixtures in `benchmark/`; the default mechanism
is 25-45% behind it there), and objects coming from an ORM (extra columns,
`Date` instances, class prototypes) several times faster than both the default
mechanism and `JSON.stringify` itself.

The scratch objects are reused across calls; `JSON.stringify` is synchronous,
so this is safe, and no reference to the last input is retained beyond the
primitive values written into the scratch.

**When to use it**

Enable `objectMechanism: 'native'` when your application runs on Node.js 25+.
There is no downside: schemas the projection does not cover keep the default
mechanism, the output is the same, and on older Node.js versions the option
does nothing. It pays off most when:

- the serialized objects are not plain data: ORM entities or class instances,
  objects with `Date` properties or a `toJSON`, or objects carrying columns
  that the schema does not declare (the usual case for a response schema).
  On such input a bare `JSON.stringify` loses its fast path and emits the
  undeclared columns; the projection stays on the fast path and strips them,
  several times faster than both the default mechanism and `JSON.stringify`;
- the response is a list of objects, or a large object: that is where the
  default mechanism is furthest behind `JSON.stringify` (1.4-1.7x on the
  `benchmark/fixtures/api-responses` schemas on Node.js 25+).

Keep the default mechanism when a benchmark on your own payloads shows no
gain, or on Node.js 24 and older, where the option has no effect. The two
mechanisms are interchangeable at any time, since they produce the same output.

With Fastify, pass the option through `serializerOpts`:

```js
const app = fastify({
  serializerOpts: { objectMechanism: 'native' }
})
```

<a name="unsafe"></a>
#### Unsafe string
By default, the library escapes all strings. With the 'unsafe' format, the string isn't escaped. This has a potentially dangerous security issue. You can use it only if you are sure that your data doesn't need escaping. The advantage is a significant performance improvement.

Example:
```javascript
const stringify = fastJson({
  title: 'Example Schema',
  type: 'object',
  properties: {
    'code': {
      type: 'string',
      format: 'unsafe'
    }
  }
})
```

##### Benchmarks

For reference, here are some benchmarks for comparison over the three
mechanisms. Benchmarks were conducted on an old machine.

- Machine: `ST1000LM024 HN-M 1TB HDD, Intel Core i7-3610QM @ 2.3GHz, 12GB RAM, 4C/8T`.
- Node.js `v16.13.1`

```
JSON.stringify large array x 157 ops/sec ±0.73% (86 runs sampled)
fast-json-stringify large array default x 48.72 ops/sec ±4.92% (48 runs sampled)
fast-json-stringify large array json-stringify x 157 ops/sec ±0.76% (86 runs sampled)
compile-json-stringify large array x 175 ops/sec ±4.47% (79 runs sampled)
AJV Serialize large array x 58.76 ops/sec ±4.59% (60 runs sampled)
```

<a name="security"></a>
## Security notice

Treat the schema definition as application code, it
is not safe to use user-provided schemas.

To achieve low cost and high performance redaction `fast-json-stringify`
creates and compiles a function (using the `Function` constructor) on initialization.
While the `schema` is currently validated for any developer errors,
there is no guarantee that supplying user-generated schema could not
expose your application to remote attacks.

Users are responsible for sending trusted data. `fast-json-stringify` guarantees that you will get
a valid output only if your input matches the schema or can be coerced to the schema. If your input
doesn't match the schema, you will get undefined behavior.

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
}, { mode: 'debug' })

console.log(debugCompiled) // it is a object contain code, ajv instance
const rawString = debugCompiled.code // it is the generated code
console.log(rawString)

const stringify = fastJson.restore(debugCompiled) // use the generated string to get back the `stringify` function
console.log(stringify({ firstName: 'Foo', surname: 'bar' })) // '{"firstName":"Foo"}'
```

<a name="standalone"></a>
### Standalone Mode

The standalone mode is used to compile the code that can be directly run by `node`
itself. You need to have `fast-json-stringify` installed for the standalone code to work.

```js
const fs = require('fs')
const code = fastJson({
  title: 'default string',
  type: 'object',
  properties: {
    firstName: {
      type: 'string'
    }
  }
}, { mode: 'standalone', inlineValidators: true })

fs.writeFileSync('stringify.js', code)
const stringify = require('stringify.js')
console.log(stringify({ firstName: 'Foo', surname: 'bar' })) // '{"firstName":"Foo"}'
```

Set `inlineValidators` to `true` to include the Ajv-generated functions used by
`anyOf`, `oneOf`, and `if/then/else` in the same output file. This avoids
rebuilding an Ajv instance and compiling their schemas at runtime. The
generated module still requires `fast-json-stringify` for its serializer and
may require Ajv runtime helpers used by the generated validation code. Custom
Ajv formats used by these schemas must support Ajv's standalone code
generation.

The generated code also bakes in the length cutoffs used for
[number and integer arrays](#largearrays). Those cutoffs are chosen for the
Node.js version that ran `build()`; a module built on Node.js 20 and run on
Node.js 22 or later keeps the Node.js 20 cutoffs, and vice versa. The output is
the same either way, only the speed differs.

<a name="acknowledgments"></a>
## Acknowledgments

This project was kindly sponsored by [nearForm](https://nearform.com).

<a name="license"></a>
## License

Licensed under [MIT](./LICENSE).
