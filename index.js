'use strict'

var fastSafeStringify = require('fast-safe-stringify')
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

    var error, ret
  `
  // used to support patternProperties and additionalProperties
  // they need to check if a field belongs to the properties in the schema
  code += `
    var properties = ${JSON.stringify(schema.properties)} || {}
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
  if (hasAdditionalPropertiesTrue(schema)) {
    dependencies.push(fastSafeStringify)
    dependenciesName.push('fastSafeStringify')
  }
  if (hasAnyOf(schema)) {
    dependencies.push(new Ajv())
    dependenciesName.push('ajv')
  }

  dependenciesName.push(code)
  return (Function.apply(null, dependenciesName).apply(null, dependencies))
}

function hasAdditionalPropertiesTrue (schema) {
  if (schema.additionalProperties === true) { return true }

  var objectKeys = Object.keys(schema)
  for (var i = 0; i < objectKeys.length; i++) {
    var value = schema[objectKeys[i]]
    if (typeof value === 'object') {
      if (hasAdditionalPropertiesTrue(value)) { return true }
    }
  }

  return false
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

var error
function $asNumber (i) {
  if (i === 0) return '0'
  if (i !== '' && i !== null && i !== undefined && i !== true && i !== false && (i.constructor === Number || typeof i !== 'object')) {
    var num = Number(i)
    if (isFinite(num)) {
      return '' + num
    }
  }
  error = new Error('Cannot coerce to number')
  return error
}

function $asBoolean (bool) {
  if (bool === true) return 'true'
  if (bool === false) return 'false'
  if (bool === 'true') return 'true'
  if (bool === 'false') return 'false'
  error = new Error('Cannot coerce to boolean')
  return error
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
          ret = buildObjectPP${index}(obj[keys[i]])
          if (ret === error) return ret
          json += $asString(keys[i]) + ':' + ret
      `
    } else if (type === 'array') {
      code += buildArray(pp[regex], '', 'buildArrayPP' + index, externalSchema, fullSchema)
      code += `
          ${addComma}
          ret = buildArrayPP${index}(obj[keys[i]])
          if (ret === error) return ret
          json += $asString(keys[i]) + ':' + ret
      `
    } else if (type === 'null') {
      code += `
          ${addComma}
          json += $asString(keys[i]) +':null'
      `
    } else if (type === 'string') {
      code += `
          ${addComma}
          ret = $asString(obj[keys[i]])
          if (ret === error) return ret
          json += $asString(keys[i]) + ':' + ret
      `
    } else if (type === 'integer') {
      code += `
          ${addComma}
          ret = $asInteger(obj[keys[i]])
          if (ret === error) return ret
          json += $asString(keys[i]) + ':' + ret
      `
    } else if (type === 'number') {
      code += `
          ${addComma}
          ret = $asNumber(obj[keys[i]])
          if (ret === error) return ret
          json += $asString(keys[i]) + ':' + ret
      `
    } else if (type === 'boolean') {
      code += `
          ${addComma}
          ret = $asBoolean(obj[keys[i]])
          if (ret === error) return ret
          json += $asString(keys[i]) + ':' + ret
      `
    } else {
      code += `
        error = new Error('Cannot coerce ' + obj[keys[i]] + ' to ${type}')
        return error
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
          ret = fastSafeStringify(obj[keys[i]])
          if (ret === error) return ret
          json += $asString(keys[i]) + ':' + ret
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
        ret = buildObjectAP(obj[keys[i]])
        if (ret === error) return ret
        json += $asString(keys[i]) + ':' + ret
    `
  } else if (type === 'array') {
    code += buildArray(ap, '', 'buildArrayAP', externalSchema, fullSchema)
    code += `
        ${addComma}
        ret = buildArrayAP(obj[keys[i]])
        if (ret === error) return ret
        json += $asString(keys[i]) + ':' + ret
    `
  } else if (type === 'null') {
    code += `
        ${addComma}
        json += $asString(keys[i]) + ':null'
    `
  } else if (type === 'string') {
    code += `
        ${addComma}
        ret = $asString(obj[keys[i]])
        if (ret === error) return ret
        json += $asString(keys[i]) + ':' + ret
    `
  } else if (type === 'integer') {
    code += `
        ${addComma}
        ret = $asInteger(obj[keys[i]])
        if (ret === error) return ret
        json += $asString(keys[i]) + ':' + ret
    `
  } else if (type === 'number') {
    code += `
        ${addComma}
        ret = $asNumber(obj[keys[i]])
        if (ret === error) return ret
        json += $asString(keys[i]) + ':' + ret
    `
  } else if (type === 'boolean') {
    code += `
        ${addComma}
        ret = $asBoolean(obj[keys[i]])
        if (ret === error) return ret
        json += $asString(keys[i]) + ':' + ret
    `
  } else {
    code += `
        error = new Error('Cannot coerce ' + obj[keys[i]] + ' to ${type}')
        return
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
    // Using obj['key'] !== undefined instead of obj.hasOwnProperty(prop) for perf reasons,
    // see https://github.com/mcollina/fast-json-stringify/pull/3 for discussion.
    code += `
      if (obj['${key}'] !== undefined) {
        ${addComma}
        ret = '${$asString(key)}:'
        if (ret === error) return ret
        json += ret
      `

    if (schema.properties[key]['$ref']) {
      schema.properties[key] = refFinder(schema.properties[key]['$ref'], fullSchema, externalSchema)
    }

    var result = nested(laterCode, name, key, schema.properties[key], externalSchema, fullSchema)

    code += result.code
    laterCode = result.laterCode

    if (schema.required && schema.required.indexOf(key) !== -1) {
      code += `
      } else {
        error = new Error('${key} is required!')
        return error
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
      var condition = `i === ${i} && `
      switch (item.type) {
        case 'null':
          condition += `obj${accessor} === null`
          break
        case 'string':
          condition += `typeof obj${accessor} === 'string'`
          break
        case 'integer':
          condition += `Number.isInteger(obj${accessor})`
          break
        case 'number':
          condition += `Number.isFinite(obj${accessor})`
          break
        case 'boolean':
          condition += `typeof obj${accessor} === 'boolean'`
          break
        case 'object':
          condition += `obj${accessor} && typeof obj${accessor} === 'object' && obj${accessor}.constructor === Object`
          break
        case 'array':
          condition += `Array.isArray(obj${accessor})`
          break
        default:
          throw new Error(`${item.type} unsupported`)
      }
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
      error = new Error(\`Item at $\{i} does not match schema definition.\`)
      return error
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
        ret = $asString(obj${accessor})
        if (ret === error) return ret
        json += ret
      `
      break
    case 'integer':
      code += `
        ret = $asInteger(obj${accessor})
        if (ret === error) return ret
        json += ret
      `
      break
    case 'number':
      code += `
        ret = $asNumber(obj${accessor})
        if (ret === error) return ret
        json += ret
      `
      break
    case 'boolean':
      code += `
        ret = $asBoolean(obj${accessor})
        if (ret === error) return ret
        json += ret
      `
      break
    case 'object':
      funcName = (name + key + subKey).replace(/[-.\[\] ]/g, '') // eslint-disable-line
      laterCode = buildObject(schema, laterCode, funcName, externalSchema, fullSchema)
      code += `
        ret = ${funcName}(obj${accessor})
        if (ret === error) return ret
        json += ret
      `
      break
    case 'array':
      funcName = (name + key + subKey).replace(/[-.\[\] ]/g, '') // eslint-disable-line
      laterCode = buildArray(schema, laterCode, funcName, externalSchema, fullSchema)
      code += `
        ret = ${funcName}(obj${accessor})
        if (ret === error) return ret
        json += ret
      `
      break
    case undefined:
      if ('anyOf' in schema) {
        schema.anyOf.forEach((s, index) => {
          code += `
            ${index === 0 ? 'if' : 'else if'}(ajv.validate(${require('util').inspect(s, {depth: null})}, obj${accessor})) {
              ${nested(laterCode, name, key, s, externalSchema, fullSchema, subKey).code}
            }
          `
        })
        code += `
          else json+= null
        `
      } else throw new Error(`${schema} unsupported`)
      break
    default:
      throw new Error(`${type} unsupported`)
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
