'use strict'

function build (schema) {
  /*eslint no-new-func: "off"*/
  var code = `
    'use strict'

    ${$asString.toString()}
    ${$asNumber.toString()}
    ${$asNull.toString()}
  `
  var main

  switch (schema.type) {
    case 'object':
      main = '$main'
      code = buildObject(schema, code, main)
      break
    case 'string':
      main = $asString.name
      break
    case 'integer':
    case 'number':
      main = $asNumber.name
      break
    case 'null':
      main = $asNull.name
      break
    default:
      throw new Error(`${schema.type} unsupported`)
  }

  code += `
    ;
    return ${main}
  `

  return (new Function(code))()
}

function $asNull (i) {
  return 'null'
}

function $asNumber (i) {
  var num = Number(i)
  if (isNaN(num)) {
    return 'null'
  } else {
    return '' + i
  }
}

function $asString (s) {
  var str = s.toString()
  var result = ''
  var last = 0
  var l = str.length
  for (var i = 0; i < l; i++) {
    if (str[i] === '"') {
      result += str.slice(last, i) + '\\"'
      last = i + 1
    }
  }
  if (last === 0) {
    result = str
  } else {
    result += str.slice(last)
  }
  return '"' + result + '"'
}

function buildObject (schema, code, name) {
  code += `
    function ${name} (obj) {
      var json = '{'
  `

  var laterCode = ''

  Object.keys(schema.properties).forEach((key, i, a) => {
    const type = schema.properties[key].type

    code += `
      json += '${$asString(key)}:'
    `

    switch (type) {
      case 'null':
        code += `
          json += $asNull()
        `
        break
      case 'string':
        code += `
          json += $asString(obj.${key})
        `
        break
      case 'number':
      case 'integer':
        code += `
          json += $asNumber(obj.${key})
        `
        break
      case 'object':
        let funcName = name + key
        laterCode = buildObject(schema.properties[key], laterCode, funcName)
        code += `
          json += ${funcName}(obj.${key})
        `
        break
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
    }
  `

  code += laterCode

  return code
}

module.exports = build
