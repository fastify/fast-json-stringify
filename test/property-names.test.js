'use strict'

const { test } = require('node:test')
const build = require('..')

// the schema ref of a property with anyOf, oneOf or if goes into the generated code as a
// string and into a JSON pointer, so a name that needs escaping in either broke the build
const names = ['new\nline', 'q"uote', 'back\\slash', 'a/b', 'a~b', 'a%b', 'a#b', 'a b', 'tick`', 'dollar$' + '{x}', '\\u', "single'quote"]
const branches = {
  oneOf: { oneOf: [{ type: 'string' }, { type: 'object', properties: { k: { type: 'integer' } }, required: ['k'] }] },
  anyOf: { anyOf: [{ type: 'string' }, { type: 'object', properties: { k: { type: 'integer' } }, required: ['k'] }] },
  if: { if: { type: 'string' }, then: { type: 'string' }, else: { type: 'integer' } }
}

for (const name of names) {
  for (const [keyword, subschema] of Object.entries(branches)) {
    test(`a property named ${JSON.stringify(name)} with ${keyword}`, (t) => {
      t.plan(2)

      const stringify = build({ type: 'object', properties: { [name]: subschema } })
      t.assert.equal(stringify({ [name]: 'v' }), JSON.stringify({ [name]: 'v' }))
      t.assert.throws(() => stringify({ [name]: {} }), keyword === 'if' ? Error : new TypeError(`The value of '#/properties/${name.replace(/~/g, '~0').replace(/\//g, '~1')}' does not match schema definition.`))
    })
  }
}
