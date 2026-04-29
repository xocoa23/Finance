# Contexto do Projeto — Finanças Pessoais

Documento para retomar o desenvolvimento em outro PC sem perder contexto.

---

## 1. Visão geral

App mobile de finanças pessoais, **100% offline**, com dados criptografados localmente e desbloqueio por **PIN + biometria** (Face ID / Touch ID / Digital). Construído em **React Native + Expo (managed workflow)**. Alvo: iOS e Android.

**Princípios**
- Nada de servidor: todos os dados ficam no dispositivo.
- PIN com hash SHA-256 + salt aleatório no Keychain (iOS) / Keystore (Android).
- Auto-bloqueio em 5 min em background.
- Backup local exportável em JSON via share sheet (iCloud/Drive/etc.).
- Comparações históricas (mês a mês, ano a ano) — requisito central do projeto.

---

## 2. Stack técnico

| Camada | Escolhas |
|---|---|
| Framework | React Native 0.81.5 + Expo SDK 54 (managed) |
| Linguagem | TypeScript 5.9 (strict) |
| Navegação | `@react-navigation/native` v7 + `bottom-tabs` v7 |
| Estado | Hooks customizados sobre `expo-secure-store` + `AsyncStorage` (fallback) |
| UI | Componentes RN nativos, `@expo/vector-icons` (Ionicons) |
| Gráficos | `react-native-chart-kit` + `react-native-svg` |
| Autenticação | `expo-local-authentication` (biometria) + PIN customizado (`expo-crypto`) |
| Storage seguro | `expo-secure-store` |
| Mídia | `expo-image-picker`, `expo-document-picker`, `expo-file-system`, `expo-sharing` |
| Notificações | `expo-notifications` ⚠️ (ver §4) |
| Build | EAS Build (`eas-cli` global) |

---

## 3. Estrutura de pastas

```
FinancasPessoais/
├── App.tsx                  # Root: AuthProvider, AppState lock, BottomTabs
├── app.json                 # Config Expo (bundle ID com.davi.financaspessoais, plugins, permissões)
├── eas.json                 # Perfis EAS Build (development / preview / production)
├── babel.config.js
├── tsconfig.json            # paths: "@/*" → "src/*"
├── package.json
├── assets/                  # icon, splash, adaptive-icon, favicon
├── scripts/
│   └── generate-icons.js
└── src/
    ├── screens/             # 7 telas + modal
    │   ├── LockScreen.tsx
    │   ├── DashboardScreen.tsx
    │   ├── LancamentosScreen.tsx
    │   ├── FixosScreen.tsx
    │   ├── ParcelasScreen.tsx
    │   ├── MetasScreen.tsx
    │   ├── MaisScreen.tsx
    │   └── HistoricoModal.tsx
    ├── components/          # PinPad, MoneyText, TransactionCard, ProgressBar, FABButton, CategoryDot, Icon
    ├── hooks/               # useAuth, useStorage, useHideValues, useMonthlyIncome
    ├── services/
    │   ├── auth.ts          # PIN (SHA-256 + salt) + biometria
    │   ├── storage.ts       # Wrapper SecureStore + AsyncStorage fallback
    │   └── notifications.ts # Lembretes de gastos fixos via expo-notifications
    ├── utils/
    │   ├── crypto.ts
    │   └── formatters.ts
    └── types/
        └── index.ts         # Tipos + paleta `COLORS` + `SESSION_TIMEOUT_MS`
```

**Telas (Bottom Tabs):** Início (Dashboard) · Lançamentos · Fixos · Parcelas · Metas · Mais

---

## 4. Dependências adicionadas em 28/04/2026

Inicialmente o `package.json` não declarava 3 pacotes que o código já importava. **Foram instaladas via `npx expo install`** (que escolhe versão compatível com SDK 54):

| Pacote | Versão | Onde é usado |
|---|---|---|
| `expo-notifications` | ~0.32.17 | `src/services/notifications.ts` — lembretes de contas fixas |
| `expo-device` | ~8.0.10 | `src/services/notifications.ts` — detecta dispositivo físico |
| `expo-build-properties` | ~1.0.10 | `app.json` plugin — define iOS deployment target 15.1 |

