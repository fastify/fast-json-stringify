'use strict'

const test = require('tap').test
const validator = require('is-my-json-valid')
const build = require('..')

process.env.TZ = 'UTC'

test('render a date in a string as JSON', (t) => {
  t.plan(2)

  const schema = {
    title: 'a date in a string',
    type: 'string'
  }
  const toStringify = new Date(1674263005800)

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  t.equal(output, JSON.stringify(toStringify))
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('render a date in a string when format is date-format as ISOString', (t) => {
  t.plan(2)

  const schema = {
    title: 'a date in a string',
    type: 'string',
    format: 'date-time'
  }
  const toStringify = new Date(1674263005800)

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  t.equal(output, JSON.stringify(toStringify))
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('render a nullable date in a string when format is date-format as ISOString', (t) => {
  t.plan(2)

  const schema = {
    title: 'a date in a string',
    type: 'string',
    format: 'date-time',
    nullable: true
  }
  const toStringify = new Date(1674263005800)

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  t.equal(output, JSON.stringify(toStringify))
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('render a date in a string when format is date as YYYY-MM-DD', (t) => {
  t.plan(2)

  const schema = {
    title: 'a date in a string',
    type: 'string',
    format: 'date'
  }
  const toStringify = new Date(1674263005800)

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  t.equal(output, '"2023-01-21"')
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('render a nullable date in a string when format is date as YYYY-MM-DD', (t) => {
  t.plan(2)

  const schema = {
    title: 'a date in a string',
    type: 'string',
    format: 'date',
    nullable: true
  }
  const toStringify = new Date(1674263005800)

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  t.equal(output, '"2023-01-21"')
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('verify padding for rendered date in a string when format is date', (t) => {
  t.plan(2)

  const schema = {
    title: 'a date in a string',
    type: 'string',
    format: 'date'
  }
  const toStringify = new Date(2020, 0, 1, 0, 0, 0, 0)

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  t.equal(output, '"2020-01-01"')
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('render a date in a string when format is time as kk:mm:ss', (t) => {
  t.plan(3)

  const schema = {
    title: 'a date in a string',
    type: 'string',
    format: 'time'
  }
  const toStringify = new Date(1674263005800)

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  validate(JSON.parse(output))
  t.equal(validate.errors, null)

  t.equal(output, '"01:03:25"')
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('render a nullable date in a string when format is time as kk:mm:ss', (t) => {
  t.plan(3)

  const schema = {
    title: 'a date in a string',
    type: 'string',
    format: 'time',
    nullable: true
  }
  const toStringify = new Date(1674263005800)

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  validate(JSON.parse(output))
  t.equal(validate.errors, null)

  t.equal(output, '"01:03:25"')
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('render a midnight time', (t) => {
  t.plan(3)

  const schema = {
    title: 'a date in a string',
    type: 'string',
    format: 'time'
  }
  const midnight = new Date(new Date(1674263005800).setHours(24))

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(midnight)

  validate(JSON.parse(output))
  t.equal(validate.errors, null)

  t.equal(output, '"00:03:25"')
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('verify padding for rendered date in a string when format is time', (t) => {
  t.plan(3)

  const schema = {
    title: 'a date in a string',
    type: 'string',
    format: 'time'
  }
  const toStringify = new Date(2020, 0, 1, 1, 1, 1, 1)

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  validate(JSON.parse(output))
  t.equal(validate.errors, null)

  t.equal(output, '"01:01:01"')
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('render a nested object in a string when type is date-format as ISOString', (t) => {
  t.plan(2)

  const schema = {
    title: 'an object in a string',
    type: 'object',
    properties: {
      date: {
        type: 'string',
        format: 'date-time'
      }
    }
  }
  const toStringify = { date: new Date(1674263005800) }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  t.equal(output, JSON.stringify(toStringify))
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('serializing null value', t => {
  const input = { updatedAt: null }

  function createSchema (properties) {
    return {
      title: 'an object in a string',
      type: 'object',
      properties
    }
  }

  function serialize (schema, input) {
    const validate = validator(schema)
    const stringify = build(schema)
    const output = stringify(input)

    return {
      validate,
      output
    }
  }

  t.plan(3)

  t.test('type::string', t => {
    t.plan(3)

    t.test('format::date-time', t => {
      t.plan(2)

      const prop = {
        updatedAt: {
          type: 'string',
          format: 'date-time'
        }
      }

      const {
        output,
        validate
      } = serialize(createSchema(prop), input)

      t.equal(output, '{"updatedAt":""}')
      t.notOk(validate(JSON.parse(output)), 'an empty string is not a date-time format')
    })

    t.test('format::date', t => {
      t.plan(2)

      const prop = {
        updatedAt: {
          type: 'string',
          format: 'date'
        }
      }

      const {
        output,
        validate
      } = serialize(createSchema(prop), input)

      t.equal(output, '{"updatedAt":""}')
      t.notOk(validate(JSON.parse(output)), 'an empty string is not a date format')
    })

    t.test('format::time', t => {
      t.plan(2)

      const prop = {
        updatedAt: {
          type: 'string',
          format: 'time'
        }
      }

      const {
        output,
        validate
      } = serialize(createSchema(prop), input)

      t.equal(output, '{"updatedAt":""}')
      t.notOk(validate(JSON.parse(output)), 'an empty string is not a time format')
    })
  })

  t.test('type::array', t => {
    t.plan(6)

    t.test('format::date-time', t => {
      t.plan(2)

      const prop = {
        updatedAt: {
          type: ['string'],
          format: 'date-time'
        }
      }

      const {
        output,
        validate
      } = serialize(createSchema(prop), input)

      t.equal(output, '{"updatedAt":""}')
      t.notOk(validate(JSON.parse(output)), 'an empty string is not a date-time format')
    })

    t.test('format::date', t => {
      t.plan(2)

      const prop = {
        updatedAt: {
          type: ['string'],
          format: 'date'
        }
      }

      const {
        output,
        validate
      } = serialize(createSchema(prop), input)

      t.equal(output, '{"updatedAt":""}')
      t.notOk(validate(JSON.parse(output)), 'an empty string is not a date format')
    })

    t.test('format::date', t => {
      t.plan(2)

      const prop = {
        updatedAt: {
          type: ['string'],
          format: 'date'
        }
      }

      const {
        output,
        validate
      } = serialize(createSchema(prop), input)

      t.equal(output, '{"updatedAt":""}')
      t.notOk(validate(JSON.parse(output)), 'an empty string is not a date format')
    })

    t.test('format::time, Date object', t => {
      t.plan(1)

      const schema = {
        oneOf: [
          {
            type: 'object',
            properties: {
              updatedAt: {
                type: ['string', 'number'],
                format: 'time'
              }
            }
          }
        ]
      }

      const date = new Date(1674263005800)
      const input = { updatedAt: date }
      const { output } = serialize(schema, input)

      t.equal(output, JSON.stringify({ updatedAt: '01:03:25' }))
    })

    t.test('format::time, Date object', t => {
      t.plan(1)

      const schema = {
        oneOf: [
          {
            type: ['string', 'number'],
            format: 'time'
          }
        ]
      }

      const date = new Date(1674263005800)
      const { output } = serialize(schema, date)

      t.equal(output, '"01:03:25"')
    })

    t.test('format::time, Date object', t => {
      t.plan(1)

      const schema = {
        oneOf: [
          {
            type: ['string', 'number'],
            format: 'time'
          }
        ]
      }

      const { output } = serialize(schema, 42)

      t.equal(output, JSON.stringify(42))
    })
  })

  t.test('type::array::nullable', t => {
    t.plan(3)

    t.test('format::date-time', t => {
      t.plan(2)

      const prop = {
        updatedAt: {
          type: ['string', 'null'],
          format: 'date-time'
        }
      }

      const {
        output,
        validate
      } = serialize(createSchema(prop), input)

      t.equal(output, '{"updatedAt":null}')
      t.ok(validate(JSON.parse(output)), 'valid schema')
    })

    t.test('format::date', t => {
      t.plan(2)

      const prop = {
        updatedAt: {
          type: ['string', 'null'],
          format: 'date'
        }
      }

      const {
        output,
        validate
      } = serialize(createSchema(prop), input)

      t.equal(output, '{"updatedAt":null}')
      t.ok(validate(JSON.parse(output)), 'valid schema')
    })

    t.test('format::time', t => {
      t.plan(2)

      const prop = {
        updatedAt: {
          type: ['string', 'null'],
          format: 'time'
        }
      }

      const {
        output,
        validate
      } = serialize(createSchema(prop), input)

      t.equal(output, '{"updatedAt":null}')
      t.ok(validate(JSON.parse(output)), 'valid schema')
    })
  })
})

test('Validate Date object as string type', (t) => {
  t.plan(1)

  const schema = {
    oneOf: [
      { type: 'string' }
    ]
  }
  const toStringify = new Date(1674263005800)

  const stringify = build(schema)
  const output = stringify(toStringify)

  t.equal(output, JSON.stringify(toStringify))
})

test('nullable date', (t) => {
  t.plan(1)

  const schema = {
    anyOf: [
      {
        format: 'date',
        type: 'string',
        nullable: true
      }
    ]
  }

  const stringify = build(schema)

  const data = new Date(1674263005800)
  const result = stringify(data)

  t.same(result, '"2023-01-21"')
})

test('non-date format should not affect data serialization (issue #491)', (t) => {
  t.plan(1)

  const schema = {
    type: 'object',
    properties: {
      hello: {
        type: 'string',
        format: 'int64',
        pattern: '^[0-9]*$'
      }
    }
  }

  const stringify = build(schema)
  const data = { hello: 123n }
  t.equal(stringify(data), '{"hello":"123"}')
})

test('should serialize also an invalid string value, even if it is not a valid date', (t) => {
  t.plan(2)

  const schema = {
    title: 'a date in a string',
    type: 'string',
    format: 'date-time',
    nullable: true
  }
  const toStringify = 'invalid'

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  t.equal(output, JSON.stringify(toStringify))
  t.not(validate(JSON.parse(output)), 'valid schema')
})

test('should throw an error if value can not be transformed to date-time', (t) => {
  t.plan(2)

  const schema = {
    title: 'a date in a string',
    type: 'string',
    format: 'date-time',
    nullable: true
  }
  const toStringify = true

  const validate = validator(schema)
  const stringify = build(schema)

  t.throws(() => stringify(toStringify), new Error('The value "true" cannot be converted to a date-time.'))
  t.not(validate(toStringify))
})

test('should throw an error if value can not be transformed to date', (t) => {
  t.plan(2)

  const schema = {
    title: 'a date in a string',
    type: 'string',
    format: 'date',
    nullable: true
  }
  const toStringify = true

  const validate = validator(schema)
  const stringify = build(schema)

  t.throws(() => stringify(toStringify), new Error('The value "true" cannot be converted to a date.'))
  t.not(validate(toStringify))
})

test('should throw an error if value can not be transformed to time', (t) => {
  t.plan(2)

  const schema = {
    title: 'a time in a string',
    type: 'string',
    format: 'time',
    nullable: true
  }
  const toStringify = true

  const validate = validator(schema)
  const stringify = build(schema)

  t.throws(() => stringify(toStringify), new Error('The value "true" cannot be converted to a time.'))
  t.not(validate(toStringify))
})

test('should serialize also an invalid string value, even if it is not a valid time', (t) => {
  t.plan(2)

  const schema = {
    title: 'a time in a string',
    type: 'string',
    format: 'time',
    nullable: true
  }
  const toStringify = 'invalid'

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  t.equal(output, JSON.stringify(toStringify))
  t.not(validate(JSON.parse(output)), 'valid schema')
})
