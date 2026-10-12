# GestVolt Mobile 1.3.3 — correção de recuperação da chave SQLCipher

## Correção principal

A versão 1.3.1 salvava a chave do banco usando `keychainService`, mas a consultava sem essa mesma opção. No Expo SecureStore, o mesmo `keychainService` deve ser informado ao salvar, ler e excluir o item. Isso pode fazer uma chave já salva parecer ausente na próxima abertura.

Esta versão corrige `getItemAsync` e `deleteItemAsync` para usar `keychainService: DB_KEY_NAME`. Ao criar um banco novo, também faz uma leitura de verificação da chave antes de criar o banco criptografado.

## Importante

- O nome do banco existente (`evogest.db`), a chave armazenada (`evogest.sqlite.encryption-key.v1`) e o package Android (`com.evogest.app`) e versionCode Android incrementado para 7 foram preservados para permitir que o app consulte os dados anteriores.
- Não desinstale o app nem limpe os dados antes de testar esta correção.
- Instale como atualização apenas se a assinatura do APK for compatível com a versão que está no aparelho. Se o Android indicar assinatura incompatível, não desinstale a versão existente.
- A correção deve permitir que o app encontre a chave já salva. Não é possível garantir a recuperação se a chave foi efetivamente perdida ou se o banco está corrompido.
- A versão foi verificada estaticamente; a compilação Android precisa ser confirmada no GitHub Actions.

## Gerar APK

Envie todo o conteúdo do projeto para o repositório (incluindo `.github/workflows/build-android-apk.yml`) e abra GitHub Actions → `Build GestVolt Android APK (Key Fix 1.3.3)`. Execute `Run workflow` e baixe o artefato `gestvolt-android-keyfix-apk`.
