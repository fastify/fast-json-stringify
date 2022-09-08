'use strict'

const test = require('tap').test
const build = require('..')

test('should not call toJSON when enableToJSON equals false', (t) => {
  t.plan(1)

  const schema = {
    type: 'object',
    properties: {
      data: {
        type: 'object'
      }
    }
  }

  const stringify = build(schema, { enableToJSON: false })

  const data = {
    data: { toJSON () { return 4 } }
  }

  t.equal(stringify(data), '{"data":{}}')
})

test('use toJSON method on object types', (t) => {
  t.plan(1)

  const stringify = build({
    title: 'simple object',
    type: 'object',
    properties: {
      productName: {
        type: 'string'
      }
    }
  }, {
    enableToJSON: true
  })

  const object = {
    product: { name: 'cola' },
    toJSON: function () {
      return { productName: this.product.name }
    }
  }

  t.equal('{"productName":"cola"}', stringify(object))
})

test('use toJSON method on nested object types', (t) => {
  t.plan(1)

  const stringify = build({
    title: 'simple array',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        productName: {
          type: 'string'
        }
      }
    }
  }, {
    enableToJSON: true
  })

  const array = [
    {
      product: { name: 'cola' },
      toJSON: function () {
        return { productName: this.product.name }
      }
    },
    {
      product: { name: 'sprite' },
      toJSON: function () {
        return { productName: this.product.name }
      }
    }
  ]

  t.equal('[{"productName":"cola"},{"productName":"sprite"}]', stringify(array))
})

test('not use toJSON if does not exist', (t) => {
  t.plan(1)

  const stringify = build({
    title: 'simple object',
    type: 'object',
    properties: {
      product: {
        type: 'object',
        properties: {
          name: {
            type: 'string'
          }
        }
      }
    }
  }, {
    enableToJSON: true
  })

  const object = {
    product: { name: 'cola' }
  }

  t.equal('{"product":{"name":"cola"}}', stringify(object))
})

test('not fail on null object declared nullable', (t) => {
  t.plan(1)

  const stringify = build({
    title: 'simple object',
    type: 'object',
    nullable: true,
    properties: {
      product: {
        type: 'object',
        properties: {
          name: {
            type: 'string'
          }
        }
      }
    }
  }, {
    enableToJSON: true
  })

  t.equal('null', stringify(null))
})

test('not fail on null sub-object declared nullable', (t) => {
  t.plan(1)

  const stringify = build({
    title: 'simple object',
    type: 'object',
    properties: {
      product: {
        nullable: true,
        type: 'object',
        properties: {
          name: {
            type: 'string'
          }
        }
      }
    }
  }, {
    enableToJSON: true
  })

  const object = {
    product: null
  }
  t.equal('{"product":null}', stringify(object))
})

test('throw an error on non nullable null sub-object', (t) => {
  t.plan(1)

  const stringify = build({
    title: 'simple object',
    type: 'object',
    properties: {
      product: {
        nullable: false,
        type: 'object',
        properties: {
          name: {
            type: 'string'
          }
        }
      }
    }
  }, {
    enableToJSON: true
  })

  const object = {
    product: null
  }
  t.throws(() => { stringify(object) })
})

test('throw an error on non nullable null object', (t) => {
  t.plan(1)

  const stringify = build({
    title: 'simple object',
    nullable: false,
    type: 'object',
    properties: {
      product: {
        nullable: false,
        type: 'object',
        properties: {
          name: {
            type: 'string'
          }
        }
      }
    }
  }, {
    enableToJSON: true
  })

  t.throws(() => { stringify(null) })
})

test('recursive toJSON call', (t) => {
  t.plan(1)

  const schema = {
    type: 'object',
    properties: {
      firstName: {
        type: 'string'
      },
      lastName: {
        type: ['string', 'null']
      },
      age: {
        type: 'integer',
        minimum: 0
      }
    }
  }

  const stringify = build(schema, { enableToJSON: true })

  const data = {
    props: {
      firstName: { toJSON () { return 'Matteo' } },
      lastName: { toJSON () { return 'Collina' } },
      age: { toJSON () { return 32 } }
    },
    toJSON () {
      return {
        firstName: this.props.firstName,
        lastName: this.props.lastName,
        age: this.props.age
      }
    }
  }

  t.equal(stringify(data), JSON.stringify(data))
})

