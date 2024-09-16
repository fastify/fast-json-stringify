'use strict'

const { describe } = require('node:test')
const { throws } = require('node:assert')
const build = require('..')

describe('object with required field', (t) => {
  const schema = {
    title: 'object with required field',
    type: 'object',
    properties: {
      str: {
        type: 'string'
      },
      num: {
        type: 'integer'
      }
    },
    required: ['str']
  }
  const stringify = build(schema)

  stringify({
    str: 'string'
  })

  throws(() => {
    stringify({ num: 42 })
  }, {
    message: '"str" is required!'
  })
})

describe('object with required field not in properties schema', (t) => {
  const schema = {
    title: 'object with required field',
    type: 'object',
    properties: {
      num: {
        type: 'integer'
      }
    },
    required: ['str']
  }
  const stringify = build(schema)

  throws(() => {
    stringify({})
  }, {
    message: '"str" is required!'
  })
  throws(() => {
    stringify({ num: 42 })
  }, {
    message: '"str" is required!'
  })
})

describe('object with required field not in properties schema with additional properties true', (t) => {
  const schema = {
    title: 'object with required field',
    type: 'object',
    properties: {
      num: {
        type: 'integer'
      }
    },
    additionalProperties: true,
    required: ['str']
  }
  const stringify = build(schema)

  throws(() => {
    stringify({})
  }, {
    message: '"str" is required!'
  })

  throws(() => {
    stringify({ num: 42 })
  }, {
    message: '"str" is required!'
  })
})

describe('object with multiple required field not in properties schema', (t) => {
  const schema = {
    title: 'object with required field',
    type: 'object',
    properties: {
      num: {
        type: 'integer'
      }
    },
    additionalProperties: true,
    required: ['num', 'key1', 'key2']
  }
  const stringify = build(schema)

  throws(() => {
    stringify({})
  }, {
    message: '"key1" is required!'
  })

  throws(() => {
    stringify({
      key1: 42,
      key2: 42
    })
  }, {
    message: '"num" is required!'
  })

  throws(() => {
    stringify({
      num: 42,
      key1: 'some'
    })
  }, {
    message: '"key2" is required!'
  })
})

describe('object with required bool', (t) => {
  const schema = {
    title: 'object with required field',
    type: 'object',
    properties: {
      num: {
        type: 'integer'
      }
    },
    additionalProperties: true,
    required: ['bool']
  }
  const stringify = build(schema)

  throws(() => {
    stringify({})
  }, {
    message: '"bool" is required!'
  })

  stringify({
    bool: false
  })
})

describe('required nullable', (t) => {
  const schema = {
    title: 'object with required field',
    type: 'object',
    properties: {
      num: {
        type: ['integer']
      }
    },
    additionalProperties: true,
    required: ['null']
  }
  const stringify = build(schema)

  stringify({
    null: null
  })
})

describe('required numbers', (t) => {
  const schema = {
    title: 'object with required field',
    type: 'object',
    properties: {
      str: {
        type: 'string'
      },
      num: {
        type: 'integer'
      }
    },
    required: ['num']
  }
  const stringify = build(schema)

  stringify({
    num: 42
  })
  throws(() => {
    stringify({ num: 'aaa' })
  }, {
    message: 'The value "aaa" cannot be converted to an integer.'
  })
})
