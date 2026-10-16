'use strict'

const { test } = require('node:test')
const build = require('..')

process.env.TZ = 'UTC'

for (const iso of ['+010000-02-03T04:05:06.000Z', '-000001-02-03T04:05:06.000Z', '0000-02-03T04:05:06.000Z', '9999-02-03T04:05:06.000Z']) {
  test(`preserve the whole calendar date for ${iso}`, (t) => {
    const stringify = build({ type: 'string', format: 'date' })
    t.assert.equal(stringify(new Date(iso)), JSON.stringify(iso.split('T')[0]))
  })
}
