'use strict'

const test = require('tap').test

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
  test(`handle nullable:true in ${key} correctly`, (t) => {
    t.plan(1)

    const [
      schema,
      data,
      expected,
      extraOptions
    ] = testSet[key]

    const stringifier = build(schema, extraOptions)
    const result = stringifier(data)
    t.same(JSON.parse(result), expected)
  })
})

test('handle nullable number correctly', (t) => {
  t.plan(2)

  const schema = {
    type: 'number',
    nullable: true
  }
  const stringify = build(schema)

  const data = null
  const result = stringify(data)

  t.same(result, JSON.stringify(data))
  t.same(JSON.parse(result), data)
})

test('handle nullable integer correctly', (t) => {
  t.plan(2)

  const schema = {
    type: 'integer',
    nullable: true
  }
  const stringify = build(schema)

  const data = null
  const result = stringify(data)

  t.same(result, JSON.stringify(data))
  t.same(JSON.parse(result), data)
})

test('handle nullable boolean correctly', (t) => {
  t.plan(2)

  const schema = {
    type: 'boolean',
    nullable: true
  }
  const stringify = build(schema)

  const data = null
  const result = stringify(data)

  t.same(result, JSON.stringify(data))
  t.same(JSON.parse(result), data)
})

test('handle nullable string correctly', (t) => {
  t.plan(2)

  const schema = {
    type: 'string',
    nullable: true
  }
  const stringify = build(schema)

  const data = null
  const result = stringify(data)

  t.same(result, JSON.stringify(data))
  t.same(JSON.parse(result), data)
})

test('handle nullable date-time correctly', (t) => {
  t.plan(2)

  const schema = {
    type: 'string',
    format: 'date-time',
    nullable: true
  }
  const stringify = build(schema)

  const data = null
  const result = stringify(data)

  t.same(result, JSON.stringify(data))
  t.same(JSON.parse(result), data)
})

test('handle nullable date correctly', (t) => {
  t.plan(2)

  const schema = {
    type: 'string',
    format: 'date',
    nullable: true
  }
  const stringify = build(schema)

  const data = null
  const result = stringify(data)

  t.same(result, JSON.stringify(data))
  t.same(JSON.parse(result), data)
})

test('handle nullable time correctly', (t) => {
  t.plan(2)

  const schema = {
    type: 'string',
    format: 'time',
    nullable: true
  }
  const stringify = build(schema)

  const data = null
  const result = stringify(data)

  t.same(result, JSON.stringify(data))
  t.same(JSON.parse(result), data)
})

test('large array of nullable strings with default mechanism', (t) => {
  t.plan(2)

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

  t.same(result, JSON.stringify(data))
  t.same(JSON.parse(result), data)
})

test('large array of nullable date-time strings with default mechanism', (t) => {
  t.plan(2)

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

  t.same(result, JSON.stringify(data))
  t.same(JSON.parse(result), data)
})

test('large array of nullable date-time strings with default mechanism', (t) => {
  t.plan(2)

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

  t.same(result, JSON.stringify(data))
  t.same(JSON.parse(result), data)
})

test('large array of nullable date-time strings with default mechanism', (t) => {
  t.plan(2)

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

  t.same(result, JSON.stringify(data))
  t.same(JSON.parse(result), data)
})

test('large array of nullable numbers with default mechanism', (t) => {
  t.plan(2)

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

  t.same(result, JSON.stringify(data))
  t.same(JSON.parse(result), data)
})

test('large array of nullable integers with default mechanism', (t) => {
  t.plan(2)

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

  t.same(result, JSON.stringify(data))
  t.same(JSON.parse(result), data)
})

test('large array of nullable booleans with default mechanism', (t) => {
  t.plan(2)

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

  t.same(result, JSON.stringify(data))
  t.same(JSON.parse(result), data)
})
