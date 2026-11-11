'use strict'

const { test } = require('node:test')
const build = require('..')

function schemaWithTypo () {
  return { anyOf: [{ type: 'number', mininum: 10 }] }
}

for (const compileValidators of [false, true]) {
  const mode = compileValidators ? 'eager' : 'lazy'

  for (const [name, ajv] of [
    ['omitted', undefined],
    ['empty', {}],
    ['undefined', { strictSchema: undefined }],
    ['null', { strictSchema: null }],
    ['false', { strictSchema: false }],
    ['strict true', { strict: true }],
    ['explicit false with strict true', { strict: true, strictSchema: false }]
  ]) {
    test(`strictSchema keeps permissive behavior for ${name} (${mode})`, t => {
      const stringify = build(schemaWithTypo(), { ajv, compileValidators })
      t.assert.equal(stringify(1), '1')
    })
  }

  test(`strictSchema true rejects unknown keywords (${mode})`, t => {
    const options = { ajv: { strictSchema: true }, compileValidators }
    const unknownKeyword = /unknown keyword: "mininum"/

    if (compileValidators) {
      t.assert.throws(() => build(schemaWithTypo(), options), unknownKeyword)
    } else {
      const stringify = build(schemaWithTypo(), options)
      t.assert.throws(() => stringify(1), unknownKeyword)
    }
  })

  test(`strictSchema log warns about unknown keywords (${mode})`, t => {
    const warnings = []
    const logger = {
      log () {},
      error () {},
      warn (message) { warnings.push(message) }
    }
    const stringify = build(schemaWithTypo(), {
      ajv: { strictSchema: 'log', logger },
      compileValidators
    })

    t.assert.equal(stringify(1), '1')
    t.assert.ok(warnings.some(message => message.includes('unknown keyword: "mininum"')))
  })
}
