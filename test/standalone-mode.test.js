'use strict'

const test = require('tap').test
const fjs = require('..')
const fs = require('fs')
const path = require('path')

function build (opts) {
  return fjs({
    title: 'default string',
    type: 'object',
    properties: {
      firstName: {
        type: 'string'
      }
    },
    required: ['firstName']
  }, opts)
}

const tmpDir = 'test/fixtures'

test('activate standalone mode', async (t) => {
  t.plan(2)
  let code = build({ mode: 'standalone' })
  t.type(code, 'string')
  code = code.replace(/fast-json-stringify/g, '../..')

  const destionation = path.resolve(tmpDir, 'standalone.js')

  t.teardown(async () => {
    await fs.promises.rm(destionation, { force: true })
  })

  await fs.promises.writeFile(destionation, code)
  const standalone = require(destionation)
  t.same(standalone({ firstName: 'Foo', surname: 'bar' }), JSON.stringify({ firstName: 'Foo' }), 'surname evicted')
})
