const express = require('express');
const cors = require('cors');
const asaasSDK = require('asaas-sdk');
const GenericResource = require('asaas-sdk/lib/generic-resource');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const {
  ASAAS_API_KEY,
  ASAAS_ENVIRONMENT = 'sandbox',
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_TABLE = 'asaas_subcontas',
} = process.env;

if (!ASAAS_API_KEY) {
  throw new Error('Defina ASAAS_API_KEY no .env');
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
}

asaasSDK.config({
  apiKey: ASAAS_API_KEY,
  environment:
    ASAAS_ENVIRONMENT.toLowerCase() === 'production'
      ? asaasSDK.PRODUCTION
      : asaasSDK.SANDBOX,
  version: 'v3',
});

class AccountsResource extends GenericResource {
  constructor(configFn) {
    super(configFn);
    this.resource = '/accounts';
  }
}

class PaymentsResource extends GenericResource {
  constructor(configFn) {
    super(configFn);
    this.resource = '/payments';
  }
}

class CustomersResource extends GenericResource {
  constructor(configFn) {
    super(configFn);
    this.resource = '/customers';
  }
}

const asaasPayments = new PaymentsResource(asaasSDK.config);
const asaasCustomers = new CustomersResource(asaasSDK.config);

const asaasAccounts = new AccountsResource(asaasSDK.config);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Health check simples
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'metrix-back',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Cria subconta no Asaas e salva o retorno no Supabase.
app.post('/criar-conta', async (req, res) => {
  const dadosDoCliente = req.body;

  if (!dadosDoCliente?.name || !dadosDoCliente?.email || !dadosDoCliente?.cpfCnpj) {
    return res.status(400).json({
      error: 'Campos obrigatorios: name, email e cpfCnpj.',
    });
  }

  try {
    const asaasResponse = await asaasAccounts.post(dadosDoCliente);
    const subconta = asaasResponse.data;

    const { data: registroSupabase, error: supabaseError } = await supabase
      .from(SUPABASE_TABLE)
      .insert({
        asaas_account_id: subconta.id,
        payload_enviado: dadosDoCliente,
        retorno_asaas: subconta,
      })
      .select()
      .single();

    if (supabaseError) {
      return res.status(500).json({
        error: 'Subconta criada no Asaas, mas falhou ao salvar no Supabase.',
        details: supabaseError.message,
        asaas: subconta,
      });
    }

    return res.status(201).json({
      message: 'Subconta criada e salva com sucesso.',
      asaas: subconta,
      supabase: registroSupabase,
    });
  } catch (error) {
    const asaasError = error?.response?.data;
    return res.status(error?.response?.status || 500).json({
      error: 'Falha ao criar subconta no Asaas.',
      details: asaasError || error.message,
    });
  }
});

// Gera um boleto (cobranca) no Asaas.
app.post('/gerar-boleto', async (req, res) => {
  const { customer, billingType, value, dueDate, description } = req.body;

  // Validacao basica
  if (!customer || !value || !dueDate) {
    return res.status(400).json({
      error: 'Campos obrigatorios: customer (ID do cliente), value e dueDate.',
    });
  }

  try {
    const payload = {
      customer,
      billingType: billingType || 'BOLETO',
      value,
      dueDate,
      description: description || 'Cobranca via MetrixBank',
    };

    const asaasResponse = await asaasPayments.post(payload);
    const cobranca = asaasResponse.data;

    // Opcional: salva a cobranca no Supabase para historico
    await supabase.from('cobrancas').insert({
      asaas_id: cobranca.id,
      cliente_id: customer,
      valor: value,
      status: cobranca.status,
      url_boleto: cobranca.bankSlipUrl,
    });

    return res.status(201).json({
      message: 'Boleto gerado com sucesso!',
      barcode: cobranca.identificationField,
      url: cobranca.bankSlipUrl,
      asaas: cobranca,
    });
  } catch (error) {
    const asaasError = error?.response?.data;
    return res.status(error?.response?.status || 500).json({
      error: 'Falha ao gerar boleto no Asaas.',
      details: asaasError || error.message,
    });
  }
});

// Rota para criar o PAGADOR (Customer)
app.post('/criar-cliente', async (req, res) => {
    try {
      const asaasResponse = await asaasCustomers.post(req.body);
      res.status(201).json(asaasResponse.data);
    } catch (error) {
      // Pega os erros específicos que o Asaas retorna
      const asaasErrors = error?.response?.data?.errors || [];
      console.log('--- ERRO NO ASAAS ---');
      console.log(JSON.stringify(asaasErrors, null, 2));
      
      res.status(error?.response?.status || 500).json({ 
        error: 'Erro na API do Asaas', 
        details: asaasErrors 
      });
    }
});  

const PORT = process.env.PORT || 3001;

// Adicionado '0.0.0.0' para compatibilidade com o Render
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
