import build, { Schema } from '../..'

// Number schemas
const schema1: Schema = {
    type: 'number'
}
const schema2: Schema = {
    type: 'integer'
}

build(schema1)(25)
build(schema2)(-5)

// String schema
const schema3: Schema = {
    type: 'string'
}

build(schema3)('foobar')

// Boolean schema
const schema4: Schema = {
    type: 'boolean'
}

build(schema4)(true)

// Null schema
const schema5: Schema = {
    type: 'null'
}

build(schema5)(null)

// Array schemas
const schema6: Schema = {
    type: 'array',
    items: { type: 'number' }
}
const schema7: Schema = {
    type: 'array',
    items: [{ type: 'string'}, {type: 'integer'}]
}

build(schema6)([25])
build(schema7)(['hello', 42])

// Object schemas
const schema8: Schema = {
    type: 'object'
}
const schema9: Schema = {
    type: 'object',
    properties: {
        foo: { type: 'string' },
        bar: { type: 'integer' }
    },
    required: ['foo'],
    patternProperties: {
      'baz*': { type: 'null' }
    },
    additionalProperties: {
      type: 'boolean'
    }
}

build(schema8)({})
build(schema9)({ foo: 'bar' })

// Reference schemas
const schema10: Schema = {
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
    },
    def: {
      type: 'null'
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

build(schema10)({ nickname: '', num: { int: 5 }, other: null })

// Conditional/Combined schemas
const schema11: Schema = {
  title: 'Conditional/Combined Schema',
  type: 'object',
  properties: {
    something: {
      anyOf: [
        { type: 'string' },
        { type: 'boolean' }
      ]
    }
  },
  if: {
    properties: {
      something: { type: 'string' }
    }
  },
  then: {
    properties: {
      somethingElse: { type: 'number' }
    }
  },
  else: {
    properties: {
      somethingElse: { type: 'null' }
    }
  }
}

build(schema11)({ something: 'a string', somethingElse: 42 })
