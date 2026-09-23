# ADR-001: Stack e versões das ferramentas

Status: aceito

Data da verificação no registry npm: 2026-09-23.

## Contexto

O enunciado pede Node.js >= 20, TypeScript, Serverless Framework com serverless-offline, Lambdas
atrás de API Gateway REST, Jest, ESLint e Prettier. O projeto será clonado e executado por um
avaliador, então é essencial que `npm ci && npm run dev` funcione sem conta, login ou chave de nenhum
serviço. Várias ferramentas da stack tiveram majors recentes com restrições de peer dependency
cruzadas, o que exige escolher uma combinação compatível e justificar cada versão.

## Decisão

### Versões (todas fixadas sem `^`/`~`, com `package-lock.json` versionado)

| Pacote                 | Versão   | Tipo            |
| ---------------------- | -------- | --------------- |
| serverless             | 3.40.0   | devDependencies |
| serverless-offline     | 13.10.1  | devDependencies |
| serverless-esbuild     | 1.57.2   | devDependencies |
| esbuild                | 0.28.2   | devDependencies |
| typescript             | 5.9.3    | devDependencies |
| @types/node            | 20.19.43 | devDependencies |
| jest                   | 30.5.2   | devDependencies |
| ts-jest                | 29.4.13  | devDependencies |
| @types/jest            | 30.0.0   | devDependencies |
| eslint                 | 10.11.0  | devDependencies |
| @eslint/js             | 10.0.1   | devDependencies |
| typescript-eslint      | 8.70.1   | devDependencies |
| eslint-config-prettier | 10.1.8   | devDependencies |
| prettier               | 3.9.9    | devDependencies |
| @types/aws-lambda      | 8.10.163 | devDependencies |
| zod                    | 4.6.5    | dependencies    |

Nenhuma dependência de runtime na Fase 1. `zod` e `@types/aws-lambda` (exigido por
`docs/regras/testes.md`) entraram na Fase 4, junto com a camada HTTP; `@anthropic-ai/sdk` entra
como `dependencies` na Fase 5, com versão verificada naquele momento.

### Matriz de compatibilidade verificada

| Pacote                             | Restrição relevante                                                    | Satisfeita por                                        |
| ---------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------- |
| serverless-offline 13.10.1         | peer `serverless ^3.2.0`; node >= 18.12                                | serverless 3.40.0                                     |
| serverless-esbuild 1.57.2          | peer `esbuild 0.8–0.28`; `esbuild-node-externals` opcional; node >= 18 | esbuild 0.28.2; externals não usado (bundle completo) |
| typescript-eslint 8.70.1           | peer `typescript >=4.8.4 <6.1.0`; `eslint ^8.57 \|\| ^9 \|\| ^10`      | TS 5.9.3; ESLint 10.11.0                              |
| ts-jest 29.4.13                    | peer `typescript >=4.3 <7`; `jest ^29 \|\| ^30`                        | TS 5.9.3; Jest 30.5.2                                 |
| eslint 10.11.0 / @eslint/js 10.0.1 | node `^20.19.0 \|\| ^22.13.0 \|\| >=24`                                | `engines.node >= 20.19.0`                             |
| jest 30.5.2                        | node `^18.14 \|\| ^20 \|\| ^22 \|\| >=24`                              | idem                                                  |

Consequência: `package.json` declara `"engines": { "node": ">=20.19.0" }` (o piso vem do ESLint 10,
não apenas do enunciado).

### Serverless Framework v3 (3.40.0), não v4

A v4 (latest 4.42.0) exige login/licença no Serverless Dashboard até para comandos locais. Isso
obrigaria o avaliador a criar conta só para rodar `npm run dev`. A v3 é open source, roda offline
sem autenticação e é a linha suportada pelo serverless-offline v13. `frameworkVersion: '3'` trava a
major no `serverless.yml`.

### Runtime `nodejs20.x` (fallback da decisão D18)

D18 preferia `nodejs22.x`. O schema de configuração do serverless@3.40.0
(`lib/plugins/aws/provider.js`, enum `awsLambdaRuntime`) aceita no máximo `nodejs20.x`; `nodejs22.x`
geraria erro/aviso de validação. Aplicamos o fallback previsto em D18: `runtime: nodejs20.x`,
`.nvmrc` = `20`, esbuild `target: node20`, `@types/node` 20.x. Isso cumpre o "Node 20 ou superior"
do enunciado e mantém o tipo do código alinhado com o runtime de produção.

### serverless-offline v13 (13.10.1)

Última linha compatível com Serverless v3 (a v14 exige v4). Configurado com
`noPrependStageInUrl: true` para as URLs locais baterem com o enunciado (`/agendas`, sem `/dev`).
O modo padrão de execução (worker threads) isola cada handler, o que reforça a decisão D15 (uma
função `schedule` para os dois endpoints que compartilham estado).

### serverless-esbuild + esbuild

Transpila e empacota TypeScript sem passo de `tsc` separado no build, um bundle por função
(`package.individually: true`), o que também reproduz localmente o isolamento de memória entre
funções da AWS. Configuração:

- `bundle: true`, `exclude: []`: tudo empacotado; o projeto não usa `aws-sdk`, então nada a excluir
  (o default `['aws-sdk']` seria enganoso); não precisa de `node_modules` no pacote.
- `minify: false`: bundles pequenos de qualquer jeito; stack traces e logs legíveis valem mais.
- `sourcemap: true` + `NODE_OPTIONS=--enable-source-maps`: stack traces apontam para o `.ts`.
- `target: node20`, `platform: node`, `format: cjs`: casa com o runtime e evita as armadilhas de
  ESM em Lambda (extensão `.mjs`, `"type": "module"`, interop).
