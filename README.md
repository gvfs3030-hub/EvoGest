# GestVolt — aplicativo financeiro Android offline

**Slogan:** Gestão inteligente. Resultados reais.

Aplicativo Expo/React Native nativo para Android com SQLite/SQLCipher local. Sem backend, sem APIs remotas e sem dependência de internet durante a utilização.

## Gerar o APK pelo GitHub Actions

1. Envie o conteúdo deste projeto para o repositório GitHub, mantendo a pasta `.github/workflows`.
2. Acesse **Actions → Build GestVolt Android APK → Run workflow**.
3. Aguarde a conclusão e baixe o artefato `gestvolt-android-apk`.
4. Extraia o arquivo e instale o APK no dispositivo Android.

O ambiente de build precisa de internet para baixar dependências. O aplicativo instalado mantém as funcionalidades financeiras offline.

## Requisitos locais

- Node.js 22+
- Java 17
- Android SDK 36 para build local

```bash
npm install
npx expo prebuild --platform android
npx expo run:android
```

Como o banco utiliza SQLCipher, valide o armazenamento em um build nativo; não use o Expo Go como validação final da criptografia.

## Principais funcionalidades

- Contas, entradas, despesas, metas, cartões e compras parceladas.
- Fluxo de caixa, categorias, gráficos e relatórios locais.
- Assistente financeiro baseado em regras e cálculos locais.
- Área GestVolt Evolui com dicas e conteúdos educativos embutidos.
- Tema escuro, formulários adaptados ao teclado Android e datas `DD/MM/AAAA`.
- Backup e restauração por arquivo local, sem nuvem.

## Compatibilidade com a versão EvoGest

O nome que aparece na interface e no Android é GestVolt. O identificador interno Android `com.evogest.app`, o arquivo local `evogest.db` e a chave de criptografia com prefixo `evogest` foram mantidos intencionalmente para permitir a atualização da instalação anterior e preservar o acesso aos dados locais. Não altere esse identificador se deseja atualizar a instalação existente. Os backups novos passam a se identificar como GestVolt, mas backups EvoGest anteriores continuam aceitos.

Faça um backup antes de instalar a nova build. A assinatura Android precisa ser compatível com a versão anterior para atualizar o app sem desinstalá-lo.

## Offline e privacidade

- Não existe sincronização entre aparelhos nem integração bancária automática.
- O assistente não é um modelo generativo remoto: responde por regras locais e dados cadastrados.
- Os conteúdos educacionais são embarcados e não são atualizados em tempo real.
- Mantenha backups em local seguro; perder o aparelho ou a chave do banco pode impedir a recuperação sem cópia válida.

## Atualizações da versão 1.3.0

- Nova área analítica com filtros para este mês, últimos 6 meses, últimos 12 meses e ano atual.
- Gráfico de linhas para entradas, saídas e resultado; no filtro mensal, os pontos são diários.
- Gráfico de barras agrupadas para comparar entradas e saídas mês a mês.
- Gráficos de rosca para despesas e receitas por categoria.
- Comparação de período atual e anterior para entradas, saídas e resultado, incluindo comparação visual por categoria.
- Ranking das maiores despesas e leituras automáticas dos dados, calculadas localmente.
- Relatórios consultam os registros diretamente no SQLite, independentemente do limite da lista de movimentações; foram adicionados índices para acelerar as consultas.
- Exportação do relatório analítico em CSV, com séries mensais/diárias, categorias, comparações e maiores despesas.
- Tamanho visual do símbolo G reduzido no ícone do app, no ícone adaptativo, na wordmark e na tela de abertura.
- Incremento para versão Android `1.3.0` / `versionCode 4`; biblioteca `react-native-svg` alinhada à versão recomendada pelo Expo SDK 55.

## Atualizações da versão 1.2.0

- Marca renomeada para **GestVolt**, com novo ícone roxo/magenta e slogan **“Gestão inteligente. Resultados reais.”**
- Corrigido o reset do formulário de compra no cartão ao abrir o teclado, estabilizando a lista de categorias.
- Validação da descrição, do valor, da data e do número de parcelas antes de registrar uma compra.
- Formulários de conta, cartão, compra, meta, categoria e movimentação passam a ocupar uma tela rolável, com margem inferior adicional para os botões e adaptação ao teclado.
- Campos monetários começam vazios; `0,00` aparece apenas como placeholder em tom discreto.
- Backup novo identificado como GestVolt; importação permanece compatível com backups antigos EvoGest.
- Incremento de versão Android para `1.2.0` / `versionCode 3`.
