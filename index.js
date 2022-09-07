'use strict'

/* eslint no-prototype-builtins: 0 */

const merge = require('@fastify/deepmerge')()
const clone = require('rfdc')({ proto: true })
const { randomUUID } = require('crypto')

const buildStandaloneCode = require('./lib/standalone')
const validate = require('./lib/schema-validator')
const Serializer = require('./lib/serializer')
const Validator = require('./lib/validator')
const RefResolver = require('./lib/ref-resolver')

const validLargeArrayMechanisms = [
  'default',
  'json-stringify'
]

const addComma = `
  if (addComma) {
    json += ','
  } else {
    addComma = true
  }
`

function isValidSchema (schema, name) {
  if (!validate(schema)) {
    if (name) {
      name = `"${name}" `
    } else {
      name = ''
    }
    const first = validate.errors[0]
    const err = new Error(`${name}schema is invalid: data${first.instancePath} ${first.message}`)
    err.errors = isValidSchema.errors
    throw err
  }
}

const objectKeywords = [
  'maxProperties',
  'minProperties',
  'required',
  'properties',
  'patternProperties',
  'additionalProperties',
  'dependencies'
]

const arrayKeywords = [
  'items',
  'additionalItems',
  'maxItems',
  'minItems',
  'uniqueItems',
  'contains'
]

const stringKeywords = [
  'maxLength',
  'minLength',
  'pattern'
]

const numberKeywords = [
  'multipleOf',
  'maximum',
  'exclusiveMaximum',
  'minimum',
  'exclusiveMinimum'
]

/**
 * Infer type based on keyword in order to generate optimized code
 * https://datatracker.ietf.org/doc/html/draft-handrews-json-schema-validation-01#section-6
 */
function inferTypeByKeyword (schema) {
  // eslint-disable-next-line
  for (var keyword of objectKeywords) {
    if (keyword in schema) return 'object'
  }
  // eslint-disable-next-line
  for (var keyword of arrayKeywords) {
    if (keyword in schema) return 'array'
  }
  // eslint-disable-next-line
  for (var keyword of stringKeywords) {
    if (keyword in schema) return 'string'
  }
  // eslint-disable-next-line
  for (var keyword of numberKeywords) {
    if (keyword in schema) return 'number'
  }
  return schema.type
}

class SerializerFactory {
  constructor (options) {
    this.options = options

    this.refResolver = new RefResolver()
    this.validator = new Validator(options.ajv)

    this.largeArraySize = 2e4
    this.largeArrayMechanism = 'default'

    if (options.schema) {
      for (const key of Object.keys(options.schema)) {
        this.addSchema(options.schema[key], key)
      }
    }

    if (options.largeArrayMechanism) {
      if (validLargeArrayMechanisms.includes(options.largeArrayMechanism)) {
        this.largeArrayMechanism = options.largeArrayMechanism
      } else {
        throw new Error(`Unsupported large array mechanism ${options.rounding}`)
      }
    }

    if (options.largeArraySize) {
      if (!Number.isNaN(Number.parseInt(options.largeArraySize, 10))) {
        this.largeArraySize = options.largeArraySize
      } else {
        throw new Error(`Unsupported large array size. Expected integer-like, got ${options.largeArraySize}`)
      }
    }

    this.serializer = new Serializer(options)
  }

  addSchema (schema, schemaKey) {
    isValidSchema(schema, schemaKey)
    this.validator.addSchema(schema, schemaKey || this.rootSchemaId)
    this.refResolver.addSchema(schema, schemaKey || this.rootSchemaId)
  }

