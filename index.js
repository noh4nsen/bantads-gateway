const httpProxy = require('express-http-proxy');
const express = require('express');
const app = express();
const dotenv = require('dotenv');

dotenv.config();
var logger = require('morgan');
const port = 5000;

app.use(logger('dev'));

function selectProxyHost(req) {
  if (req.path.startsWith('/usuarios')) return process.env.HOST_AUTENTICACAO;
  else if (req.path.startsWith('/clientes'))
    return process.env.HOST_CLIENTE;
  else if (req.path.startsWith('/analises'))
    return process.env.HOST_ANALISE;
  else if (req.path.startsWith('/contas'))
    return process.env.HOST_CONTA;
  else if (req.path.startsWith('/gerentes'))
    return process.env.HOST_GERENTE;
}

app.use((req, res, next) => {
  httpProxy(selectProxyHost(req))(req, res, next);
});

app.listen(port, () => {
  console.log(`API Gateway rodando na porta ${port}`);
});
