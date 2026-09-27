/**
 * Injects release signing into android/app/build.gradle at prebuild time (android/ is generated and gitignored).
 * Reads mg-floor/credentials/keystore.properties; without it, release builds fail unless
 * -PallowDebugReleaseSigning=true (local QA) or the build runs on EAS (which injects its own signing).
 */
const { withAppBuildGradle } = require('expo/config-plugins')

const MARKER = '// @mg-floor/release-signing'

const PROPERTIES_LOADER = `${MARKER}
def keystorePropertiesFile = rootProject.file("../credentials/keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystorePropertiesFile.withInputStream { keystoreProperties.load(it) }
}

`

const RELEASE_SIGNING_CONFIG = `
        release {
            def allowDebugReleaseSigning = (
                project.hasProperty('allowDebugReleaseSigning')
                && project.property('allowDebugReleaseSigning') == 'true'
            ) || System.getenv('EAS_BUILD') == 'true'
            if (!keystorePropertiesFile.exists()) {
                if (allowDebugReleaseSigning) {
                    initWith signingConfigs.debug
                    println 'WARNING: Release build signed with debug keystore (internal QA only — not for Play Store).'
                } else {
                    throw new GradleException(
                        "Release signing requires mg-floor/credentials/keystore.properties. " +
                        "See docs/MG-FLOOR-ANDROID-LOCAL-BUILD.md, " +
                        "or pass -PallowDebugReleaseSigning=true for local QA only."
                    )
                }
            } else {
                storeFile new File(keystorePropertiesFile.parentFile, keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }`

function applyReleaseSigning(contents) {
  if (contents.includes(MARKER)) return contents

  const buildTypesRelease = /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/
  const debugSigningConfig = /(signingConfigs \{\s*debug \{[\s\S]*?\n        \})/
  const androidBlock = /^android \{/m
  if (!buildTypesRelease.test(contents) || !debugSigningConfig.test(contents) || !androidBlock.test(contents)) {
    throw new Error('withReleaseSigning: android/app/build.gradle layout not recognised; update the plugin.')
  }

  return contents
    .replace(buildTypesRelease, '$1signingConfig signingConfigs.release')
    .replace(debugSigningConfig, `$1${RELEASE_SIGNING_CONFIG}`)
    .replace(androidBlock, `${PROPERTIES_LOADER}android {`)
}

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withReleaseSigning: only Groovy build.gradle is supported.')
    }
    cfg.modResults.contents = applyReleaseSigning(cfg.modResults.contents)
    return cfg
  })
}

module.exports = withReleaseSigning
module.exports.applyReleaseSigning = applyReleaseSigning