test('toJSON - ref - properties', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with $ref',
    definitions: {
      def: {
        type: 'object',
        properties: {
          str: {
            type: 'string'
          }
        }
      }
    },
    type: 'object',
    properties: {
      obj: {
        $ref: '#/definitions/def'
      }
    }
  }

  const object = {
    props: {
      obj: {
        toJSON () {
          t.pass()
          return { str: 'test' }
        }
      }
    },
    toJSON () {
      return { obj: this.props.obj }
    }
  }

  const stringify = build(schema, { enableToJSON: true })
  const output = stringify(object)

  JSON.parse(output)

  t.equal(output, '{"obj":{"str":"test"}}')
})

test('toJSON - ref - items', (t) => {
  t.plan(2)

  const schema = {
    title: 'array with $ref',
    definitions: {
      def: {
        type: 'object',
        properties: {
          str: {
            type: 'string'
          }
        }
      }
    },
    type: 'array',
    items: { $ref: '#/definitions/def' }
  }

  const arrayObj = {
    props: {
      str: {
        toJSON () { return { str: 'test' } }
      }
    },
    toJSON () { return [this.props.str] }
  }

  const stringify = build(schema, { enableToJSON: true })
  const output = stringify(arrayObj)

  JSON.parse(output)
  t.pass()

  t.equal(output, '[{"str":"test"}]')
})

test('toJSON - ref - patternProperties', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with $ref',
    definitions: {
      def: {
        type: 'object',
        properties: {
          str: {
            type: 'string'
          }
        }
      }
    },
    type: 'object',
    properties: {},
    patternProperties: {
      obj: {
        $ref: '#/definitions/def'
      }
    }
  }

  const object = {
    props: {
      obj: {
        toJSON () { return { str: 'test' } }
      }
    },
    toJSON () {
      return { obj: this.props.obj }
    }
  }

  const stringify = build(schema, { enableToJSON: true })
  const output = stringify(object)

  JSON.parse(output)
  t.pass()

  t.equal(output, '{"obj":{"str":"test"}}')
})

test('toJSON - ref - additionalProperties', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with $ref',
    definitions: {
      def: {
        type: 'object',
        properties: {
          str: {
            type: 'string'
          }
        }
      }
    },
    type: 'object',
    properties: {},
    additionalProperties: {
      $ref: '#/definitions/def'
    }
  }

  const object = {
    props: {
      obj: {
        toJSON () { return { str: 'test' } }
      }
    },
    toJSON () {
      return { obj: this.props.obj }
    }
  }

  const stringify = build(schema, { enableToJSON: true })
  const output = stringify(object)

  JSON.parse(output)
  t.pass()

  t.equal(output, '{"obj":{"str":"test"}}')
})

test('toJSON - ref - pattern-additional Properties', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with $ref',
    definitions: {
      def: {
        type: 'object',
        properties: {
          str: {
            type: 'string'
          }
        }
      }
    },
    type: 'object',
    properties: {},
    patternProperties: {
      reg: {
        $ref: '#/definitions/def'
      }
    },
    additionalProperties: {
      $ref: '#/definitions/def'
    }
  }

  const object = {
    props: {
      patternObj: {
        toJSON () { return { str: 'test' } }
      }
    },
    toJSON () {
      return {
        reg: this.props.patternObj,
        obj: this.props.patternObj
      }
    }
  }

  const stringify = build(schema, { enableToJSON: true })
  const output = stringify(object)

  JSON.parse(output)
  t.pass()

  t.equal(output, '{"reg":{"str":"test"},"obj":{"str":"test"}}')
})

test('toJSON - ref - deepObject schema', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with $ref',
    definitions: {
      def: {
        type: 'object',
        properties: {
          coming: {
            type: 'object',
            properties: {
              where: {
                type: 'string'
              }
            }
          }
        }
      }
    },
    type: 'object',
    properties: {
      winter: {
        type: 'object',
        properties: {
          is: {
            $ref: '#/definitions/def'
          }
        }
      }
    }
  }

  const where = {
    toJSON () { return 'to town' }
  }
  const coming = {
    toJSON () { return { where } }
  }
  const is = {
    toJSON () { return { coming } }
  }
  const winter = {
    toJSON () { return { is } }
  }
  const object = {
    toJSON () { return { winter } }
  }

  const stringify = build(schema, { enableToJSON: true })
  const output = stringify(object)

  JSON.parse(output)
  t.pass()

  t.equal(output, '{"winter":{"is":{"coming":{"where":"to town"}}}}')
})

