'use strict'

var Ajv = require('ajv')

var uglify = null
var isLong
try {
  isLong = require('long').isLong
} catch (e) {
  isLong = null
}

var addComma = `
  if (addComma) {
    json += ','
  }
  addComma = true
`

function build (schema, options) {
  options = options || {}
  isValidSchema(schema, options.schema)
  /* eslint no-new-func: "off" */
  var code = `
    'use strict'
  `

  code += `
    ${$asString.toString()}
    ${$asStringSmall.toString()}
    ${$asNumber.toString()}
    ${$asNull.toString()}
    ${$asBoolean.toString()}
  `

  // only handle longs if the module is used
  if (isLong) {
    code += `
      var isLong = ${isLong.toString()}
      ${$asInteger.toString()}
    `
  } else {
    code += `
      var $asInteger = $asNumber
    `
  }

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
      main = $asInteger.name
      break
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

  if (options.uglify) {
    code = uglifyCode(code)
  }

  var dependencies = []
  var dependenciesName = []
  if (hasAnyOf(schema) || hasArrayOfTypes(schema)) {
    dependencies.push(new Ajv())
    dependenciesName.push('ajv')
  }

  dependenciesName.push(code)
  return (Function.apply(null, dependenciesName).apply(null, dependencies))
}

function hasAnyOf (schema) {
  if ('anyOf' in schema) { return true }

  var objectKeys = Object.keys(schema)
  for (var i = 0; i < objectKeys.length; i++) {
    var value = schema[objectKeys[i]]
    if (typeof value === 'object') {
      if (hasAnyOf(value)) { return true }
    }
  }

  return false
}

function hasArrayOfTypes (schema) {
  if (Array.isArray(schema.type)) { return true }
  var i

  if (schema.type === 'object') {
    if (schema.properties) {
      var propertyKeys = Object.keys(schema.properties)
      for (i = 0; i < propertyKeys.length; i++) {
        if (hasArrayOfTypes(schema.properties[propertyKeys[i]])) {
          return true
        }
      }
    }
  } else if (schema.type === 'array') {
    if (Array.isArray(schema.items)) {
      for (i = 0; i < schema.items.length; i++) {
        if (hasArrayOfTypes(schema.items[i])) {
          return true
        }
      }
    } else if (schema.items) {
      return hasArrayOfTypes(schema.items)
    }
  } else if (Array.isArray(schema.anyOf)) {
    for (i = 0; i < schema.anyOf.length; i++) {
      if (hasArrayOfTypes(schema.anyOf[i])) {
        return true
      }
    }
  }

  return false
}

function $asNull () {
  return 'null'
}

function $asInteger (i) {
  if (isLong && isLong(i)) {
    return i.toString()
  } else {
    return $asNumber(i)
  }
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
  } else if (str === null) {
    return '""'
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
  var code = `
      var properties = ${JSON.stringify(schema.properties)} || {}
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
          ${addComma}
          json += $asString(keys[i]) + ':' + buildObjectPP${index}(obj[keys[i]])
      `
    } else if (type === 'array') {
      code += buildArray(pp[regex], '', 'buildArrayPP' + index, externalSchema, fullSchema)
      code += `
          ${addComma}
          json += $asString(keys[i]) + ':' + buildArrayPP${index}(obj[keys[i]])
      `
    } else if (type === 'null') {
      code += `
          ${addComma}
          json += $asString(keys[i]) +':null'
      `
    } else if (type === 'string') {
      code += `
          ${addComma}
          json += $asString(keys[i]) + ':' + $asString(obj[keys[i]])
      `
    } else if (type === 'integer') {
      code += `
          ${addComma}
          json += $asString(keys[i]) + ':' + $asInteger(obj[keys[i]])
      `
    } else if (type === 'number') {
      code += `
          ${addComma}
          json += $asString(keys[i]) + ':' + $asNumber(obj[keys[i]])
      `
    } else if (type === 'boolean') {
      code += `
          ${addComma}
          json += $asString(keys[i]) + ':' + $asBoolean(obj[keys[i]])
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
  var code = ''
  if (ap === true) {
    return `
        if (obj[keys[i]] !== undefined) {
          ${addComma}
          json += $asString(keys[i]) + ':' + JSON.stringify(obj[keys[i]])
        }
    `
  }
  if (ap['$ref']) {
    ap = refFinder(ap['$ref'], fullSchema, externalSchema)
  }

  var type = ap.type
  if (type === 'object') {
    code += buildObject(ap, '', 'buildObjectAP', externalSchema)
    code += `
        ${addComma}
        json += $asString(keys[i]) + ':' + buildObjectAP(obj[keys[i]])
    `
  } else if (type === 'array') {
    code += buildArray(ap, '', 'buildArrayAP', externalSchema, fullSchema)
    code += `
        ${addComma}
        json += $asString(keys[i]) + ':' + buildArrayAP(obj[keys[i]])
    `
  } else if (type === 'null') {
    code += `
        ${addComma}
        json += $asString(keys[i]) +':null'
    `
  } else if (type === 'string') {
    code += `
        ${addComma}
        json += $asString(keys[i]) + ':' + $asString(obj[keys[i]])
    `
  } else if (type === 'integer') {
    code += `
        var t = Number(obj[keys[i]])
    `
    if (isLong) {
      code += `
          if (isLong(obj[keys[i]]) || !isNaN(t)) {
            ${addComma}
            json += $asString(keys[i]) + ':' + $asInteger(obj[keys[i]])
          }
      `
    } else {
      code += `
          if (!isNaN(t)) {
            ${addComma}
            json += $asString(keys[i]) + ':' + t
          }
      `
    }
  } else if (type === 'number') {
    code += `
        var t = Number(obj[keys[i]])
        if (!isNaN(t)) {
          ${addComma}
          json += $asString(keys[i]) + ':' + t
        }
    `
  } else if (type === 'boolean') {
    code += `
        ${addComma}
        json += $asString(keys[i]) + ':' + $asBoolean(obj[keys[i]])
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
      var properties = ${JSON.stringify(schema.properties)} || {}
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
  var code = 'return schema'
  // If it has a path
  if (ref[1]) {
    var walk = ref[1].split('/')
    for (var i = 1; i < walk.length; i++) {
      code += `['${walk[i]}']`
    }
  }
  return (new Function('schema', code))(schema)
}

