'use strict'

const { describe, it } = require('node:test')
const { deepStrictEqual, equal, throws } = require('node:assert')
const build = require('..')

const nullable = true

const complexObject = {
  type: 'object',
  properties: {
    nullableString: { type: 'string', nullable },
    nullableNumber: { type: 'number', nullable },
    nullableInteger: { type: 'integer', nullable },
    nullableBoolean: { type: 'boolean', nullable },
    nullableNull: { type: 'null', nullable },
    nullableArray: {
      type: 'array',
      nullable: true,
      items: {}
    },
    nullableObject: { type: 'object', nullable: true },
    objectWithNullableProps: {
      type: 'object',
      nullable: false,
      additionalProperties: true,
      properties: {
        nullableString: { type: 'string', nullable },
        nullableNumber: { type: 'number', nullable },
        nullableInteger: { type: 'integer', nullable },
        nullableBoolean: { type: 'boolean', nullable },
        nullableNull: { type: 'null', nullable },
        nullableArray: {
          type: 'array',
          nullable: true,
          items: {}
        }
      }
    },
    arrayWithNullableItems: {
      type: 'array',
      nullable: true,
      items: { type: ['integer', 'string'], nullable: true }
    }
  }
}

const complexData = {
  nullableString: null,
  nullableNumber: null,
  nullableInteger: null,
  nullableBoolean: null,
  nullableNull: null,
  nullableArray: null,
  nullableObject: null,
  objectWithNullableProps: {
    additionalProp: null,
    nullableString: null,
    nullableNumber: null,
    nullableInteger: null,
    nullableBoolean: null,
    nullableNull: null,
    nullableArray: null
  },
  arrayWithNullableItems: [1, 2, null]
}

const complexExpectedResult = {
  nullableString: null,
  nullableNumber: null,
  nullableInteger: null,
  nullableBoolean: null,
  nullableNull: null,
  nullableArray: null,
  nullableObject: null,
  objectWithNullableProps: {
    additionalProp: null,
    nullableString: null,
    nullableNumber: null,
    nullableInteger: null,
    nullableBoolean: null,
    nullableNull: null,
    nullableArray: null
  },
  arrayWithNullableItems: [1, 2, null]
}

const testSet = {
  nullableString: [{ type: 'string', nullable }, null, null],
  nullableNumber: [{ type: 'number', nullable }, null, null],
  nullableInteger: [{ type: 'integer', nullable }, null, null],
  nullableBoolean: [{ type: 'boolean', nullable }, null, null],
  nullableNull: [{ type: 'null', nullable }, null, null],
  nullableArray: [{
    type: 'array',
    nullable: true,
    items: {}
  }, null, null],
  nullableObject: [{ type: 'object', nullable: true }, null, null],
  complexObject: [complexObject, complexData, complexExpectedResult, { ajv: { allowUnionTypes: true } }]
}

Object.keys(testSet).forEach(key => {
  it(`handle nullable:true in ${key} correctly`, (t) => {
    const [
      schema,
      data,
      expected,
      extraOptions
    ] = testSet[key]

    const stringifier = build(schema, extraOptions)
    const result = stringifier(data)
    deepStrictEqual(JSON.parse(result), expected)
  })
})

describe('handle nullable number correctly', (t) => {
  const schema = {
    type: 'number',
    nullable: true
  }
  const stringify = build(schema)

  const data = null
  const result = stringify(data)

  deepStrictEqual(result, JSON.stringify(data))
  deepStrictEqual(JSON.parse(result), data)
})

describe('handle nullable integer correctly', (t) => {
  const schema = {
    type: 'integer',
    nullable: true
  }
  const stringify = build(schema)

  const data = null
  const result = stringify(data)

  deepStrictEqual(result, JSON.stringify(data))
  deepStrictEqual(JSON.parse(result), data)
})

describe('handle nullable boolean correctly', (t) => {
  const schema = {
    type: 'boolean',
    nullable: true
  }
  const stringify = build(schema)

  const data = null
  const result = stringify(data)

  deepStrictEqual(result, JSON.stringify(data))
  deepStrictEqual(JSON.parse(result), data)
})

describe('handle nullable string correctly', (t) => {
  const schema = {
    type: 'string',
    nullable: true
  }
  const stringify = build(schema)

  const data = null
  const result = stringify(data)

  deepStrictEqual(result, JSON.stringify(data))
  deepStrictEqual(JSON.parse(result), data)
})

describe('handle nullable date-time correctly', (t) => {
  const schema = {
    type: 'string',
    format: 'date-time',
    nullable: true
  }
  const stringify = build(schema)

  const data = null
  const result = stringify(data)

  deepStrictEqual(result, JSON.stringify(data))
  deepStrictEqual(JSON.parse(result), data)
})

describe('handle nullable date correctly', (t) => {
  const schema = {
    type: 'string',
    format: 'date',
    nullable: true
  }
  const stringify = build(schema)

  const data = null
  const result = stringify(data)

  deepStrictEqual(result, JSON.stringify(data))
  deepStrictEqual(JSON.parse(result), data)
})

