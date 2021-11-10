'use strict'

const test = require('tap').test
const build = require('..')

test('can stringify recursive directory tree (issue #181)', (t) => {
  t.plan(1)

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

  t.equal(stringify([
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

test('can stringify when recursion in external schema', t => {
  t.plan(1)

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
  t.equal(value, '{"people":{"name":"Elizabeth","children":[{"name":"Charles"}]}}')
})

test('use proper serialize function', t => {
  t.plan(1)

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
  t.equal(value, '{"people":{"name":"Elizabeth","children":[{"name":"Charles","children":[{"name":"William","children":[{"name":"George"},{"name":"Charlotte"}]},{"name":"Harry"}]}]},"directory":{"name":"directory 1","subDirectories":[{"name":"directory 1.1","subDirectories":[]},{"name":"directory 1.2","subDirectories":[{"name":"directory 1.2.1","subDirectories":[]},{"name":"directory 1.2.2","subDirectories":[]}]}]}}')
})

test('can stringify recursive references in object types (issue #365)', t => {
  t.plan(1)

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
  t.equal(value, '{"category":{"parent":{"parent":{"parent":{"parent":{}}}}}}')
})
