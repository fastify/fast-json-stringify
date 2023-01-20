'use strict'

/**
 * Output Time as HH:mm:ss
 *
 * @param {Date} date
 * @returns {string}
 */
module.exports.toTime = function (date) {
  const tzCorrectedDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
  return `${tzCorrectedDate.getUTCHours().toString().padStart(2, '0')}:${(tzCorrectedDate.getUTCMinutes()).toString().padStart(2, '0')}:${(tzCorrectedDate.getUTCSeconds()).toString().padStart(2, '0')}`
}

/**
 * Output Date as YYYY-MM-DD
 *
 * @param {Date} date
 * @returns {string}
 */
module.exports.toISODate = function (date) {
  const tzCorrectedDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
  return `${tzCorrectedDate.getUTCFullYear()}-${(tzCorrectedDate.getUTCMonth() + 1).toString().padStart(2, '0')}-${(tzCorrectedDate.getUTCDate()).toString().padStart(2, '0')}`
}