test('toJSON - ref - Regression 2.5.2', t => {
  t.plan(1)

  const externalSchema = {
    '/models/Bar': {
      $id: '/models/Bar',
      $schema: 'http://json-schema.org/schema#',
      definitions: {
        entity: {
          type: 'object',
          properties: { field: { type: 'string' } }
        }
      }
    },
    '/models/Foo': {
      $id: '/models/Foo',
      $schema: 'http://json-schema.org/schema#',
      definitions: {
        entity: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            sub: {
              oneOf: [
                { $ref: '/models/Bar#/definitions/entity' },
                { type: 'null' }
              ]
            }
          }
        }
      }
    }
  }

  const schema = {
    type: 'array',
    items: {
      $ref: '/models/Foo#/definitions/entity'
    }
  }

  const object = {
    props: {
      field: {
        toJSON () { return 'parent' }
      },
      sub: {
        toJSON () { return { field: 'joined' } }
      }
    },
    toJSON () {
      return [{
        field: this.props.field,
        sub: this.props.sub
      }]
    }
  }

  const stringify = build(schema, { schema: externalSchema, enableToJSON: true })
  const output = stringify(object)

  t.equal(output, '[{"field":"parent","sub":{"field":"joined"}}]')
})

test('possibly nullable integer primitive alternative', (t) => {
  t.plan(1)

  const schema = {
    title: 'simple object with multi-type nullable primitive',
    type: 'object',
    properties: {
      data: {
        type: ['integer']
      }
    }
  }

  const stringify = build(schema, { ajv: { allowUnionTypes: true }, enableToJSON: true })

  const data = {
    data: { toJSON () { return 4 } }
  }

  t.equal(stringify(data), '{"data":4}')
})

test('possibly nullable number primitive alternative', (t) => {
  t.plan(1)

  const schema = {
    title: 'simple object with multi-type nullable primitive',
    type: 'object',
    properties: {
      data: {
        type: ['number']
      }
    }
  }

  const stringify = build(schema, { enableToJSON: true })

  const data = {
    data: { toJSON () { return 4 } }
  }

  t.equal(stringify(data), '{"data":4}')
})

test('possibly nullable integer primitive alternative with null value', (t) => {
  t.plan(1)

  const schema = {
    title: 'simple object with multi-type nullable primitive',
    type: 'object',
    properties: {
      data: {
        type: ['integer']
      }
    }
  }

  const stringify = build(schema, { enableToJSON: true })

  const dataNull = {
    data: { toJSON () { return null } }
  }

  const value = stringify(dataNull)
  t.equal(value, '{"data":0}')
})

test('possibly nullable number primitive alternative with null value', (t) => {
  t.plan(1)

  const schema = {
    title: 'simple object with multi-type nullable primitive',
    type: 'object',
    properties: {
      data: {
        type: ['number']
      }
    }
  }

  const stringify = build(schema, { enableToJSON: true })

  const dataNull = {
    data: { toJSON () { return null } }
  }

  const value = stringify(dataNull)
  t.equal(value, '{"data":0}')
})

test('nullable integer primitive', (t) => {
  t.plan(1)

  const schema = {
    title: 'simple object with nullable primitive',
    type: 'object',
    properties: {
      data: {
        type: ['integer', 'null']
      }
    }
  }

  const stringify = build(schema, { enableToJSON: true })

  const data = {
    data: { toJSON () { return 4 } }
  }

  const value = stringify(data)
  t.equal(value, '{"data":4}')
})

test('nullable number primitive', (t) => {
  t.plan(1)

  const schema = {
    title: 'simple object with nullable primitive',
    type: 'object',
    properties: {
      data: {
        type: ['number', 'null']
      }
    }
  }

  const stringify = build(schema, { enableToJSON: true })

  const data = {
    data: { toJSON () { return 4 } }
  }

  const value = stringify(data)
  t.equal(value, '{"data":4}')
})

