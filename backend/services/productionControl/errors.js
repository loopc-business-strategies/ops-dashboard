/**
 * Shared production-control error (kept separate to avoid circular requires).
 */
class ProductionError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
    this.name = 'ProductionError'
  }
}

module.exports = { ProductionError }