  build (schema, mode) {
    this.contextFunctions = []
    this.genFuncNameCounter = 0

    this.contextFunctionsNamesBySchema = new Map()

    this.rootSchemaId = schema.$id || randomUUID()
    this.addSchema(schema)

    const location = { schema, schemaId: this.rootSchemaId, jsonPointer: '#' }
    const code = this.buildValue(location, 'input')

    const contextFunctionCode = `
      function main (input) {
        let json = ''
        ${code}
        return json
      }
      ${this.contextFunctions.join('\n')}
      return main
    `

    if (mode === 'debug') {
      return {
        validator: this.validator,
        serializer: this.serializer,
        code: ['validator', 'serializer', contextFunctionCode].join('\n'),
        ajv: this.validator.ajv
      }
    }

    if (mode === 'standalone') {
      return buildStandaloneCode(this.options, this.validator, contextFunctionCode)
    }

    /* eslint no-new-func: "off" */
    const serializerFactory = new Function('validator', 'serializer', contextFunctionCode)
    return serializerFactory(this.validator, this.serializer)
  }

  mergeLocation (location, key) {
    return {
      schema: location.schema[key],
      schemaId: location.schemaId,
      jsonPointer: location.jsonPointer + '/' + key
    }
  }

  resolveRef (location, ref) {
    let hashIndex = ref.indexOf('#')
    if (hashIndex === -1) {
      hashIndex = ref.length
    }

    const schemaId = ref.slice(0, hashIndex) || location.schemaId
    const jsonPointer = ref.slice(hashIndex) || '#'

    const schema = this.refResolver.getSchema(schemaId, jsonPointer)

    if (schema === undefined) {
      throw new Error(`Cannot find reference "${ref}"`)
    }

    if (schema.$ref !== undefined) {
      return this.resolveRef({ schema, schemaId, jsonPointer }, schema.$ref)
    }

    return { schema, schemaId, jsonPointer }
  }

  addPatternProperties (location) {
    const schema = location.schema
    const pp = schema.patternProperties
    let code = `
        var properties = ${JSON.stringify(schema.properties)} || {}
        var keys = Object.keys(obj)
        for (var i = 0; i < keys.length; i++) {
          if (properties[keys[i]]) continue
    `

    const patternPropertiesLocation = this.mergeLocation(location, 'patternProperties')
    Object.keys(pp).forEach((regex) => {
      let ppLocation = this.mergeLocation(patternPropertiesLocation, regex)
      if (pp[regex].$ref) {
        ppLocation = this.resolveRef(ppLocation, pp[regex].$ref)
        pp[regex] = ppLocation.schema
      }

      try {
        RegExp(regex)
      } catch (err) {
        throw new Error(`${err.message}. Found at ${regex} matching ${JSON.stringify(pp[regex])}`)
      }

      const valueCode = this.buildValue(ppLocation, 'obj[keys[i]]')
      code += `
        if (/${regex.replace(/\\*\//g, '\\/')}/.test(keys[i])) {
          ${addComma}
          json += serializer.asString(keys[i]) + ':'
          ${valueCode}
          continue
        }
      `
    })
    if (schema.additionalProperties) {
      code += this.additionalProperty(location)
    }

    code += `
        }
    `
    return code
  }

  additionalProperty (location) {
    const ap = location.schema.additionalProperties
    let code = ''
    if (ap === true) {
      code += `
          if (obj[keys[i]] !== undefined && typeof obj[keys[i]] !== 'function' && typeof obj[keys[i]] !== 'symbol') {
            ${addComma}
            json += serializer.asString(keys[i]) + ':' + JSON.stringify(obj[keys[i]])
          }
      `

      return code
    }

    let apLocation = this.mergeLocation(location, 'additionalProperties')
    if (apLocation.schema.$ref) {
      apLocation = this.resolveRef(apLocation, apLocation.schema.$ref)
    }

    const valueCode = this.buildValue(apLocation, 'obj[keys[i]]')

    code += `
      ${addComma}
      json += serializer.asString(keys[i]) + ':'
      ${valueCode}
    `

    return code
  }

  addAdditionalProperties (location) {
    return `
        var properties = ${JSON.stringify(location.schema.properties)} || {}
        var keys = Object.keys(obj)
        for (var i = 0; i < keys.length; i++) {
          if (properties[keys[i]]) continue
          ${this.additionalProperty(location)}
        }
    `
  }

