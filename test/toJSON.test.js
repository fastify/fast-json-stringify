'use strict'

const { describe } = require('node:test')
const { equal } = require('node:assert')
const build = require('..')

describe('use toJSON method on object types', (t) => {
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

  equal('{"productName":"cola"}', stringify(object))
})

describe('use toJSON method on nested object types', (t) => {
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

  equal('[{"productName":"cola"},{"productName":"sprite"}]', stringify(array))
})

describe('not use toJSON if does not exist', (t) => {
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

  equal('{"product":{"name":"cola"}}', stringify(object))
})

describe('not fail on null object declared nullable', (t) => {
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
  equal('null', stringify(null))
})

describe('not fail on null sub-object declared nullable', (t) => {
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
  equal('{"product":null}', stringify(object))
})

describe('on non nullable null sub-object it should coerce to {}', (t) => {
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

  const result = stringify(object)
  equal(result, JSON.stringify({ product: {} }))
})

describe('on non nullable null object it should coerce to {}', (t) => {
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

  const result = stringify(null)
  equal(result, '{}')
})

describe('on non-nullable null object it should skip rendering, skipping required fields checks', (t) => {
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
    },
    required: ['product']
  })

  const result = stringify(null)
  equal(result, '{}')
})
