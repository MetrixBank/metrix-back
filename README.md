# Metrix Back

API Node.js para integracao com Asaas e Supabase.

## Objetivo

Este projeto expoe rotas para:
- criar subconta no Asaas;
- criar cliente (pagador) no Asaas;
- gerar boleto no Asaas;
- salvar dados de retorno no Supabase.

## Requisitos

- Node.js 18+ (recomendado)
- npm
- Conta no Asaas (sandbox ou producao)
- Projeto no Supabase

## Como clonar e configurar

```bash
git clone https://github.com/MetrixBank/metrix-back.git
cd metrix-back
```

```bash
npm init -y
npm install express dotenv cors
npm install asaas-sdk
npm install @supabase/supabase-js
touch .env
```

## Como rodar o projeto

```bash
node index.js
```

Servidor padrao: `http://localhost:3001`

## Variaveis de ambiente (.env)

Use este modelo no arquivo `.env`:

```env
# Asaas
ASAAS_API_KEY=sua_chave_asaas_aqui
ASAAS_ENVIRONMENT=sandbox

# Supabase (Back-end)
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_aqui
SUPABASE_TABLE=asaas_subcontas
```

## Importante sobre seguranca

- Nunca commite chaves reais no repositorio.
- Mantenha `.env` no `.gitignore`.
- Se alguma chave ja foi exposta, gere uma nova no provedor (rotacao de credencial).

## Endpoints principais

- `GET /` - health check simples
- `POST /criar-conta` - cria subconta no Asaas e salva no Supabase
- `POST /criar-cliente` - cria pagador no Asaas
- `POST /gerar-boleto` - gera cobranca tipo boleto no Asaas