  mergeAllOfSchema (location, schema, mergedSchema) {
    const allOfLocation = this.mergeLocation(location, 'allOf')

    for (let i = 0; i < schema.allOf.length; i++) {
      let allOfSchema = schema.allOf[i]

      if (allOfSchema.$ref) {
        const allOfSchemaLocation = this.mergeLocation(allOfLocation, i)
        allOfSchema = this.resolveRef(allOfSchemaLocation, allOfSchema.$ref).schema
      }

      let allOfSchemaType = allOfSchema.type
      if (allOfSchemaType === undefined) {
        allOfSchemaType = inferTypeByKeyword(allOfSchema)
      }

      if (allOfSchemaType !== undefined) {
        if (
          mergedSchema.type !== undefined &&
          mergedSchema.type !== allOfSchemaType
        ) {
          throw new Error('allOf schemas have different type values')
        }
        mergedSchema.type = allOfSchemaType
      }

      if (allOfSchema.format !== undefined) {
        if (
          mergedSchema.format !== undefined &&
          mergedSchema.format !== allOfSchema.format
        ) {
          throw new Error('allOf schemas have different format values')
        }
        mergedSchema.format = allOfSchema.format
      }

      if (allOfSchema.nullable !== undefined) {
        if (
          mergedSchema.nullable !== undefined &&
          mergedSchema.nullable !== allOfSchema.nullable
        ) {
          throw new Error('allOf schemas have different nullable values')
        }
        mergedSchema.nullable = allOfSchema.nullable
      }

      if (allOfSchema.properties !== undefined) {
        if (mergedSchema.properties === undefined) {
          mergedSchema.properties = {}
        }
        Object.assign(mergedSchema.properties, allOfSchema.properties)
      }

      if (allOfSchema.additionalProperties !== undefined) {
        if (mergedSchema.additionalProperties === undefined) {
          mergedSchema.additionalProperties = {}
        }
        Object.assign(mergedSchema.additionalProperties, allOfSchema.additionalProperties)
      }

      if (allOfSchema.patternProperties !== undefined) {
        if (mergedSchema.patternProperties === undefined) {
          mergedSchema.patternProperties = {}
        }
        Object.assign(mergedSchema.patternProperties, allOfSchema.patternProperties)
      }

      if (allOfSchema.required !== undefined) {
        if (mergedSchema.required === undefined) {
          mergedSchema.required = []
        }
        mergedSchema.required.push(...allOfSchema.required)
      }

      if (allOfSchema.oneOf !== undefined) {
        if (mergedSchema.oneOf === undefined) {
          mergedSchema.oneOf = []
        }
        mergedSchema.oneOf.push(...allOfSchema.oneOf)
      }

      if (allOfSchema.anyOf !== undefined) {
        if (mergedSchema.anyOf === undefined) {
          mergedSchema.anyOf = []
        }
        mergedSchema.anyOf.push(...allOfSchema.anyOf)
      }

      if (allOfSchema.allOf !== undefined) {
        this.mergeAllOfSchema(location, allOfSchema, mergedSchema)
      }
    }
    delete mergedSchema.allOf

    mergedSchema.$id = `merged_${randomUUID()}`
    this.validator.addSchema(mergedSchema)
    this.refResolver.addSchema(mergedSchema)
    location.schemaId = mergedSchema.$id
    location.jsonPointer = '#'
  }

  buildCode (location) {
    if (location.schema.$ref) {
      location = this.resolveRef(location, location.schema.$ref)
    }

    const schema = location.schema
    const required = schema.required || []

    let code = ''

    const propertiesLocation = this.mergeLocation(location, 'properties')
    Object.keys(schema.properties || {}).forEach((key) => {
      let propertyLocation = this.mergeLocation(propertiesLocation, key)
      if (propertyLocation.$ref) {
        propertyLocation = this.resolveRef(location, propertyLocation.$ref)
      }

      const sanitized = JSON.stringify(key)
      const asString = JSON.stringify(sanitized)

      // Using obj['key'] !== undefined instead of obj.hasOwnProperty(prop) for perf reasons,
      // see https://github.com/mcollina/fast-json-stringify/pull/3 for discussion.

      code += `
        if (obj[${sanitized}] !== undefined) {
          ${addComma}
          json += ${asString} + ':'
        `

      code += this.buildValue(propertyLocation, `obj[${JSON.stringify(key)}]`)

      const defaultValue = propertyLocation.schema.default
      if (defaultValue !== undefined) {
        code += `
        } else {
          ${addComma}
          json += ${asString} + ':' + ${JSON.stringify(JSON.stringify(defaultValue))}
        `
      } else if (required.includes(key)) {
        code += `
        } else {
          throw new Error('${sanitized} is required!')
        `
      }

      code += `
        }
      `
    })

    for (const requiredProperty of required) {
      if (schema.properties && schema.properties[requiredProperty] !== undefined) continue
      code += `if (obj['${requiredProperty}'] === undefined) throw new Error('"${requiredProperty}" is required!')\n`
    }

    return code
  }