test('nullable primitive with null value', (t) => {
  t.plan(1)

  const schema = {
    title: 'simple object with nullable primitive',
    type: 'object',
    properties: {
      data: {
        type: ['integer', 'null']
      }
    }
  }

  const stringify = build(schema, { enableToJSON: true })

  const dataNull = {
    data: { toJSON () { return null } }
  }

  const value = stringify(dataNull)
  t.equal(value, '{"data":null}')
})

test('nullable number primitive with null value', (t) => {
  t.plan(1)

  const schema = {
    title: 'simple object with nullable primitive',
    type: 'object',
    properties: {
      data: {
        type: ['number', 'null']
      }
    }
  }

  const stringify = build(schema, { enableToJSON: true })

  const dataNull = {
    data: { toJSON () { return null } }
  }

  const value = stringify(dataNull)
  t.equal(value, '{"data":null}')
})

test('possibly null object with multi-type property', (t) => {
  t.plan(3)

  const schema = {
    title: 'simple object with multi-type property',
    type: 'object',
    properties: {
      objectOrNull: {
        type: ['object', 'null'],
        properties: {
          stringOrNumber: {
            type: ['string', 'number']
          }
        }
      }
    }
  }
  const stringify = build(schema, { enableToJSON: true })

  const dataString = { toJSON () { return 'string1' } }
  const dataNumber = { toJSON () { return 42 } }
  const dataNull = { toJSON () { return null } }

  t.equal(stringify({ objectOrNull: { toJSON () { return { stringOrNumber: dataString } } } }), '{"objectOrNull":{"stringOrNumber":"string1"}}')
  t.equal(stringify({ objectOrNull: { toJSON () { return { stringOrNumber: dataNumber } } } }), '{"objectOrNull":{"stringOrNumber":42}}')
  t.equal(stringify({ objectOrNull: dataNull }), '{"objectOrNull":null}')
})

test('object with possibly null array of multiple types', (t) => {
  t.plan(5)

  const schema = {
    title: 'object with array of multiple types',
    type: 'object',
    properties: {
      arrayOfStringsAndNumbers: {
        type: ['array', 'null'],
        items: {
          type: ['string', 'number', 'null']
        }
      }
    }
  }

  const dataString1 = { toJSON () { return 'string1' } }
  const dataString2 = { toJSON () { return 'string2' } }
  const dataNumber1 = { toJSON () { return 42 } }
  const dataNumber2 = { toJSON () { return 7 } }
  const dataNull = { toJSON () { return null } }

  const stringify = build(schema, { enableToJSON: true })

  const arrayStringsAndNumberString = {
    arrayOfStringsAndNumbers: { toJSON () { return [dataString1, dataString2] } }
  }
  const arrayStringsAndNumberNumber = {
    arrayOfStringsAndNumbers: { toJSON () { return [dataNumber1, dataNumber2] } }
  }
  const arrayStringsAndNumberMixed = {
    arrayOfStringsAndNumbers: { toJSON () { return [dataString1, dataNumber1, dataNumber2, dataString2] } }
  }
  const arrayStringsAndNumberMixedNull = {
    arrayOfStringsAndNumbers: { toJSON () { return [dataString1, dataNull, dataNumber1, dataNumber2, dataString2, dataNull] } }
  }

  try {
    const value = stringify({ arrayOfStringsAndNumbers: dataNull })
    t.equal(value, '{"arrayOfStringsAndNumbers":null}')
  } catch (e) {
    console.log(e)
    t.fail()
  }

  try {
    const value = stringify(arrayStringsAndNumberString)
    t.equal(value, '{"arrayOfStringsAndNumbers":["string1","string2"]}')
  } catch (e) {
    console.log(e)
    t.fail()
  }

  t.equal(stringify(arrayStringsAndNumberNumber), '{"arrayOfStringsAndNumbers":[42,7]}')
  t.equal(stringify(arrayStringsAndNumberMixed), '{"arrayOfStringsAndNumbers":["string1",42,7,"string2"]}')
  t.equal(stringify(arrayStringsAndNumberMixedNull), '{"arrayOfStringsAndNumbers":["string1",null,42,7,"string2",null]}')
})