function buildCode (schema, code, laterCode, name, externalSchema, fullSchema) {
  Object.keys(schema.properties || {}).forEach((key, i, a) => {
    if (schema.properties[key]['$ref']) {
      schema.properties[key] = refFinder(schema.properties[key]['$ref'], fullSchema, externalSchema)
    }

    // Using obj['key'] !== undefined instead of obj.hasOwnProperty(prop) for perf reasons,
    // see https://github.com/mcollina/fast-json-stringify/pull/3 for discussion.

    var type = schema.properties[key].type
    if (type === 'number') {
      code += `
          var t = Number(obj['${key}'])
          if (!isNaN(t)) {
            ${addComma}
            json += '${$asString(key)}:' + t
      `
    } else if (type === 'integer') {
      code += `
          var rendered = false
      `
      if (isLong) {
        code += `
            if (isLong(obj['${key}'])) {
              ${addComma}
              json += '${$asString(key)}:' + obj['${key}'].toString()
              rendered = true
            } else {
              var t = Number(obj['${key}'])
              if (!isNaN(t)) {
                ${addComma}
                json += '${$asString(key)}:' + t
                rendered = true
              }
            }
        `
      } else {
        code += `
            var t = Number(obj['${key}'])
            if (!isNaN(t)) {
              ${addComma}
              json += '${$asString(key)}:' + t
              rendered = true
            }
        `
      }
      code += `
          if (rendered) {
      `
    } else {
      code += `
        if (obj['${key}'] !== undefined) {
          ${addComma}
          json += '${$asString(key)}:'
        `

      var result = nested(laterCode, name, key, schema.properties[key], externalSchema, fullSchema)
      code += result.code
      laterCode = result.laterCode
    }

    var defaultValue = schema.properties[key].default
    if (defaultValue !== undefined) {
      code += `
      } else {
        ${addComma}
        json += '${$asString(key)}:${JSON.stringify(defaultValue).replace(/'/g, '\'')}'
      `
    } else if (schema.required && schema.required.indexOf(key) !== -1) {
      code += `
      } else {
        throw new Error('${key} is required!')
      `
    }

    code += `
      }
    `
  })

  return { code: code, laterCode: laterCode }
}