  buildInnerObject (location) {
    const schema = location.schema
    let code = this.buildCode(location)
    if (schema.patternProperties) {
      code += this.addPatternProperties(location)
    } else if (schema.additionalProperties && !schema.patternProperties) {
      code += this.addAdditionalProperties(location)
    }
    return code
  }

  addIfThenElse (location) {
    const schema = merge({}, location.schema)
    const thenSchema = schema.then
    const elseSchema = schema.else || { additionalProperties: true }

    delete schema.if
    delete schema.then
    delete schema.else

    const ifLocation = this.mergeLocation(location, 'if')
    const ifSchemaRef = ifLocation.schemaId + ifLocation.jsonPointer

    let code = `
      if (validator.validate("${ifSchemaRef}", obj)) {
    `

    const thenLocation = this.mergeLocation(location, 'then')
    thenLocation.schema = merge(schema, thenSchema)

    if (thenSchema.if && thenSchema.then) {
      code += this.addIfThenElse(thenLocation)
    } else {
      code += this.buildInnerObject(thenLocation)
    }
    code += `
      }
    `

    const elseLocation = this.mergeLocation(location, 'else')
    elseLocation.schema = merge(schema, elseSchema)

    code += `
        else {
      `

    if (elseSchema.if && elseSchema.then) {
      code += this.addIfThenElse(elseLocation)
    } else {
      code += this.buildInnerObject(elseLocation)
    }
    code += `
        }
      `
    return code
  }

  toJSON (variableName) {
    return `(${variableName} && typeof ${variableName}.toJSON === 'function')
      ? ${variableName}.toJSON()
      : ${variableName}
    `
  }

  buildObject (location) {
    const schema = location.schema

    if (this.contextFunctionsNamesBySchema.has(schema)) {
      return this.contextFunctionsNamesBySchema.get(schema)
    }

    const functionName = this.generateFuncName()
    this.contextFunctionsNamesBySchema.set(schema, functionName)

    const schemaId = location.schemaId === this.rootSchemaId ? '' : location.schemaId
    let functionCode = `
      function ${functionName} (input) {
        // ${schemaId + location.jsonPointer}
    `

    functionCode += `
        var obj = ${this.toJSON('input')}
        var json = '{'
        var addComma = false
    `

    if (schema.if && schema.then) {
      functionCode += this.addIfThenElse(location)
    } else {
      functionCode += this.buildInnerObject(location)
    }

    functionCode += `
        json += '}'
        return json
      }
    `

    this.contextFunctions.push(functionCode)
    return functionName
  }

