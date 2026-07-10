const { translateWithMyMemory } = require('./translators/myMemoryTranslator')

async function translateChatMessage({ text, targetLang, sourceLang = 'auto' }) {
  return translateWithMyMemory({ text, targetLang, sourceLang })
}

module.exports = {
  translateChatMessage,
}
