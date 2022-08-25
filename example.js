const fastJson = require('.')
const stringify = fastJson({
  title: 'Example Schema',
  type: 'object',
  properties: {
    noRequired: { const: 'hello world' }
  },
  required: ['noRequired']
})

const result = stringify({
})

console.log({ result })
