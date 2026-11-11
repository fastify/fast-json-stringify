'use strict'

const { test } = require('node:test')
const Serializer = require('../lib/serializer')

// asString picks the native JSON.stringify on V8 13.8+ and the character loop
// before that. Both must produce exactly what JSON.stringify produces; both
// are exercised here whatever the runtime.
const corpus = [
  '',
  'a',
  'plain ascii string',
  'with "quotes" and \\ backslashes',
  'control \u0000 \u0001 \n \r \t \u001f chars',
  'unicode: Łódź, Žółć, 日本語, emoji 😀, surrogate pair \ud83d\ude00',
  'lone surrogate \ud800 here',
  'x'.repeat(41),
  'x'.repeat(42),
  'y'.repeat(4999),
  'z'.repeat(5000),
  '"'.repeat(100),
  'mixed ' + 'é'.repeat(60) + ' \u2028 \u2029'
]

test('escapeStringLoop and escapeStringNative match JSON.stringify', t => {
  t.plan(corpus.length * 3)
  const serializer = new Serializer()
  for (const str of corpus) {
    const expected = JSON.stringify(str)
    t.assert.equal(Serializer.escapeStringLoop(str), expected)
    t.assert.equal(Serializer.escapeStringNative(str), expected)
    t.assert.equal(serializer.asString(str), expected)
  }
})
