# Finanças Pessoais

App mobile de finanças pessoais — 100% local, criptografado, com biometria.

## Como rodar (primeira vez)

```bash
cd FinancasPessoais
npm install
npx expo start
```

No iPhone: instale o app **Expo Go** na App Store, abra a câmera e escaneie o QR code do terminal.
No Android: idem com o app **Expo Go** da Play Store.

## Build de produção (sem Expo Go)

Requer conta gratuita no Expo (https://expo.dev):

```bash
npm install -g eas-cli
eas login
eas build --platform ios       # gera .ipa
eas build --platform android   # gera .apk / .aab
```

## Estrutura

- `App.tsx` — root, navegação e ciclo de bloqueio
- `src/screens/` — 7 telas + `HistoricoModal`
- `src/services/storage.ts` — wrapper sobre `expo-secure-store` (com fallback `AsyncStorage`)
- `src/services/auth.ts` — PIN (SHA-256 + salt) + biometria
- `src/hooks/` — `useAuth`, `useTransactions`, `useFixedExpenses`, etc.

## Segurança

- PIN: hash SHA-256 com salt aleatório, armazenado no Keychain (iOS) / Keystore (Android)
- Auto-bloqueio: 5 min em background
- Comprovantes: salvos no diretório privado do app
- Backup: JSON local exportável via share sheet (iCloud, Drive, etc.)
- Nenhum dado sai do dispositivo