describe('handle nullable time correctly', (t) => {
  const schema = {
    type: 'string',
    format: 'time',
    nullable: true
  }
  const stringify = build(schema)

  const data = null
  const result = stringify(data)

  deepStrictEqual(result, JSON.stringify(data))
  deepStrictEqual(JSON.parse(result), data)
})

describe('large array of nullable strings with default mechanism', (t) => {
  const schema = {
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: {
          type: 'string',
          nullable: true
        }
      }
    }
  }

  const options = {
    largeArraySize: 2e4,
    largeArrayMechanism: 'default'
  }

  const stringify = build(schema, options)

  const data = { ids: new Array(2e4).fill(null) }
  const result = stringify(data)

  deepStrictEqual(result, JSON.stringify(data))
  deepStrictEqual(JSON.parse(result), data)
})

describe('large array of nullable date-time strings with default mechanism', (t) => {
  const schema = {
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: {
          type: 'string',
          format: 'date-time',
          nullable: true
        }
      }
    }
  }

  const options = {
    largeArraySize: 2e4,
    largeArrayMechanism: 'default'
  }

  const stringify = build(schema, options)

  const data = { ids: new Array(2e4).fill(null) }
  const result = stringify(data)

  deepStrictEqual(result, JSON.stringify(data))
  deepStrictEqual(JSON.parse(result), data)
})

describe('large array of nullable date-time strings with default mechanism', (t) => {
  const schema = {
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: {
          type: 'string',
          format: 'date',
          nullable: true
        }
      }
    }
  }

  const options = {
    largeArraySize: 2e4,
    largeArrayMechanism: 'default'
  }

  const stringify = build(schema, options)

  const data = { ids: new Array(2e4).fill(null) }
  const result = stringify(data)

  deepStrictEqual(result, JSON.stringify(data))
  deepStrictEqual(JSON.parse(result), data)
})

describe('large array of nullable date-time strings with default mechanism', (t) => {
  const schema = {
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: {
          type: 'string',
          format: 'time',
          nullable: true
        }
      }
    }
  }

  const options = {
    largeArraySize: 2e4,
    largeArrayMechanism: 'default'
  }

  const stringify = build(schema, options)

  const data = { ids: new Array(2e4).fill(null) }
  const result = stringify(data)

  deepStrictEqual(result, JSON.stringify(data))
  deepStrictEqual(JSON.parse(result), data)
})

describe('large array of nullable numbers with default mechanism', (t) => {
  const schema = {
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: {
          type: 'number',
          nullable: true
        }
      }
    }
  }

  const options = {
    largeArraySize: 2e4,
    largeArrayMechanism: 'default'
  }

  const stringify = build(schema, options)

  const data = { ids: new Array(2e4).fill(null) }
  const result = stringify(data)

  deepStrictEqual(result, JSON.stringify(data))
  deepStrictEqual(JSON.parse(result), data)
})

describe('large array of nullable integers with default mechanism', (t) => {
  const schema = {
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: {
          type: 'integer',
          nullable: true
        }
      }
    }
  }

  const options = {
    largeArraySize: 2e4,
    largeArrayMechanism: 'default'
  }

  const stringify = build(schema, options)

  const data = { ids: new Array(2e4).fill(null) }
  const result = stringify(data)

  deepStrictEqual(result, JSON.stringify(data))
  deepStrictEqual(JSON.parse(result), data)
})

describe('large array of nullable booleans with default mechanism', (t) => {
  const schema = {
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: {
          type: 'boolean',
          nullable: true
        }
      }
    }
  }

  const options = {
    largeArraySize: 2e4,
    largeArrayMechanism: 'default'
  }

  const stringify = build(schema, options)

  const data = { ids: new Array(2e4).fill(null) }
  const result = stringify(data)

  deepStrictEqual(result, JSON.stringify(data))
  deepStrictEqual(JSON.parse(result), data)
})

describe('nullable type in the schema', (t) => {
  const schema = {
    type: ['object', 'null'],
    properties: {
      foo: {
        type: 'string'
      }
    }
  }

  const stringify = build(schema)

  const data = { foo: 'bar' }

  deepStrictEqual(stringify(data), JSON.stringify(data))
  deepStrictEqual(stringify(null), JSON.stringify(null))
})

describe('throw an error if the value doesn\'t match the type', (t) => {
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['data'],
    properties: {
      data: {
        type: 'array',
        minItems: 1,
        items: {
          oneOf: [
            {
              type: 'string'
            },
            {
              type: 'number'
            }
          ]
        }
      }
    }
  }

  const stringify = build(schema)

  const validData = { data: [1, 'testing'] }
  equal(stringify(validData), JSON.stringify(validData))

  const invalidData = { data: [false, 'testing'] }
  throws(() => stringify(invalidData))
})

describe('nullable value in oneOf', (t) => {
  const schema = {
    type: 'object',
    properties: {
      data: {
        oneOf: [
          {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer', minimum: 1 }
              },
              additionalProperties: false,
              required: ['id']
            }
          },
          {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                job: { type: 'string', nullable: true }
              },
              additionalProperties: false,
              required: ['job']
            }
          }
        ]
      }
    },
    required: ['data'],
    additionalProperties: false
  }

  const stringify = build(schema)

  const data = { data: [{ job: null }] }
  equal(stringify(data), JSON.stringify(data))
})
