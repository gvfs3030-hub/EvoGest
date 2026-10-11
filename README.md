# EvoGest Native — Android offline

Aplicativo Expo/React Native nativo com SQLite/SQLCipher local. Não usa backend nem APIs remotas. A workflow do GitHub gera um APK Android de release em **Actions → Build EvoGest Android APK → Artifacts**.

## Requisitos

- Node.js 22+
- Java 17
- Android SDK 36 para build local

## Rodar localmente

```bash
npm install
npx expo prebuild --platform android
npx expo run:android
```

Como o app usa SQLCipher, teste no build nativo; não use o Expo Go como validação de armazenamento criptografado.

## Gerar APK pelo GitHub

1. Envie a pasta para um repositório GitHub.
2. Mantenha o branch principal como `main` ou ajuste `.github/workflows/build-android-apk.yml`.
3. A workflow executa no push para `main` ou manualmente em **Actions → Build EvoGest Android APK → Run workflow**.
4. Baixe o artefato `evogest-android-apk` quando o job concluir.

A workflow compila o projeto nativo via Expo Prebuild e Gradle. O build precisa de acesso à internet para baixar dependências; isso não habilita rede no app instalado. `android.permission.INTERNET` e `ACCESS_NETWORK_STATE` são bloqueadas na configuração Android do EvoGest.

## Armazenamento e segurança

- O banco SQLite é configurado para SQLCipher.
- A chave do banco é criada localmente e armazenada pelo `expo-secure-store`.
- O backup JSON é criado no dispositivo e só sai dele se o usuário escolher um destino de compartilhamento.
- Se o armazenamento seguro da chave for perdido, um backup exportado previamente poderá ser necessário. Guarde backups com cuidado.

## Limitações honestas da primeira versão

- O Evo Assistente é um mecanismo local baseado em regras e cálculos, não um LLM generativo.
- Não há integração bancária automática nem sincronização entre aparelhos.
- Compras cadastradas no módulo Cartões são um controle auxiliar e ainda não entram automaticamente nos resultados de despesas; evite lançar a mesma compra também como despesa sem considerar a dupla contagem.
- Não substitui contabilidade oficial, orientação tributária ou consultoria de investimentos.