test('object that is simultaneously a string and a json', (t) => {
  t.plan(2)
  const schema = {
    type: 'object',
    properties: {
      simultaneously: {
        type: ['string', 'object'],
        properties: {
          foo: { type: 'string' }
        }
      }
    }
  }

  const likeObjectId = {
    toString () { return 'hello' }
  }

  const stringify = build(schema, { enableToJSON: true })
  const valueStr = stringify({ simultaneously: { toJSON () { return likeObjectId } } })
  t.equal(valueStr, '{"simultaneously":"hello"}')

  const valueObj = stringify({ simultaneously: { toJSON () { return { foo: likeObjectId } } } })
  t.equal(valueObj, '{"simultaneously":{"foo":"hello"}}')
})

test('object that is simultaneously a string and a json switched', (t) => {
  t.plan(2)
  const schema = {
    type: 'object',
    properties: {
      simultaneously: {
        type: ['object', 'string'],
        properties: {
          foo: { type: 'string' }
        }
      }
    }
  }

  const likeObjectId = {
    toString () { return 'hello' }
  }

  const stringify = build(schema, { enableToJSON: true })
  const valueStr = stringify({ simultaneously: { toJSON () { return likeObjectId } } })
  t.equal(valueStr, '{"simultaneously":{}}')

  const valueObj = stringify({ simultaneously: { toJSON () { return { foo: likeObjectId } } } })
  t.equal(valueObj, '{"simultaneously":{"foo":"hello"}}')
})

test('should throw an error when type is array and object is null', (t) => {
  t.plan(1)
  const schema = {
    type: 'object',
    properties: {
      arr: {
        type: 'array',
        items: {
          type: 'number'
        }
      }
    }
  }

  const dataNull = { toJSON () { return null } }

  const stringify = build(schema, { enableToJSON: true })
  t.throws(
    () => stringify({ arr: dataNull }),
    new TypeError('The value \'null\' does not match schema definition.')
  )
})

test('use toJSON method on primary json types', (t) => {
  t.plan(2)

  const stringify = build({
    title: 'object of primitive (json) types',
    type: 'object',
    properties: {
      _bool: {
        type: 'boolean'
      },
      _int: {
        type: 'integer'
      },
      _null: {
        type: 'null'
      },
      _num: {
        type: 'number'
      },
      _str: {
        type: 'string'
      }
    }
  }, {
    enableToJSON: true
  })

  const input = {
    _bool: {
      toJSON () { return true }
    },
    _int: {
      toJSON () { return 42 }
    },
    _null: {
      toJSON () { return null }
    },
    _num: {
      toJSON () { return 3.14 }
    },
    _str: {
      toJSON () { return 'whatever' }
    }
  }
  const expected = '{"_bool":true,"_int":42,"_null":null,"_num":3.14,"_str":"whatever"}'

  t.equal(JSON.stringify(input), expected)
  t.equal(stringify(input), expected)
})

test('toJSON skips missing props when not required', (t) => {
  t.plan(1)

  const stringify = build({
    title: 'object of primitive (json) types',
    type: 'object',
    properties: {
      _bool: {
        type: 'boolean'
      },
      _int: {
        type: 'integer'
      },
      _null: {
        type: 'null'
      },
      _num: {
        type: 'number'
      },
      _str: {
        type: 'string'
      }
    }
  }, {
    enableToJSON: true
  })

  const input = {
    toJSON () { return {} }
  }
  const expected = '{}'
  t.equal(stringify(input), expected)
})

