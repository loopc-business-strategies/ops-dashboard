/**
 * Thin --require alias for Atlas DNS (Windows SRV / local resolver issues).
 * Prefer require('../utils/configureAtlasDns') in long-lived entrypoints.
 */
require('../utils/configureAtlasDns')
