const Joi = require('joi')

const buildError = (error) => {
  const details = error.details.map((d) => d.message).join(', ')
  return details || 'Invalid request payload.'
}

const validateBody = (schema, options = {}) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
    ...options,
  })

  if (error) {
    return res.status(400).json({ success: false, message: buildError(error) })
  }

  req.body = value
  return next()
}

const validateBodyStrict = (schema) => validateBody(schema, { stripUnknown: false })

const validateQuery = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
  })

  if (error) {
    return res.status(400).json({ success: false, message: buildError(error) })
  }

  req.query = value
  return next()
}

const validateParams = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.params, {
    abortEarly: false,
    stripUnknown: true,
  })

  if (error) {
    return res.status(400).json({ success: false, message: buildError(error) })
  }

  req.params = value
  return next()
}

module.exports = {
  Joi,
  validateBody,
  validateBodyStrict,
  validateQuery,
  validateParams,
}
