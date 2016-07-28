'use strict'

function build (schema) {

  let code = `
    'use strict'
    let json = '{'
  `

  Object.keys(schema.properties).forEach((key, i, a) => {

    const type = schema.properties[key].type

    code += `
      json += '"${key}":'
    `

    switch (type) {
      case 'string':
        code += `
          json += '"' + obj.${key} + '"'
        `
        break;
      case 'integer':
        code += `
          json += '' + obj.${key}
        `
        break;
      default:
        throw new Error(`${type} unsupported`)
    }


    if (i < a.length - 1) {
      code += 'json += \',\''
    }
  })

  code += `
    json += '}'
    return json
  `

  return new Function('obj', code)
}

module.exports = build
