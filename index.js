'use strict'

function build (schema) {
  /*eslint no-new-func: "off"*/
  var code = `
    'use strict'
    const properties = ${JSON.stringify(schema.properties)}
    ${$asString.toString()}
    ${$asStringSmall.toString()}
    ${$asStringLong.toString()}
    ${$asNumber.toString()}
    ${$asNull.toString()}
    ${$asBoolean.toString()}
    ${$asRegExp.toString()}
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
    case 'boolean':
      main = $asBoolean.name
      break
    case 'null':
      main = $asNull.name
      break
    case 'array':
      main = '$main'
      code = buildArray(schema, code, main)
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

function $asNull () {
  return 'null'
}

function $asNumber (i) {
  var num = Number(i)
  if (isNaN(num)) {
    return 'null'
  } else {
    return '' + num
  }
}

function $asBoolean (bool) {
  return bool && 'true' || 'false'
}

function $asString (str) {
  if (str instanceof Date) {
    return '"' + str.toISOString() + '"'
  } else if (str instanceof RegExp) {
    return $asRegExp(str)
  } else if (typeof str !== 'string') {
    str = str.toString()
  }

  if (str.length < 42) {
    return $asStringSmall(str)
  } else {
    return $asStringLong(str)
  }
}

function $asStringLong (str) {
  var result = ''
  var l = str.length
  var i

  for (;(i = str.indexOf('"')) >= 0 && i < l;) {
    result += str.slice(0, i) + '\\"'
    str = str.slice(i + 1)
    l = str.length
  }

  if (l > 0) {
    result += str
  }

  return '"' + result + '"'
}

function $asStringSmall (str) {
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

function $asRegExp (reg) {
  reg = reg.source

  for (var i = 0, len = reg.length; i < len; i++) {
    if (reg[i] === '\\' || reg[i] === '"') {
      reg = reg.substring(0, i) + '\\' + reg.substring(i++)
      len += 2
    }
  }

  return '"' + reg + '"'
}

function addPatternProperties (pp) {
  let code = `
      var keys = Object.keys(obj)
      for (var i = 0; i < keys.length; i++) {
        if (properties[keys[i]]) continue
  `
  Object.keys(pp).forEach(regex => {
    var type = pp[regex].type
    if (type === 'integer') type = 'number'
    code += `
        if (/${regex}/.test(keys[i])) {
    `
    if (type === 'object') {
      code += `
          json += $asString(keys[i]) + ':{},'
      `
    } else if (type === 'array') {
      code += `
          json += $asString(keys[i]) + ':[],'
      `
    } else if (type === 'null') {
      code += `
          json += $asString(keys[i]) +':null,'
      `
    } else if (type === 'string') {
      code += `
          json += $asString(keys[i]) + ':' + $asString(obj[keys[i]]) + ','
      `
    } else if (type === 'number' || type === 'integer') {
      code += `
          json += $asString(keys[i]) + ':' + $asNumber(obj[keys[i]]) + ','
      `
    } else if (type === 'boolean') {
      code += `
          json += $asString(keys[i]) + ':' + $asBoolean(obj[keys[i]]) + ','
      `
    } else {
      code += `
          throw new Error('Cannot coerce ' + obj[keys[i]] + ' to ${type}')
      `
    }
    code += `
        }
    `
  })
  code += `
      }
      if (Object.keys(properties).length === 0) json = json.substring(0, json.length - 1)
  `
  return code
}

function buildObject (schema, code, name) {
  code += `
    function ${name} (obj) {
      var json = '{'
  `
  if (schema.patternProperties) {
    code += addPatternProperties(schema.patternProperties)
  }

  var laterCode = ''

  Object.keys(schema.properties).forEach((key, i, a) => {
    // Using obj.key !== undefined instead of obj.hasOwnProperty(prop) for perf reasons,
    // see https://github.com/mcollina/fast-json-stringify/pull/3 for discussion.
    code += `
      if (obj.${key} !== undefined) {
        json += '${$asString(key)}:'
      `

    const result = nested(laterCode, name, '.' + key, schema.properties[key])

    code += result.code
    laterCode = result.laterCode

    if (i < a.length - 1) {
      code += `
        json += \',\'
      `
    }

    if (schema.required && schema.required.indexOf(key) !== -1) {
      code += `
      } else {
        throw new Error('${key} is required!')
      `
    }

    code += `
      }
    `
  })

  code += `
      json += '}'
      return json
    }
  `

  code += laterCode

  return code
}

function buildArray (schema, code, name) {
  code += `
    function ${name} (obj) {
      var json = '['
  `

  var laterCode = ''

  const result = nested(laterCode, name, '[i]', schema.items)

  code += `
    const l = obj.length
    const w = l - 1
    for (var i = 0; i < l; i++) {
      ${result.code}
      if (i < w) {
        json += ','
      }
    }
  `

  laterCode = result.laterCode

  code += `
      json += ']'
      return json
    }
  `

  code += laterCode

  return code
}

function nested (laterCode, name, key, schema) {
  var code = ''
  var funcName
  const type = schema.type
  switch (type) {
    case 'null':
      code += `
        json += $asNull()
      `
      break
    case 'string':
      code += `
        json += $asString(obj${key})
      `
      break
    case 'number':
    case 'integer':
      code += `
        json += $asNumber(obj${key})
      `
      break
    case 'boolean':
      code += `
        json += $asBoolean(obj${key})
      `
      break
    case 'object':
      funcName = (name + key).replace(/[-.\[\]]/g, '')
      laterCode = buildObject(schema, laterCode, funcName)
      code += `
        json += ${funcName}(obj${key})
      `
      break
    case 'array':
      funcName = (name + key).replace(/[-.\[\]]/g, '')
      laterCode = buildArray(schema, laterCode, funcName)
      code += `
        json += ${funcName}(obj${key})
      `
      break
    default:
      throw new Error(`${type} unsupported`)
  }

  return {
    code,
    laterCode
  }
}

module.exports = build
