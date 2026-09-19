const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Só na web: troca o expo-secure-store (que não existe no navegador) pelo substituto da demo.
const secureStoreWeb = path.resolve(__dirname, 'web-demo/secure-store.web.js')
const defaultResolve = config.resolver.resolveRequest

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'expo-secure-store') {
    return { type: 'sourceFile', filePath: secureStoreWeb }
  }
  return (defaultResolve ?? context.resolveRequest)(context, moduleName, platform)
}

module.exports = config
