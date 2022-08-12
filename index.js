const httpProxy = require('express-http-proxy');
const express = require('express');
const app = express();
var logger = require('morgan');
const port = 5000;

app.use(logger('dev'));

function selectProxyHost(req) {
  if (req.path.startsWith('/usuarios')) return 'http://host.docker.internal:bantads-autenticacao:5001/usuarios';
  else if (req.path.startsWith('/clientes'))
    return 'http://host.docker.internal:bantads-cliente:5002/clientes';
  else if (req.path.startsWith('/analises'))
    return 'http://host.docker.internal:bantads-cliente:5002/analises';
  else if (req.path.startsWith('/contas'))
    return 'http://host.docker.internal:bantads-conta:5003/contas';
  else if (req.path.startsWith('/gerentes'))
    return 'http://host.docker.internal:bantads-gerente:5004/gerentes';
}

app.use((req, res, next) => {
  httpProxy(selectProxyHost(req))(req, res, next);
});

app.listen(port, () => {
  console.log(`API Gateway rodando na porta ${port}`);
});
