'use strict'

const mergeAllOf = require('json-schema-merge-allof')

const failOnConflictResolver = mergeAllOf.options.resolvers.type
const pickFirstResolver = mergeAllOf.options.resolvers.title

const resolvers = {
  format: failOnConflictResolver,
  nullable: failOnConflictResolver,
  defaultResolver: pickFirstResolver
}

function mergeSchemas (schemas) {
  let mergedSchema = null
  try {
    mergedSchema = mergeAllOf({ allOf: schemas }, { resolvers })
  } catch (error) {
    const failedPath = /^Could not resolve values for path:"(.*)"\./.exec(error.message)
    /* istanbul ignore else */
    if (failedPath) {
      throw new Error(`Failed to merge schemas on "${failedPath[1]}".`)
    } else {
      throw new Error(`Failed to merge schemas: ${error.message}`)
    }
  }

  // This is needed because fjs treats `additionalProperties` as false by default
  // which is not the case for JSON Schema.
  if (mergedSchema.additionalProperties === undefined) {
    for (const schema of schemas) {
      if (schema.additionalProperties === true) {
        mergedSchema.additionalProperties = true
        break
      }
    }
  }

  return mergedSchema
}

module.exports = mergeSchemas
