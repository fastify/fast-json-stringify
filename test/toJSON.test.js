'use strict'

const test = require('tap').test
const build = require('..')

test('use toJSON method on string type', (t) => {
  t.plan(1)

  const stringify = build({ type: 'string' })
  const object = {
    product: { name: 'cola' },
    toJSON: function () {
      return this.product.name
    }
  }

  t.equal('"cola"', stringify(object))
})

test('use toJSON method on number type', (t) => {
  t.plan(1)

  const stringify = build({ type: 'number' })
  const object = {
    product: { count: 42 },
    toJSON: function () {
      return this.product.count
    }
  }

  t.equal('42', stringify(object))
})

test('use toJSON method on integer type', (t) => {
  t.plan(1)

  const stringify = build({ type: 'integer' })
  const object = {
    product: { count: 42 },
    toJSON: function () {
      return this.product.count
    }
  }

  t.equal('42', stringify(object))
})

test('use toJSON method on boolean type', (t) => {
  t.plan(1)

  const stringify = build({ type: 'boolean' })
  const object = {
    product: { isActive: true },
    toJSON: function () {
      return this.product.isActive
    }
  }

  t.equal('true', stringify(object))
})

test('use toJSON method on null type', (t) => {
  t.plan(1)

  const stringify = build({ type: 'null' })
  const object = {
    product: { name: null },
    toJSON: function () {
      return this.product.name
    }
  }

  t.equal('null', stringify(object))
})

test('use toJSON method on any type', (t) => {
  t.plan(1)

  const stringify = build({})
  const object = {
    product: { name: 'any' },
    toJSON: function () {
      return this.product.name
    }
  }

  t.equal('"any"', stringify(object))
})

test('use toJSON method on array type', (t) => {
  t.plan(1)

  const stringify = build({ type: 'array' })
  const object = {
    product: { numbers: [1, 2, 3] },
    toJSON: function () {
      return this.product.numbers
    }
  }

  t.equal('[1,2,3]', stringify(object))
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
