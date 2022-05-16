'use strict'

const test = require('tap').test
const build = require('..')

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
  t.plan(2)

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

  const obj = {
    props: {
      array: [
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
    },
    toJSON () {
      return this.props.array
    }
  }

  t.equal(stringify(obj), '[{"productName":"cola"},{"productName":"sprite"}]')
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

test('toJSON drops props with invalid numbers', (t) => {
  t.plan(1)

  const stringify = build({
    title: 'object of primitive (json) types',
    type: 'object',
    properties: {
      _int: {
        type: 'integer'
      },
      _num: {
        type: 'number'
      }
    }
  })

  const input = {
    _int: {
      toJSON () { return 'not a number' }
    },
    _num: {
      toJSON () { return 'not a number' }
    }
  }
  const expected = '{}'
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
  })
  t.throws(() => { stringify(null) })
})
