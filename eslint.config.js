'use strict'

module.exports = require('neostandard')({
  ignores: [
    ...require('neostandard').resolveIgnoresFromGitignore(),
    'schema-validator.js'
  ],
  ts: true
})
