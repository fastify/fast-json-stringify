'use strict'

const deepEqual = require('fast-deep-equal')

class RefResolver {
  constructor () {
    this.schemas = {}
  }

  addSchema (schema, schemaId) {
    if (schema.$id !== undefined && schema.$id.charAt(0) !== '#') {
      schemaId = schema.$id
    }
    if (this.getSchema(schemaId) === undefined) {
      this.insertSchemaBySchemaId(schema, schemaId)
      this.insertSchemaSubschemas(schema, schemaId)
    }
  }

  getSchema (schemaId, jsonPointer = '#') {
    const schema = this.schemas[schemaId]
    if (schema === undefined) {
      return undefined
    }
    if (schema.anchors[jsonPointer] !== undefined) {
      return schema.anchors[jsonPointer]
    }
    return getDataByJSONPointer(schema.schema, jsonPointer)
  }

  getSchemaDependencies (schemaId, dependencies = {}) {
    const schema = this.schemas[schemaId]

    for (const dependencySchemaId of schema.dependencies) {
      if (dependencies[dependencySchemaId] !== undefined) continue
      dependencies[dependencySchemaId] = this.getSchema(dependencySchemaId)
      this.getSchemaDependencies(dependencySchemaId, dependencies)
    }

    return dependencies
  }

  insertSchemaBySchemaId (schema, schemaId) {
    if (
      this.schemas[schemaId] !== undefined &&
      !deepEqual(schema, this.schemas[schemaId].schema)
    ) {
      throw new Error(`There is already another schema with id ${schemaId}`)
    }
    this.schemas[schemaId] = { schema, anchors: {}, dependencies: [] }
  }

  insertSchemaByAnchor (schema, schemaId, anchor) {
    const { anchors } = this.schemas[schemaId]
    if (
      anchors[anchor] !== undefined &&
      !deepEqual(schema, anchors[anchor])
    ) {
      throw new Error(`There is already another schema with id ${schemaId}#${anchor}`)
    }
    anchors[anchor] = schema
  }

  insertSchemaSubschemas (schema, rootSchemaId) {
    const schemaId = schema.$id
    if (schemaId !== undefined && typeof schemaId === 'string') {
      if (schemaId.charAt(0) === '#') {
        this.insertSchemaByAnchor(schema, rootSchemaId, schemaId)
      } else {
        this.insertSchemaBySchemaId(schema, schemaId)
        rootSchemaId = schemaId
      }
    }

    const ref = schema.$ref
    if (ref !== undefined && typeof ref === 'string') {
      if (ref.charAt(0) !== '#') {
        const dependencySchemaId = ref.split('#')[0]
        this.schemas[rootSchemaId].dependencies.push(dependencySchemaId)
      }
    }

    for (const key in schema) {
      if (typeof schema[key] === 'object' && schema[key] !== null) {
        this.insertSchemaSubschemas(schema[key], rootSchemaId)
      }
    }
  }
}

function getDataByJSONPointer (data, jsonPointer) {
  const parts = jsonPointer.split('/')
  let current = data
  for (const part of parts) {
    if (part === '' || part === '#') continue
    if (typeof current !== 'object' || current === null) {
      return undefined
    }
    current = current[part]
  }
  return current
}

module.exports = RefResolver
