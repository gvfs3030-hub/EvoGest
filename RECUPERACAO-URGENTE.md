# GestVolt Android 1.3.1 — recuperação segura do banco local

## Importante
Esta versão altera a inicialização do banco para nunca gerar uma nova chave quando já existe um arquivo de banco local. Ela valida a chave antes de executar migrações e só aceita abrir sem chave quando um teste confirma que o arquivo é um SQLite legível sem criptografia.

## Antes de instalar
- Não desinstale o app antigo.
- Não use “Limpar dados/armazenamento” nas configurações do Android.
- Não apague `evogest.db` nem os arquivos `-wal`/`-shm`.
- Se possível, instale a build de recuperação como atualização do aplicativo existente, mantendo o mesmo identificador Android `com.evogest.app` e assinatura compatível.

## Limitação importante
Se a chave SQLCipher original foi perdida ou substituída e o banco está criptografado, o app não consegue reconstruir essa chave automaticamente. Nesse caso, será necessária a chave original ou um backup exportado anteriormente. Esta versão preserva o arquivo e melhora o diagnóstico; ela não garante recuperar todos os bancos danificados.

## Compilação
Envie todo o conteúdo do projeto para o repositório e execute GitHub Actions → “Build GestVolt Android APK (Recovery 1.3.1)”. Baixe o artefato `gestvolt-android-recovery-apk`.