  buildArray (location) {
    const schema = location.schema

    let itemsLocation = this.mergeLocation(location, 'items')
    itemsLocation.schema = itemsLocation.schema || {}

    if (itemsLocation.schema.$ref) {
      itemsLocation = this.resolveRef(itemsLocation, itemsLocation.schema.$ref)
    }

    const itemsSchema = itemsLocation.schema

    if (this.contextFunctionsNamesBySchema.has(schema)) {
      return this.contextFunctionsNamesBySchema.get(schema)
    }

    const functionName = this.generateFuncName()
    this.contextFunctionsNamesBySchema.set(schema, functionName)

    const schemaId = location.schemaId === this.rootSchemaId ? '' : location.schemaId
    let functionCode = `
      function ${functionName} (obj) {
        // ${schemaId + location.jsonPointer}
    `

    functionCode += `
      if (!Array.isArray(obj)) {
        throw new TypeError(\`The value '$\{obj}' does not match schema definition.\`)
      }
      const arrayLength = obj.length
    `

    if (!schema.additionalItems) {
      functionCode += `
        if (arrayLength > ${itemsSchema.length}) {
          throw new Error(\`Item at ${itemsSchema.length} does not match schema definition.\`)
        }
      `
    }

    if (this.largeArrayMechanism !== 'default') {
      functionCode += `if (arrayLength && arrayLength >= ${this.largeArraySize}) return JSON.stringify(obj)\n`
    }

    functionCode += `
      let jsonOutput = ''
    `

    if (Array.isArray(itemsSchema)) {
      for (let i = 0; i < itemsSchema.length; i++) {
        const item = itemsSchema[i]
        const tmpRes = this.buildValue(this.mergeLocation(itemsLocation, i), `obj[${i}]`)
        functionCode += `
          if (${i} < arrayLength) {
            if (${this.buildArrayTypeCondition(item.type, `[${i}]`)}) {
              let json = ''
              ${tmpRes}
              jsonOutput += json
              if (${i} < arrayLength - 1) {
                jsonOutput += ','
              }
            } else {
              throw new Error(\`Item at ${i} does not match schema definition.\`)
            }
          }
          `
      }

      if (schema.additionalItems) {
        functionCode += `
          for (let i = ${itemsSchema.length}; i < arrayLength; i++) {
            let json = JSON.stringify(obj[i])
            jsonOutput += json
            if (i < arrayLength - 1) {
              jsonOutput += ','
            }
          }`
      }
    } else {
      const code = this.buildValue(itemsLocation, 'obj[i]')
      functionCode += `
        for (let i = 0; i < arrayLength; i++) {
          let json = ''
          ${code}
          jsonOutput += json
          if (i < arrayLength - 1) {
            jsonOutput += ','
          }
        }`
    }

    functionCode += `
      return \`[\${jsonOutput}]\`
    }`

    this.contextFunctions.push(functionCode)
    return functionName
  }

