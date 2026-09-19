const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Só na web (versão de demonstração): troca módulos nativos por substitutos em web-demo/.
const SUBSTITUTOS_WEB = {
  'expo-secure-store': path.resolve(__dirname, 'web-demo/secure-store.web.js'),
  'expo-crypto': path.resolve(__dirname, 'web-demo/crypto.web.js'),
}
const defaultResolve = config.resolver.resolveRequest

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolver = defaultResolve ?? context.resolveRequest
  if (platform === 'web') {
    // o substituto do expo-crypto reexporta o módulo original por este apelido
    if (moduleName === 'expo-crypto-original') return resolver(context, 'expo-crypto', platform)
    const substituto = SUBSTITUTOS_WEB[moduleName]
    if (substituto && context.originModulePath !== substituto) {
      return { type: 'sourceFile', filePath: substituto }
    }
  }
  return resolver(context, moduleName, platform)
}

module.exports = config