> Se em outra máquina o `npm install` deixar deps faltando, rode:
> `npx expo install expo-notifications expo-device expo-build-properties`

### 4.1. Migração `expo-file-system` para API legacy

SDK 54 reescreveu `expo-file-system` com nova API (`File`, `Directory`, `Paths`). O código original usa a API antiga (`documentDirectory`, `EncodingType`, `writeAsStringAsync`, `copyAsync`, `makeDirectoryAsync`). **Fix aplicado**: trocado o import path em 2 arquivos para usar a API legacy preservada pela Expo:

- `src/screens/LancamentosScreen.tsx`
- `src/screens/MaisScreen.tsx`

```ts
// antes
import * as FileSystem from 'expo-file-system';
// depois
import * as FileSystem from 'expo-file-system/legacy';
```

> A API legacy é estável e suportada, mas eventualmente sairá. Migração para a nova API (ver §9 TODOs) fica como dívida técnica.

---

## 5. Dependências já declaradas

Do `package.json` (todas serão instaladas com `npm install`):

**runtime:**
- `expo` ~54.0.0
- `react` 19.1.0, `react-native` 0.81.5
- `@react-navigation/native` ^7, `@react-navigation/bottom-tabs` ^7
- `@react-native-async-storage/async-storage` 2.2.0
- `@expo/vector-icons` ^14
- `expo-crypto` ~15, `expo-secure-store` ~15, `expo-local-authentication` ~17
- `expo-file-system` ~19, `expo-document-picker` ~14, `expo-image-picker` ~17, `expo-sharing` ~14
- `expo-haptics` ~15, `expo-status-bar` ~3
- `react-native-gesture-handler` ~2.28, `react-native-safe-area-context` ~5.6, `react-native-screens` ~4.16
- `react-native-chart-kit` ^6.12, `react-native-svg` 15.12.1
- `date-fns` ^3.6

**dev:**
- `@babel/core` ^7.25, `babel-preset-expo` ~54
- `typescript` ~5.9, `@types/react` ~19.1

---

## 6. Setup no PC do trabalho (passo-a-passo)

### 6.1. Pré-requisitos

```bash
# Node 20 LTS ou superior
node -v
# Se não tiver: https://nodejs.org/

# Git
git --version

# Expo Go no iPhone/Android (App Store / Play Store) p/ rodar em dispositivo físico
```

### 6.2. Clonar e instalar

```bash
git clone <URL_DO_REPO_PRIVADO>
cd FinancasPessoais
npm install
npx expo install expo-notifications expo-device expo-build-properties
```

### 6.3. Rodar em desenvolvimento

```bash
npx expo start
```

- Pressione **`s`** no terminal para alternar entre Expo Go e Dev Build (use **Expo Go** para começar — é o caminho mais rápido).
- No celular: abra **Expo Go** e escaneie o QR code (iOS) ou cole o link `exp://` (Android).
- Recarregar: pressione **`r`** no terminal.
- Limpar cache: `npx expo start -c`.

### 6.4. Build de produção (opcional, requer conta Expo)

```bash
npm install -g eas-cli
eas login
eas build --platform ios       # gera .ipa (precisa Apple Developer)
eas build --platform android   # gera .apk / .aab
```

Antes do primeiro build, preencha `extra.eas.projectId` em `app.json` (ele será gerado automaticamente por `eas init`).

---

## 7. Configurações específicas do app

### `app.json` — pontos-chave
- `bundleIdentifier` (iOS) / `package` (Android): **`com.davi.financaspessoais`**
- `userInterfaceStyle`: `"dark"` (tema escuro forçado)
- iOS: `NSFaceIDUsageDescription`, `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`
- Android: permissões `USE_BIOMETRIC`, `CAMERA`, `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM` etc.
- iOS deployment target: 15.1

