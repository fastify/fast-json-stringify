'use strict'

const fastSafeStringify = require('fast-safe-stringify')

function build (schema, options) {
  options = options || {}
  /* eslint no-new-func: "off" */
  var code = `
    'use strict'
  `
  // used to support patternProperties and additionalProperties
  // they need to check if a field belongs to the properties in the schema
  code += `
    const properties = ${JSON.stringify(schema.properties)} || {}
  `
  code += `
    ${$asString.toString()}
    ${$asStringSmall.toString()}
    ${$asNumber.toString()}
    ${$asNull.toString()}
    ${$asBoolean.toString()}
  `
  var main

  switch (schema.type) {
    case 'object':
      main = '$main'
      code = buildObject(schema, code, main, options.schema, schema)
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
      code = buildArray(schema, code, main, options.schema, schema)
      break
    default:
      throw new Error(`${schema.type} unsupported`)
  }

  code += `
    ;
    return ${main}
  `
  if (schema.additionalProperties === true) {
    return (new Function('fastSafeStringify', code))(fastSafeStringify)
  }
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
  return bool && 'true' || 'false' // eslint-disable-line
}

function $asString (str) {
  if (str instanceof Date) {
    return '"' + str.toISOString() + '"'
  } else if (str instanceof RegExp) {
    str = str.source
  } else if (typeof str !== 'string') {
    str = str.toString()
  }

  if (str.length < 42) {
    return $asStringSmall(str)
  } else {
    return JSON.stringify(str)
  }
}

// magically escape strings for json
// relying on their charCodeAt
// everything below 32 needs JSON.stringify()
// 34 and 92 happens all the time, so we
// have a fast case for them
function $asStringSmall (str) {
  var result = ''
  var last = 0
  var l = str.length
  var point = 255
  for (var i = 0; i < l && point >= 32; i++) {
    point = str.charCodeAt(i)
    if (point === 34 || point === 92) {
      result += str.slice(last, i) + '\\'
      last = i
    }
  }
  if (last === 0) {
    result = str
  } else {
    result += str.slice(last)
  }
  return point < 32 ? JSON.stringify(str) : '"' + result + '"'
}

function addPatternProperties (schema, externalSchema, fullSchema) {
  var pp = schema.patternProperties
  let code = `
      var keys = Object.keys(obj)
      for (var i = 0; i < keys.length; i++) {
        if (properties[keys[i]]) continue
  `
  Object.keys(pp).forEach((regex, index) => {
    if (pp[regex]['$ref']) {
      pp[regex] = refFinder(pp[regex]['$ref'], fullSchema, externalSchema, fullSchema)
    }
    var type = pp[regex].type
    code += `
        if (/${regex}/.test(keys[i])) {
    `
    if (type === 'object') {
      code += buildObject(pp[regex], '', 'buildObjectPP' + index, externalSchema, fullSchema)
      code += `
          json += $asString(keys[i]) + ':' + buildObjectPP${index}(obj[keys[i]]) + ','
      `
    } else if (type === 'array') {
      code += buildArray(pp[regex], '', 'buildArrayPP' + index, externalSchema, fullSchema)
      code += `
          json += $asString(keys[i]) + ':' + buildArrayPP${index}(obj[keys[i]]) + ','
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
          continue
        }
    `
  })
  if (schema.additionalProperties) {
    code += additionalProperty(schema, externalSchema, fullSchema)
  }

  code += `
      }
  `
  return code
}

function additionalProperty (schema, externalSchema, fullSchema) {
  var ap = schema.additionalProperties
  let code = ''
  if (ap === true) {
    return `
        json += $asString(keys[i]) + ':' + fastSafeStringify(obj[keys[i]]) + ','
    `
  }
  if (ap['$ref']) {
    ap = refFinder(ap['$ref'], fullSchema, externalSchema)
  }

  let type = ap.type
  if (type === 'object') {
    code += buildObject(ap, '', 'buildObjectAP', externalSchema)
    code += `
        json += $asString(keys[i]) + ':' + buildObjectAP(obj[keys[i]]) + ','
    `
  } else if (type === 'array') {
    code += buildArray(ap, '', 'buildArrayAP', externalSchema, fullSchema)
    code += `
        json += $asString(keys[i]) + ':' + buildArrayAP(obj[keys[i]]) + ','
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
  return code
}

function addAdditionalProperties (schema, externalSchema, fullSchema) {
  return `
      var keys = Object.keys(obj)
      for (var i = 0; i < keys.length; i++) {
        if (properties[keys[i]]) continue
        ${additionalProperty(schema, externalSchema, fullSchema)}
      }
  `
}

function refFinder (ref, schema, externalSchema) {
  // Split file from walk
  ref = ref.split('#')
  // If external file
  if (ref[0]) {
    schema = externalSchema[ref[0]]
  }
  const walk = ref[1].split('/')
  let code = 'return schema'
  for (let i = 1; i < walk.length; i++) {
    code += `['${walk[i]}']`
  }
  return (new Function('schema', code))(schema)
}

function buildObject (schema, code, name, externalSchema, fullSchema) {
  code += `
    function ${name} (obj) {
      var json = '{'
  `

  if (schema.patternProperties) {
    code += addPatternProperties(schema, externalSchema, fullSchema)
  } else if (schema.additionalProperties && !schema.patternProperties) {
    code += addAdditionalProperties(schema, externalSchema, fullSchema)
  }

  var laterCode = ''

  Object.keys(schema.properties || {}).forEach((key, i, a) => {
    // Using obj.key !== undefined instead of obj.hasOwnProperty(prop) for perf reasons,
    // see https://github.com/mcollina/fast-json-stringify/pull/3 for discussion.
    code += `
      if (obj.${key} !== undefined) {
        json += '${$asString(key)}:'
      `

    if (schema.properties[key]['$ref']) {
      schema.properties[key] = refFinder(schema.properties[key]['$ref'], fullSchema, externalSchema)
    }

    const result = nested(laterCode, name, '.' + key, schema.properties[key], externalSchema, fullSchema)

    code += result.code
    laterCode = result.laterCode
    /* eslint-disable no-useless-escape */
    if (i < a.length - 1) {
      code += `
        json += \',\'
      `
    }
    /* eslint-enable no-useless-escape */

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

  // Removes the comma if is the last element of the string (in case there are not properties)
  code += `
      if (json[json.length - 1] === ',') json = json.substring(0, json.length - 1)
      json += '}'
      return json
    }
  `

  code += laterCode
  return code
}

function buildArray (schema, code, name, externalSchema, fullSchema) {
  code += `
    function ${name} (obj) {
      var json = '['
  `

  var laterCode = ''

  if (schema.items['$ref']) {
    schema.items = refFinder(schema.items['$ref'], fullSchema, externalSchema)
  }

  const result = nested(laterCode, name, '[i]', schema.items, externalSchema, fullSchema)

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

function nested (laterCode, name, key, schema, externalSchema, fullSchema) {
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
      funcName = (name + key).replace(/[-.\[\]]/g, '') // eslint-disable-line
      laterCode = buildObject(schema, laterCode, funcName, externalSchema, fullSchema)
      code += `
        json += ${funcName}(obj${key})
      `
      break
    case 'array':
      funcName = (name + key).replace(/[-.\[\]]/g, '') // eslint-disable-line
      laterCode = buildArray(schema, laterCode, funcName, externalSchema, fullSchema)
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
