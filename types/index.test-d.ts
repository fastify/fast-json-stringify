import Ajv from 'ajv'
import build, { restore, Schema, validLargeArrayMechanisms } from '..'
import { expectError, expectType } from 'tsd'

// Number schemas
const schema1: Schema = {
    type: 'number'
}
const schema2: Schema = {
    type: 'integer'
}

build(schema1)(25)
build(schema2)(-5)

build(schema2, { rounding: 'ceil' })
build(schema2, { rounding: 'floor' })
build(schema2, { rounding: 'round' })
build(schema2, { rounding: 'trunc' })
expectError(build(schema2, { rounding: 'invalid' }))

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
build(schema9, { rounding: 'floor' })({ foo: 'bar' })

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

// String schema with format
const schema12: Schema = {
  type: 'string',
  format: 'date-time'
}

build(schema12)(new Date())

let str: string, ajv: Ajv
str = build(schema1, { debugMode: true }).code
ajv = build(schema1, { debugMode: true }).ajv
str = build(schema1, { mode: 'debug' }).code
ajv = build(schema1, { mode: 'debug' }).ajv
str = build(schema1, { mode: 'standalone' })

const debugCompiled = build({
  title: 'default string',
  type: 'object',
  properties: {
    firstName: {
      type: 'string'
    }
  }
}, { mode: 'debug' })
expectType<ReturnType<typeof build>>(build.restore(debugCompiled))
expectType<ReturnType<typeof build>>(restore(debugCompiled))

expectType<string[]>(build.validLargeArrayMechanisms)
expectType<string[]>(validLargeArrayMechanisms)

/**
 * Schema inference
 */

// With inference
interface InferenceSchema {
  id: string;
  a?: number;
}

const stringify3 = build({
  type: "object",
  properties: { a: { type: "string" } },
});
stringify3<InferenceSchema>({ id: "123" });
stringify3<InferenceSchema>({ a: 123, id: "123" });
expectError(stringify3<InferenceSchema>({ anotherOne: "bar" }));
expectError(stringify3<Schema>({ a: "bar" }));

// Without inference
const stringify4 = build({
  type: "object",
  properties: { a: { type: "string" } },
});
stringify4({ id: "123" });
stringify4({ a: 123, id: "123" });
stringify4({ anotherOne: "bar" });
stringify4({ a: "bar" });

// Without inference - string type
const stringify5 = build({
  type: "string",
});
stringify5("foo");
expectError(stringify5({ id: "123" }));

// Without inference - null type
const stringify6 = build({
  type: "null",
});
stringify6(null);
expectError(stringify6("a string"));

// Without inference - boolean type
const stringify7 = build({
  type: "boolean",
});
stringify7(true);
expectError(stringify7("a string"));

// largeArrayMechanism

build({}, { largeArrayMechanism: 'json-stringify'} )
build({}, { largeArrayMechanism: 'default'} )
expectError(build({} as Schema, { largeArrayMechanism: 'invalid'} ))

build({}, { largeArraySize: 2000 } )
build({}, { largeArraySize: '2e4' } )
build({}, { largeArraySize: 2n } )
expectError(build({} as Schema, { largeArraySize: ['asdf']} ))