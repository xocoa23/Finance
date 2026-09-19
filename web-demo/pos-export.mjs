/**
 * Pós-processamento da exportação web (rode depois de `npx expo export --platform web --output-dir dist-web`).
 *
 * O Expo coloca as fontes em `assets/node_modules/...`, e a Vercel ignora pastas
 * chamadas `node_modules` no upload — os ícones sumiriam. Aqui a pasta vira
 * `assets/nm`, as referências no bundle são atualizadas e só a fonte usada
 * pelo app (Ionicons) é mantida.
 *
 * Uso: node web-demo/pos-export.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const saida = path.resolve('dist-web')
const antigo = path.join(saida, 'assets/node_modules')
const novo = path.join(saida, 'assets/nm')

if (fs.existsSync(antigo)) fs.renameSync(antigo, novo)

const pastaJs = path.join(saida, '_expo/static/js/web')
for (const arquivo of fs.readdirSync(pastaJs)) {
  const caminho = path.join(pastaJs, arquivo)
  const conteudo = fs.readFileSync(caminho, 'utf8')
  fs.writeFileSync(caminho, conteudo.replaceAll('/assets/node_modules/', '/assets/nm/'))
}

const fontes = path.join(novo, '@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts')
for (const fonte of fs.readdirSync(fontes)) {
  if (!fonte.startsWith('Ionicons')) fs.rmSync(path.join(fontes, fonte))
}

fs.rmSync(path.join(saida, 'metadata.json'), { force: true })
console.log('dist-web pronto para copiar para o portfólio (public/demos/finance)')