test('toJSON forwards nullable types', (t) => {
  t.plan(4)

  const nullable = true
  const stringify = build({
    title: 'object of nullable primitive (json) types',
    type: 'object',
    properties: {
      _bool: {
        type: 'boolean',
        nullable
      },
      _int: {
        type: 'integer',
        nullable
      },
      _num: {
        type: 'number',
        nullable
      },
      _str: {
        type: 'string',
        nullable
      }
    }
  }, {
    enableToJSON: true
  })

  const inputNull = {
    _bool: {
      toJSON () { return null }
    },
    _int: {
      toJSON () { return null }
    },
    _num: {
      toJSON () { return null }
    },
    _str: {
      toJSON () { return null }
    }
  }
  const expectedNull = '{"_bool":null,"_int":null,"_num":null,"_str":null}'
  t.equal(JSON.stringify(inputNull), expectedNull)
  t.equal(stringify(inputNull), expectedNull)

  const inputNotNull = {
    _bool: {
      toJSON () { return true }
    },
    _int: {
      toJSON () { return 42 }
    },
    _num: {
      toJSON () { return 3.14 }
    },
    _str: {
      toJSON () { return 'whatever' }
    }
  }
  const expectedNotNull = '{"_bool":true,"_int":42,"_num":3.14,"_str":"whatever"}'
  t.equal(JSON.stringify(inputNotNull), expectedNotNull)
  t.equal(stringify(inputNotNull), expectedNotNull)
})

test('toJSON supports required types', (t) => {
  t.plan(2)

  const stringify = build({
    title: 'object of required primitive (json) types',
    type: 'object',
    properties: {
      _bool: {
        type: 'boolean'
      },
      _int: {
        type: 'integer'
      },
      _null: {
        type: 'null'
      },
      _num: {
        type: 'number'
      },
      _str: {
        type: 'string'
      }
    },
    required: ['_bool', '_int', '_null', '_num', '_str']
  }, {
    enableToJSON: true
  })

  const input = {
    _bool: {
      toJSON () { return true }
    },
    _int: {
      toJSON () { return 42 }
    },
    _null: {
      toJSON () { return null }
    },
    _num: {
      toJSON () { return 3.14 }
    },
    _str: {
      toJSON () { return 'whatever' }
    }
  }
  const expected = '{"_bool":true,"_int":42,"_null":null,"_num":3.14,"_str":"whatever"}'
  t.equal(stringify(input), expected)

  const invalidInput = {
    toJSON () { return {} }
  }
  t.throws(() => { stringify(invalidInput) })
})

test('use toJSON recursively', (t) => {
  t.plan(2)
  const nullable = true
  const stringify = build({
    title: 'simple object',
    type: 'object',
    properties: {
      _bool: {
        type: 'boolean'
      },
      _bool_nullable: {
        nullable,
        type: 'boolean'
      },
      _bool_required: {
        type: 'boolean'
      },
      _int: {
        type: 'integer'
      },
      _int_nullable: {
        nullable,
        type: 'integer'
      },
      _int_required: {
        type: 'integer'
      },
      _null: {
        type: 'null'
      },
      _null_required: {
        type: 'null'
      },
      _num: {
        type: 'number'
      },
      _num_nullable: {
        nullable,
        type: 'number'
      },
      _num_required: {
        type: 'number'
      },
      _str: {
        type: 'string'
      },
      _str_nullable: {
        nullable,
        type: 'string'
      },
      _str_required: {
        type: 'string'
      }
    },
    required: [
      '_bool_required',
      '_int_required',
      '_null_required',
      '_num_required',
      '_str_required'
    ]
  }, {
    enableToJSON: true
  })
  const aggregate = {
    props: {
      _bool: {
        toJSON () { return true }
      },
      _int: {
        toJSON () { return 42 }
      },
      _null: {
        toJSON () { return null }
      },
      _num: {
        toJSON () { return 3.14 }
      },
      _str: {
        toJSON () { return 'whatever' }
      }
    },
    toJSON () {
      return {
        _bool: this.props._bool,
        _bool_nullable: this.props._null,
        _bool_required: this.props._bool,
        _int: this.props._int,
        _int_nullable: this.props._null,
        _int_required: this.props._int,
        _null: this.props._null,
        _null_required: this.props._null,
        _num: this.props._num,
        _num_nullable: this.props._null,
        _num_required: this.props._num,
        _str: this.props._str,
        _str_nullable: this.props._null,
        _str_required: this.props._str
      }
    }
  }
  const expected = '{"_bool":true,"_bool_nullable":null,"_bool_required":true,"_int":42,"_int_nullable":null,"_int_required":42,"_null":null,"_null_required":null,"_num":3.14,"_num_nullable":null,"_num_required":3.14,"_str":"whatever","_str_nullable":null,"_str_required":"whatever"}'

  t.equal(JSON.stringify(aggregate), expected)
  t.equal(stringify(aggregate), expected)
})
