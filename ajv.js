'use strict'

const Ajv = require('ajv')
const fastUri = require('fast-uri')
const ajvFormats = require('ajv-formats')

module.exports = buildAjv

function buildAjv (options) {
  const ajvInstance = new Ajv({ ...options, strictSchema: false, validateSchema: false, uriResolver: fastUri })
  ajvFormats(ajvInstance)

  const validateDateTimeFormat = ajvFormats.get('date-time').validate
  const validateDateFormat = ajvFormats.get('date').validate
  const validateTimeFormat = ajvFormats.get('time').validate

  ajvInstance.addKeyword({
    keyword: 'fjs_date_type',
    validate: (schema, date) => {
      if (date instanceof Date) {
        return true
      }
      if (schema === 'date-time') {
        return validateDateTimeFormat(date)
      }
      if (schema === 'date') {
        return validateDateFormat(date)
      }
      if (schema === 'time') {
        return validateTimeFormat(date)
      }
      return false
    }
  })

  return ajvInstance
}
