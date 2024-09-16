'use strict'

const { describe } = require('node:test')
const { equal } = require('node:assert')
const build = require('..')

describe('can stringify recursive directory tree (issue #181)', (t) => {
  const schema = {
    definitions: {
      directory: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          subDirectories: {
            type: 'array',
            items: { $ref: '#/definitions/directory' },
            default: []
          }
        }
      }
    },
    type: 'array',
    items: { $ref: '#/definitions/directory' }
  }
  const stringify = build(schema)

  equal(stringify([
    { name: 'directory 1', subDirectories: [] },
    {
      name: 'directory 2',
      subDirectories: [
        { name: 'directory 2.1', subDirectories: [] },
        { name: 'directory 2.2', subDirectories: [] }
      ]
    }
  ]), '[{"name":"directory 1","subDirectories":[]},{"name":"directory 2","subDirectories":[{"name":"directory 2.1","subDirectories":[]},{"name":"directory 2.2","subDirectories":[]}]}]')
})

describe('can stringify when recursion in external schema', t => {
  const referenceSchema = {
    $id: 'person',
    type: 'object',
    properties: {
      name: { type: 'string' },
      children: {
        type: 'array',
        items: { $ref: '#' }
      }
    }
  }

  const schema = {
    $id: 'mainSchema',
    type: 'object',
    properties: {
      people: {
        $ref: 'person'
      }
    }
  }
  const stringify = build(schema, {
    schema: {
      [referenceSchema.$id]: referenceSchema
    }
  })

  const value = stringify({ people: { name: 'Elizabeth', children: [{ name: 'Charles' }] } })
  equal(value, '{"people":{"name":"Elizabeth","children":[{"name":"Charles"}]}}')
})

describe('use proper serialize function', t => {
  const personSchema = {
    $id: 'person',
    type: 'object',
    properties: {
      name: { type: 'string' },
      children: {
        type: 'array',
        items: { $ref: '#' }
      }
    }
  }

  const directorySchema = {
    $id: 'directory',
    type: 'object',
    properties: {
      name: { type: 'string' },
      subDirectories: {
        type: 'array',
        items: { $ref: '#' },
        default: []
      }
    }
  }

  const schema = {
    $id: 'mainSchema',
    type: 'object',
    properties: {
      people: { $ref: 'person' },
      directory: { $ref: 'directory' }
    }
  }
  const stringify = build(schema, {
    schema: {
      [personSchema.$id]: personSchema,
      [directorySchema.$id]: directorySchema
    }
  })

  const value = stringify({
    people: {
      name: 'Elizabeth',
      children: [{
        name: 'Charles',
        children: [{ name: 'William', children: [{ name: 'George' }, { name: 'Charlotte' }] }, { name: 'Harry' }]
      }]
    },
    directory: {
      name: 'directory 1',
      subDirectories: [
        { name: 'directory 1.1', subDirectories: [] },
        {
          name: 'directory 1.2',
          subDirectories: [{ name: 'directory 1.2.1' }, { name: 'directory 1.2.2' }]
        }
      ]
    }
  })
  equal(value, '{"people":{"name":"Elizabeth","children":[{"name":"Charles","children":[{"name":"William","children":[{"name":"George"},{"name":"Charlotte"}]},{"name":"Harry"}]}]},"directory":{"name":"directory 1","subDirectories":[{"name":"directory 1.1","subDirectories":[]},{"name":"directory 1.2","subDirectories":[{"name":"directory 1.2.1","subDirectories":[]},{"name":"directory 1.2.2","subDirectories":[]}]}]}}')
})

describe('can stringify recursive references in object types (issue #365)', t => {
  const schema = {
    type: 'object',
    definitions: {
      parentCategory: {
        type: 'object',
        properties: {
          parent: {
            $ref: '#/definitions/parentCategory'
          }
        }
      }
    },
    properties: {
      category: {
        type: 'object',
        properties: {
          parent: {
            $ref: '#/definitions/parentCategory'
          }
        }
      }
    }
  }

  const stringify = build(schema)
  const data = {
    category: {
      parent: {
        parent: {
          parent: {
            parent: {}
          }
        }
      }
    }
  }
  const value = stringify(data)
  equal(value, '{"category":{"parent":{"parent":{"parent":{"parent":{}}}}}}')
})

describe('can stringify recursive inline $id references (issue #410)', t => {
  const schema = {
    $id: 'Node',
    type: 'object',
    properties: {
      id: {
        type: 'string'
      },
      nodes: {
        type: 'array',
        items: {
          $ref: 'Node'
        }
      }
    },
    required: [
      'id',
      'nodes'
    ]
  }

  const stringify = build(schema)
  const data = {
    id: '0',
    nodes: [
      {
        id: '1',
        nodes: [{
          id: '2',
          nodes: [
            { id: '3', nodes: [] },
            { id: '4', nodes: [] },
            { id: '5', nodes: [] }
          ]
        }]
      },
      {
        id: '6',
        nodes: [{
          id: '7',
          nodes: [
            { id: '8', nodes: [] },
            { id: '9', nodes: [] },
            { id: '10', nodes: [] }
          ]
        }]
      },
      {
        id: '11',
        nodes: [{
          id: '12',
          nodes: [
            { id: '13', nodes: [] },
            { id: '14', nodes: [] },
            { id: '15', nodes: [] }
          ]
        }]
      }
    ]
  }
  const value = stringify(data)
  equal(value, '{"id":"0","nodes":[{"id":"1","nodes":[{"id":"2","nodes":[{"id":"3","nodes":[]},{"id":"4","nodes":[]},{"id":"5","nodes":[]}]}]},{"id":"6","nodes":[{"id":"7","nodes":[{"id":"8","nodes":[]},{"id":"9","nodes":[]},{"id":"10","nodes":[]}]}]},{"id":"11","nodes":[{"id":"12","nodes":[{"id":"13","nodes":[]},{"id":"14","nodes":[]},{"id":"15","nodes":[]}]}]}]}')
})