- `keepNames: true`: preserva `name` de classes/funções; barato e útil em logs.
- Decorators padrão TS 5 (sem `experimentalDecorators`) são rebaixados pelo esbuild (suporte a
  decorators TC39 desde 0.21), então funcionam no Node 20 sem flag.
- O esbuild não checa tipos: a verificação fica com `npm run typecheck` (`tsc --noEmit`) no `check`.

### TypeScript 5.9.3, não 7.x

O TS 7.0.2 (port nativo) é o latest, mas typescript-eslint 8.70.1 exige `<6.1.0` e ts-jest 29.4.13
exige `<7`. 5.9.3 é a última versão que satisfaz ambos e já suporta decorators padrão.

### Jest 30 + ts-jest

ts-jest usa o compilador TypeScript (mesmo `tsconfig`, inclusive decorators TC39), sem Babel. Com
`isolatedModules: true` (exigido pela semântica do esbuild) o ts-jest apenas **transpila**; a
checagem de tipos dos testes vem do `npm run typecheck`, cujo `tsc --noEmit` inclui `tests/**` e
`src/**/*.spec.ts`. Resultado: testes rápidos sem abrir mão da checagem no `check`. Projetos `unit` / `integration` / `e2e` num único `jest.config`. Jest 30 é suportado pelo
peer do ts-jest 29.4.

### ESLint 10 flat config

ESLint 10 só aceita flat config. `typescript-eslint` (pacote unificado) com `strictTypeChecked`
e `eslint-config-prettier` por último para desligar regras de estilo conflitantes.

### Configs de ferramentas em `.mjs`

`ts-node` não está na stack. `jest.config.ts` exigiria ts-node e `eslint.config.ts` exigiria `jiti`.
Por isso `jest.config.mjs` e `eslint.config.mjs`, com `// @ts-check` e anotações JSDoc
(`@type {import('jest').Config}`) para manter checagem de tipos no editor. O `package.json` não
define `"type": "module"` (código e bundles em CJS); a extensão `.mjs` basta para as configs.

## Alternativas consideradas

- **Serverless v4**: suporte a `nodejs22.x`, mas exige login/licença: descartada pelo atrito para o avaliador.
- **`nodejs22.x` com Serverless v3 ignorando o aviso de validação** (`configValidationMode: warn`):
  funcionaria no deploy, mas deixa a config fora do schema e esconde erros reais de validação.
  Descartada; preferimos `configValidationMode: error` com um runtime válido.
- **AWS SAM / SST / CDK**: aceitariam `nodejs22.x`, mas o enunciado pede Serverless Framework.
- **TypeScript 7**: incompatível com typescript-eslint e ts-jest atuais.
- **Vitest**: mais rápido, mas o enunciado pede Jest.
- **`@swc/jest` / `esbuild-jest`**: tão rápidos quanto o ts-jest em modo `isolatedModules`, mas
  tratam decorators com configuração própria; ts-jest usa o próprio `tsc` para transpilar e evita
  divergência de semântica.
- **Faixas `^`**: descartadas; com peers tão acoplados, versões exatas + lockfile garantem que o
  avaliador instale exatamente o que foi testado.

## Consequências

- **Node 20 está em fim de vida desde abril/2026** e o runtime `nodejs20.x` da AWS está em processo
  de depreciação. Antes de qualquer deploy, verifique o status atual do runtime na documentação da
  AWS (pode haver bloqueio de criação/atualização de funções). Caminho de evolução: migrar para
  Serverless v4 (ou SAM/CDK) e `nodejs22.x`; o código não depende de nada específico do Node 20.
- Serverless v3 não recebe mais evolução do fornecedor; é uma escolha consciente para
  executabilidade local sem conta. Qualquer atualização futura começa pela ferramenta de deploy.
- O serverless-offline executa com o Node do host (ex.: Node 24 na máquina de desenvolvimento).
  O comportamento local pode divergir marginalmente do runtime 20.x; `.nvmrc` 20 existe para quem
  quiser reproduzir o runtime exato.
- `engines.node >= 20.19.0` (exigência do ESLint 10) é mais restrito que "Node 20" do enunciado.
- Build (esbuild) não checa tipos; a garantia de tipos depende de `npm run check` antes de commit.
- `memorySize: 256` (padrão seria 1024 MB): as funções são CPU/IO leves; menor custo por invocação.
- `NODE_OPTIONS=--enable-source-maps`: stack traces legíveis nos logs em troca de um custo de
  desempenho ao **gerar** stack traces (só em erros); aceito.
- `npm audit` aponta vulnerabilidades (algumas críticas) em dependências transitivas do Serverless v3
  (`aws-sdk` v2, `tar`, `decompress`, `adm-zip`, `uuid`). São **apenas devDependencies** do CLI de
  deploy e não entram no bundle da Lambda (esbuild empacota só o que o código importa). Aceito como
  custo da escolha do v3.
- O npm 11 não executa scripts de instalação sem aprovação (`allowScripts`). Nada da stack depende
  deles: o binário do esbuild vem do pacote opcional da plataforma (verificado: `esbuild --version`
  e rebaixamento de decorator TC39 para `node20` funcionando).
- Jest falha quando um caminho de `coverageThreshold` não tem arquivos. Enquanto `src/domain` e
  `src/application` não existirem (Fase 1), o `check` roda `npm test` sem cobertura; a Fase 2 troca
  para `npm run test:coverage`, passando a exigir os 90%.
- Sem funções declaradas, o serverless-offline inicia mas não abre a porta HTTP; a validação da
  config foi feita com `serverless print` (`configValidationMode: error`, exit 0).