  buildArrayTypeCondition (type, accessor) {
    let condition
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
          const conditions = type.map((subType) => {
            return this.buildArrayTypeCondition(subType, accessor)
          })
          condition = `(${conditions.join(' || ')})`
        } else {
          throw new Error(`${type} unsupported`)
        }
    }
    return condition
  }

  generateFuncName () {
    return 'anonymous' + this.genFuncNameCounter++
  }

  buildMultiTypeSerializer (location, input) {
    const schema = location.schema
    const types = schema.type.sort(t1 => t1 === 'null' ? -1 : 1)

    let code = ''

    const locationClone = clone(location)
    types.forEach((type, index) => {
      const statement = index === 0 ? 'if' : 'else if'
      locationClone.schema.type = type
      const nestedResult = this.buildSingleTypeSerializer(locationClone, input)
      switch (type) {
        case 'null':
          code += `
            ${statement} (${input} === null)
              ${nestedResult}
            `
          break
        case 'string': {
          code += `
            ${statement}(
              typeof ${input} === "string" ||
              ${input} === null ||
              ${input} instanceof Date ||
              ${input} instanceof RegExp ||
              (
                typeof ${input} === "object" &&
                typeof ${input}.toString === "function" &&
                ${input}.toString !== Object.prototype.toString &&
                !(${input} instanceof Date)
              )
            )
              ${nestedResult}
          `
          break
        }
        case 'array': {
          code += `
            ${statement}(Array.isArray(${input}))
              ${nestedResult}
          `
          break
        }
        case 'integer': {
          code += `
            ${statement}(Number.isInteger(${input}) || ${input} === null)
              ${nestedResult}
          `
          break
        }
        default: {
          code += `
            ${statement}(typeof ${input} === "${type}" || ${input} === null)
              ${nestedResult}
          `
          break
        }
      }
    })
    code += `
      else throw new Error(\`The value $\{JSON.stringify(${input})} does not match schema definition.\`)
    `

    return code
  }

  buildSingleTypeSerializer (location, input) {
    const schema = location.schema

    switch (schema.type) {
      case 'null':
        return 'json += \'null\''
      case 'string': {
        if (schema.format === 'date-time') {
          return `json += serializer.asDateTime(${input})`
        } else if (schema.format === 'date') {
          return `json += serializer.asDate(${input})`
        } else if (schema.format === 'time') {
          return `json += serializer.asTime(${input})`
        } else {
          return `json += serializer.asString(${input})`
        }
      }
      case 'integer':
        return `json += serializer.asInteger(${input})`
      case 'number':
        return `json += serializer.asNumber(${input})`
      case 'boolean':
        return `json += serializer.asBoolean(${input})`
      case 'object': {
        const funcName = this.buildObject(location)
        return `json += ${funcName}(${input})`
      }
      case 'array': {
        const funcName = this.buildArray(location)
        return `json += ${funcName}(${input})`
      }
      case undefined:
        return `json += JSON.stringify(${input})`
      default:
        throw new Error(`${schema.type} unsupported`)
    }
  }

  buildConstSerializer (location, input) {
    const schema = location.schema
    const type = schema.type

    const hasNullType = Array.isArray(type) && type.includes('null')

    let code = ''

    if (hasNullType) {
      code += `
        if (${input} === null) {
          json += 'null'
        } else {
      `
    }

    code += `json += '${JSON.stringify(schema.const)}'`

    if (hasNullType) {
      code += `
        }
      `
    }

    return code
  }

  buildValue (location, input) {
    let schema = location.schema

    if (typeof schema === 'boolean') {
      return `json += JSON.stringify(${input})`
    }

    if (schema.$ref) {
      location = this.resolveRef(location, schema.$ref)
      schema = location.schema
    }

    if (schema.type === undefined) {
      const inferredType = inferTypeByKeyword(schema)
      if (inferredType) {
        schema.type = inferredType
      }
    }

    if (schema.allOf) {
      const mergedSchema = clone(schema)
      this.mergeAllOfSchema(location, schema, mergedSchema)
      schema = mergedSchema
      location.schema = mergedSchema
    }

    const type = schema.type

    let code = ''

    if (type === undefined && (schema.anyOf || schema.oneOf)) {
      const type = schema.anyOf ? 'anyOf' : 'oneOf'
      const anyOfLocation = this.mergeLocation(location, type)

      for (let index = 0; index < location.schema[type].length; index++) {
        const optionLocation = this.mergeLocation(anyOfLocation, index)
        const schemaRef = optionLocation.schemaId + optionLocation.jsonPointer
        const nestedResult = this.buildValue(optionLocation, input)
        code += `
          ${index === 0 ? 'if' : 'else if'}(validator.validate("${schemaRef}", ${input}))
            ${nestedResult}
        `
      }

      code += `
        else throw new Error(\`The value $\{JSON.stringify(${input})} does not match schema definition.\`)
      `
      return code
    }

    const nullable = schema.nullable === true
    if (nullable) {
      code += `
        if (${input} === null) {
          json += 'null'
        } else {
      `
    }

    if (schema.const !== undefined) {
      code += this.buildConstSerializer(location, input)
    } else if (Array.isArray(type)) {
      code += this.buildMultiTypeSerializer(location, input)
    } else {
      code += this.buildSingleTypeSerializer(location, input)
    }

    if (nullable) {
      code += `
        }
      `
    }

    return code
  }
}

function build (schema, options = {}) {
  const factory = new SerializerFactory(options)

  if (options.debugMode) {
    options.mode = 'debug'
  }

  return factory.build(schema, options.mode)
}

module.exports = build

module.exports.validLargeArrayMechanisms = validLargeArrayMechanisms

module.exports.restore = function ({ code, validator, serializer }) {
  // eslint-disable-next-line
  return (Function.apply(null, ['validator', 'serializer', code])
    .apply(null, [validator, serializer]))
}