### Auto-lock (em `App.tsx`)
- Ouvinte `AppState`: ao voltar para `active`, se elapsed em background ≥ `SESSION_TIMEOUT_MS` (5 min), troca para `locked`.
- Estados de auth: `loading` → `setup` (primeira abertura, sem PIN) | `locked` | `unlocked`.

### Storage
- Configurações sensíveis (PIN hash, settings) → `expo-secure-store`.
- Dados de transações (volumosos) → `AsyncStorage` (fallback).

---

## 8. O que fizemos nesta sessão (28/04/2026)

1. **Diagnosticado erro `ENOSPC`** durante `npm install`: disco C: estava com apenas ~1 GB livre.
2. **Limpeza de espaço em C:**
   - `npm cache clean --force` (liberou ~1 GB do cache em `C:\Users\DAVI\AppData\Local\npm-cache`)
   - Removidos `node_modules/` parcial e `package-lock.json` corrompido em D:
3. **Reinstalação bem-sucedida**: `npm install --no-audit --no-fund` → 662 pacotes em 3 min.
4. **Identificadas 3 deps faltando** no `package.json` (ver §4).
5. **Criado `.gitignore`, este `CONTEXTO.md`, e repositório privado no GitHub.**

### Estado do disco depois da limpeza
- C:: 1.86 GB livres (depois caiu para ~1.68 GB com node_modules)
- D:: 55.9 GB livres
- E:: 551 GB livres (candidato para realocar `npm-cache` se voltar a faltar espaço — `npm config set cache E:\npm-cache`)

---

## 9. Próximos passos / TODOs

### Alta prioridade
- [ ] Rodar `npx expo install expo-notifications expo-device expo-build-properties` (sem isso o app crasha ao iniciar, ver §4).
- [ ] Conferir telas no Expo Go: testar fluxo `setup PIN` → `unlock` → `dashboard` em pelo menos um device físico.
- [ ] Validar **comparações históricas** (mês vs mês anterior, ano vs ano anterior) — requisito central do projeto, conferir se Dashboard/Histórico mostram corretamente.

### Média prioridade
- [ ] Preencher `extra.eas.projectId` em `app.json` (rodar `eas init`).
- [ ] Confirmar que `expo-notifications` agenda lembretes corretamente em Android (canal `gastos-fixos`) e iOS.
- [ ] Avaliar se o esquema de backup JSON cobre todos os dados (transações, fixos, parcelas, metas, settings).

### Baixa prioridade / dívida técnica
- [ ] **Migrar `expo-file-system` para a nova API** (atualmente usando `/legacy`, ver §4.1). Trocar `documentDirectory` por `Paths.document.uri`, `writeAsStringAsync` por `new File(uri).write(...)`, etc. Refs: https://docs.expo.dev/versions/latest/sdk/filesystem/
- [ ] Atualizar pacotes deprecados detectados pelo npm: `rimraf@3`, `inflight@1`, `glob@7` (vêm como deps transitivas — esperar atualização do Expo).
- [ ] Considerar realocar `npm-cache` para E: se faltar espaço em C: novamente: `npm config set cache E:\npm-cache`.
- [ ] Adicionar testes (não há suite hoje).

---

## 10. Comandos úteis (cheatsheet)

```bash
# Iniciar dev server
npx expo start                    # padrão
npx expo start -c                 # limpar cache
npx expo start --tunnel           # acessar via tunnel (rede separada)

# Adicionar pacote compatível com SDK
npx expo install <pacote>

# Diagnóstico Expo
npx expo doctor

# TypeScript
npx tsc --noEmit                  # type check sem emitir arquivos

# Limpar tudo e reinstalar (caso algo quebre)
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

---

## 11. Referências rápidas

- Expo SDK 54 docs: https://docs.expo.dev/
- React Navigation 7: https://reactnavigation.org/docs/getting-started
- expo-secure-store: https://docs.expo.dev/versions/latest/sdk/securestore/
- expo-local-authentication: https://docs.expo.dev/versions/latest/sdk/local-authentication/
- EAS Build: https://docs.expo.dev/build/introduction/
