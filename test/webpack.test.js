'use strict'

const { describe } = require('node:test')
const { equal } = require('node:assert')
const webpack = require('webpack')
const path = require('path')

describe('the library should work with webpack', async (t) => {
  const targetdir = path.resolve(__dirname, '..', '.cache')
  const targetname = path.join(targetdir, 'webpacktest.js')
  const wopts = {
    entry: path.resolve(__dirname, '..', 'index.js'),
    mode: 'production',
    target: 'node',
    output: {
      path: targetdir,
      filename: 'webpacktest.js',
      library: {
        name: 'fastJsonStringify',
        type: 'umd'
      }
    }
  }
  await new Promise((resolve, reject) => {
    webpack(wopts, (err, stats) => {
      if (err) { reject(err) } else { resolve(stats) };
    })
  })
  const build = require(targetname)
  const stringify = build({
    title: 'webpack should not rename code to be executed',
    type: 'object',
    properties: {
      foo: {
        type: 'string'
      },
      bar: {
        type: 'boolean'
      }
    },
    patternProperties: {
      foo: {
        type: 'number'
      }
    }
  })

  const obj = { foo: '42', bar: true }
  equal(stringify(obj), '{"foo":"42","bar":true}')
})