function buildObject (schema, code, name, externalSchema, fullSchema) {
  code += `
    function ${name} (obj) {
      var json = '{'
      var addComma = false
  `

  if (schema.patternProperties) {
    code += addPatternProperties(schema, externalSchema, fullSchema)
  } else if (schema.additionalProperties && !schema.patternProperties) {
    code += addAdditionalProperties(schema, externalSchema, fullSchema)
  }

  var laterCode = ''

  if (schema.allOf) {
    schema.allOf.forEach((ss) => {
      var builtCode = buildCode(ss, code, laterCode, name, externalSchema, fullSchema)

      code = builtCode.code
      laterCode = builtCode.laterCode
    })
  } else {
    var builtCode = buildCode(schema, code, laterCode, name, externalSchema, fullSchema)

    code = builtCode.code
    laterCode = builtCode.laterCode
  }

  // Removes the comma if is the last element of the string (in case there are not properties)
  code += `
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

  var result = {code: '', laterCode: ''}
  if (Array.isArray(schema.items)) {
    result = schema.items.reduce((res, item, i) => {
      var accessor = '[i]'
      const tmpRes = nested(laterCode, name, accessor, item, externalSchema, fullSchema, i)
      var condition = `i === ${i} && ${buildArrayTypeCondition(item.type, accessor)}`
      return {
        code: `${res.code}
        ${i > 0 ? 'else' : ''} if (${condition}) {
          ${tmpRes.code}
        }`,
        laterCode: `${res.laterCode}
        ${tmpRes.laterCode}`
      }
    }, result)
    result.code += `
    else {
      throw new Error(\`Item at $\{i} does not match schema definition.\`)
    }
    `
  } else {
    result = nested(laterCode, name, '[i]', schema.items, externalSchema, fullSchema)
  }

  code += `
    var l = obj.length
    var w = l - 1
    for (var i = 0; i < l; i++) {
      if (i > 0) {
        json += ','
      }
      ${result.code}
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

function buildArrayTypeCondition (type, accessor) {
  var condition
  switch (type) {
    case 'null':
      condition = `obj${accessor} === null`
      break
    case 'string':
      condition = `typeof obj${accessor} === 'string'`
      break
    case 'integer':
      condition = `Number.isInteger(obj${accessor})`
      break
    case 'number':
      condition = `Number.isFinite(obj${accessor})`
      break
    case 'boolean':
      condition = `typeof obj${accessor} === 'boolean'`
      break
    case 'object':
      condition = `obj${accessor} && typeof obj${accessor} === 'object' && obj${accessor}.constructor === Object`
      break
    case 'array':
      condition = `Array.isArray(obj${accessor})`
      break
    default:
      if (Array.isArray(type)) {
        var conditions = type.map((subType) => {
          return buildArrayTypeCondition(subType, accessor)
        })
        condition = `(${conditions.join(' || ')})`
      } else {
        throw new Error(`${type} unsupported`)
      }
  }
  return condition
}

function nested (laterCode, name, key, schema, externalSchema, fullSchema, subKey) {
  var code = ''
  var funcName
  var type = schema.type
  var accessor = key.indexOf('[') === 0 ? key : `['${key}']`
  switch (type) {
    case 'null':
      code += `
        json += $asNull()
      `
      break
    case 'string':
      code += `
        json += $asString(obj${accessor})
      `
      break
    case 'integer':
      code += `
        json += $asInteger(obj${accessor})
      `
      break
    case 'number':
      code += `
        json += $asNumber(obj${accessor})
      `
      break
    case 'boolean':
      code += `
        json += $asBoolean(obj${accessor})
      `
      break
    case 'object':
      funcName = (name + key + subKey).replace(/[-.\[\] ]/g, '') // eslint-disable-line
      laterCode = buildObject(schema, laterCode, funcName, externalSchema, fullSchema)
      code += `
        json += ${funcName}(obj${accessor})
      `
      break
    case 'array':
      funcName = (name + key + subKey).replace(/[-.\[\] ]/g, '') // eslint-disable-line
      laterCode = buildArray(schema, laterCode, funcName, externalSchema, fullSchema)
      code += `
        json += ${funcName}(obj${accessor})
      `
      break
    case undefined:
      if ('anyOf' in schema) {
        schema.anyOf.forEach((s, index) => {
          var nestedResult = nested(laterCode, name, key, s, externalSchema, fullSchema, subKey)
          code += `
            ${index === 0 ? 'if' : 'else if'}(ajv.validate(${require('util').inspect(s, {depth: null})}, obj${accessor}))
              ${nestedResult.code}
          `
          laterCode = nestedResult.laterCode
        })
        code += `
          else json+= null
        `
      } else throw new Error(`${schema} unsupported`)
      break
    default:
      if (Array.isArray(type)) {
        type.forEach((type, index) => {
          var tempSchema = {type: type}
          var nestedResult = nested(laterCode, name, key, tempSchema, externalSchema, fullSchema, subKey)
          if (type === 'string') {
            code += `
              ${index === 0 ? 'if' : 'else if'}(obj${accessor} instanceof Date || ajv.validate(${require('util').inspect(tempSchema, {depth: null})}, obj${accessor}))
                ${nestedResult.code}
            `
          } else {
            code += `
              ${index === 0 ? 'if' : 'else if'}(ajv.validate(${require('util').inspect(tempSchema, {depth: null})}, obj${accessor}))
              ${nestedResult.code}
            `
          }
          laterCode = nestedResult.laterCode
        })
        code += `
          else json+= null
        `
      } else {
        throw new Error(`${type} unsupported`)
      }
  }

  return {
    code,
    laterCode
  }
}

function uglifyCode (code) {
  if (!uglify) {
    loadUglify()
  }

  var uglified = uglify.minify(code, { parse: { bare_returns: true } })

  if (uglified.error) {
    throw uglified.error
  }

  return uglified.code
}

function loadUglify () {
  try {
    uglify = require('uglify-es')
    var uglifyVersion = require('uglify-es/package.json').version

    if (uglifyVersion[0] !== '3') {
      throw new Error('Only version 3 of uglify-es is supported')
    }
  } catch (e) {
    uglify = null
    if (e.code === 'MODULE_NOT_FOUND') {
      throw new Error('In order to use uglify, you have to manually install `uglify-es`')
    }

    throw e
  }
}

function isValidSchema (schema, externalSchema) {
  const ajv = new Ajv()
  if (externalSchema) {
    Object.keys(externalSchema).forEach(key => {
      ajv.addSchema(externalSchema[key], key)
    })
  }
  ajv.compile(schema)
}

module.exports = build
