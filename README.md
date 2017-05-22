# fast-json-stringify&nbsp;&nbsp;[![Build Status](https://travis-ci.org/fastify/fast-json-stringify.svg?branch=master)](https://travis-ci.org/fastify/fast-json-stringify)

__fast-json-stringify__ is x1-4 times faster than `JSON.stringify()`.
It is particularly suited if you are sending small JSON payloads, the
advantages reduces on large payloads.

Benchmarks:

```
JSON.stringify array x 3,288 ops/sec ±5.18% (82 runs sampled)
fast-json-stringify array x 1,813 ops/sec ±10.21% (71 runs sampled)
fast-json-stringify-uglified array x 2,106 ops/sec ±3.23% (83 runs sampled)
JSON.stringify long string x 12,933 ops/sec ±1.27% (87 runs sampled)
fast-json-stringify long string x 12,221 ops/sec ±3.31% (84 runs sampled)
fast-json-stringify-uglified long string x 13,256 ops/sec ±0.95% (92 runs sampled)
JSON.stringify short string x 4,878,641 ops/sec ±1.14% (90 runs sampled)
fast-json-stringify short string x 11,649,100 ops/sec ±0.98% (91 runs sampled)
fast-json-stringify-uglified short string x 11,877,661 ops/sec ±0.91% (90 runs sampled)
JSON.stringify obj x 1,705,377 ops/sec ±2.61% (87 runs sampled)
fast-json-stringify obj x 2,268,915 ops/sec ±1.39% (90 runs sampled)
fast-json-stringify-uglified obj x 2,243,341 ops/sec ±1.11% (89 runs sampled)
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
 - <a href="#ref">`Reuse - $ref`</a>
 - <a href="#long">`Long integers`</a>
 - <a href="#uglify">`Uglify`</a>
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
You can set specific fields of an object as required in your schema, by adding the field name inside the `required` array in your schema.  
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
If the object to stringify has not the required field(s), `fast-json-stringify` will throw an error.

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

<a name="patternProperties"></a>
#### Pattern properties
`fast-json-stringify` supports pattern properties as defined inside JSON schema.  
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
`fast-json-stringify` supports additional properties as defined inside JSON schema.  
*additionalProperties* must be an object or a boolean, declared in this way: `{ type: 'type' }`.  
*additionalProperties* will work only for the properties that are not explicitly listed in the *properties* and *patternProperties* objects.

If *additionalProperties* is not present or is setted to false, every property that is not explicitly listed in the *properties* and *patternProperties* objects, will be ignored, as said in <a href="#missingFields">Missing fields</a>.  
If *additionalProperties* is setted to *true*, it will be used `fast-safe-stringify` to stringify the additional properties. If you want to achieve maximum performances we strongly encourage you to use a fixed schema where possible.  
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
If you want to squeeze a little bit more performance out of the serialisation, at the cost of readability in the generated code, you can pass `uglify: true` as an option.
Note that you have to manually install `uglify-es` in order for it to work. Only version 3 is supported.
Example:
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

<a name="acknowledgements"></a>
## Acknowledgements

This project was kindly sponsored by [nearForm](http://nearform.com).

<a name="license"></a>
## License

MIT
