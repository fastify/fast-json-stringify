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

test('use toJSON when it returns a primary type', (t) => {
  t.plan(3)

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
  const input1 = {
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
  const expected1 = '{"_bool":true,"_int":42,"_null":null,"_num":3.14,"_str":"whatever"}'

  t.equal(JSON.stringify(input1), expected1)
  t.equal(stringify(input1), expected1)

  const input2 = {
    _bool: {
      toJSON () { return undefined }
    },
    _int: {
      toJSON () { return 'not a number' }
    },
    _num: {
      toJSON () { return 'not a number' }
    }
  }
  const expected2 = '{"_bool":false}'
  t.equal(stringify(input2), expected2)
})

test('use toJSON recursively', (t) => {
  t.plan(2)

  const stringify = build({
    title: 'simple object',
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
        _int: this.props._int,
        _null: this.props._null,
        _num: this.props._num,
        _str: this.props._str
      }
    }
  }
  const expected = '{"_bool":true,"_int":42,"_null":null,"_num":3.14,"_str":"whatever"}'

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
