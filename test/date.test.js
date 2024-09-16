'use strict'

const { describe } = require('node:test')
const { equal, ok, throws } = require('node:assert')
const validator = require('is-my-json-valid')
const build = require('..')

process.env.TZ = 'UTC'

describe('render a date in a string as JSON', () => {
  const schema = {
    title: 'a date in a string',
    type: 'string'
  }
  const toStringify = new Date(1674263005800)

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  equal(output, JSON.stringify(toStringify))
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('render a date in a string when format is date-format as ISOString', () => {
  const schema = {
    title: 'a date in a string',
    type: 'string',
    format: 'date-time'
  }
  const toStringify = new Date(1674263005800)

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  equal(output, JSON.stringify(toStringify))
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('render a nullable date in a string when format is date-format as ISOString', () => {
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

  equal(output, JSON.stringify(toStringify))
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('render a date in a string when format is date as YYYY-MM-DD', () => {
  const schema = {
    title: 'a date in a string',
    type: 'string',
    format: 'date'
  }
  const toStringify = new Date(1674263005800)

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  equal(output, '"2023-01-21"')
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('render a nullable date in a string when format is date as YYYY-MM-DD', () => {
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

  equal(output, '"2023-01-21"')
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('verify padding for rendered date in a string when format is date', () => {
  const schema = {
    title: 'a date in a string',
    type: 'string',
    format: 'date'
  }
  const toStringify = new Date(2020, 0, 1, 0, 0, 0, 0)

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  equal(output, '"2020-01-01"')
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('render a date in a string when format is time as kk:mm:ss', () => {
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
  equal(validate.errors, null)

  equal(output, '"01:03:25"')
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('render a nullable date in a string when format is time as kk:mm:ss', () => {
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
  equal(validate.errors, null)

  equal(output, '"01:03:25"')
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('render a midnight time', () => {
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
  equal(validate.errors, null)

  equal(output, '"00:03:25"')
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('verify padding for rendered date in a string when format is time', () => {
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
  equal(validate.errors, null)

  equal(output, '"01:01:01"')
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('render a nested object in a string when type is date-format as ISOString', () => {
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

  equal(output, JSON.stringify(toStringify))
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('serializing null value', t => {
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

  describe('type::string', t => {
    describe('format::date-time', t => {
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

      equal(output, '{"updatedAt":""}')
      equal(validate(JSON.parse(output)), false, 'an empty string is not a date-time format')
    })

    describe('format::date', t => {
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

      equal(output, '{"updatedAt":""}')
      equal(validate(JSON.parse(output)), false, 'an empty string is not a date format')
    })

    describe('format::time', t => {
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

      equal(output, '{"updatedAt":""}')
      equal(validate(JSON.parse(output)), false, 'an empty string is not a time format')
    })
  })

  describe('type::array', t => {
    describe('format::date-time', t => {
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

      equal(output, '{"updatedAt":""}')
      equal(validate(JSON.parse(output)), false, 'an empty string is not a date-time format')
    })

    describe('format::date', t => {
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

      equal(output, '{"updatedAt":""}')
      equal(validate(JSON.parse(output)), false, 'an empty string is not a date format')
    })

    describe('format::date', t => {
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

      equal(output, '{"updatedAt":""}')
      equal(validate(JSON.parse(output)), false, 'an empty string is not a date format')
    })

    describe('format::time, Date object', t => {
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

      equal(output, JSON.stringify({ updatedAt: '01:03:25' }))
    })

    describe('format::time, Date object', t => {
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

      equal(output, '"01:03:25"')
    })

    describe('format::time, Date object', t => {
      const schema = {
        oneOf: [
          {
            type: ['string', 'number'],
            format: 'time'
          }
        ]
      }

      const { output } = serialize(schema, 42)

      equal(output, JSON.stringify(42))
    })
  })

  describe('type::array::nullable', t => {
    describe('format::date-time', t => {
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

      equal(output, '{"updatedAt":null}')
      ok(validate(JSON.parse(output)), 'valid schema')
    })

    describe('format::date', t => {
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

      equal(output, '{"updatedAt":null}')
      ok(validate(JSON.parse(output)), 'valid schema')
    })

    describe('format::time', t => {
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

      equal(output, '{"updatedAt":null}')
      ok(validate(JSON.parse(output)), 'valid schema')
    })
  })
})

describe('Validate Date object as string type', () => {
  const schema = {
    oneOf: [
      { type: 'string' }
    ]
  }
  const toStringify = new Date(1674263005800)

  const stringify = build(schema)
  const output = stringify(toStringify)

  equal(output, JSON.stringify(toStringify))
})

describe('nullable date', () => {
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

  equal(result, '"2023-01-21"')
})

describe('non-date format should not affect data serialization (issue #491)', () => {
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
  equal(stringify(data), '{"hello":"123"}')
})

describe('should serialize also an invalid string value, even if it is not a valid date', () => {
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

  equal(output, JSON.stringify(toStringify))
  equal(validate(JSON.parse(output)), false, 'valid schema')
})

describe('should throw an error if value can not be transformed to date-time', () => {
  const schema = {
    title: 'a date in a string',
    type: 'string',
    format: 'date-time',
    nullable: true
  }
  const toStringify = true

  const validate = validator(schema)
  const stringify = build(schema)

  throws(() => stringify(toStringify), new Error('The value "true" cannot be converted to a date-time.'))
  equal(validate(toStringify), false)
})

describe('should throw an error if value can not be transformed to date', () => {
  const schema = {
    title: 'a date in a string',
    type: 'string',
    format: 'date',
    nullable: true
  }
  const toStringify = true

  const validate = validator(schema)
  const stringify = build(schema)

  throws(() => stringify(toStringify), new Error('The value "true" cannot be converted to a date.'))
  equal(validate(toStringify), false)
})

describe('should throw an error if value can not be transformed to time', () => {
  const schema = {
    title: 'a time in a string',
    type: 'string',
    format: 'time',
    nullable: true
  }
  const toStringify = true

  const validate = validator(schema)
  const stringify = build(schema)

  throws(() => stringify(toStringify), new Error('The value "true" cannot be converted to a time.'))
  equal(validate(toStringify), false)
})

describe('should serialize also an invalid string value, even if it is not a valid time', () => {
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

  equal(output, JSON.stringify(toStringify))
  equal(validate(JSON.parse(output)), false, 'valid schema')
})
