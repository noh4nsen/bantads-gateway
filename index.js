const httpProxy = require('express-http-proxy');
const express = require('express');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
// const verifyJWT = require('./functions/verifyJWT');
const helmet = require('helmet');
const http = require('http');

var PORT = 5000;
const tokenExpirationMin = 5; // Quantos minutos para o token expirar
const app = express();

dotenv.config({ path: `${process.env.NODE_ENV !== undefined ? '.env.dev' : '.env'}` });

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());
app.use(cors());

// Geração do token de login
const authServiceProxy = httpProxy(process.env.HOST_AUTENTICACAO + '/login', {
  proxyReqBodyDecorator: function (bodyContent, srcReq) {
    // Pegar informações do body
    try {
      retBody = {};
      retBody.email = bodyContent.email;
      retBody.senha = bodyContent.senha;
      bodyContent = retBody;
    } catch (e) {
      console.log(' - ERRO: ' + e);
    }
    return bodyContent;
  },
  proxyReqOptDecorator: function (proxyReqOpts, srcReq) {
    // Alteração do header
    proxyReqOpts.headers['Content-Type'] = 'application/json';
    proxyReqOpts.method = 'POST';
    return proxyReqOpts;
  },
  userResDecorator: function (proxyRes, proxyResData, userReq, userRes) {
    // Processamento do token
    if (proxyRes.statusCode == 200) {
      var str = Buffer.from(proxyResData).toString('utf-8');
      var objBody = JSON.parse(str);
      const id = objBody.id;
      const token = jwt.sign({ id }, process.env.SECRET, {
        expiresIn: tokenExpirationMin * 60,
      });
      userRes.status(200);
      return { auth: true, token: token, usuario: objBody };
    } else userRes.status(401);
    return { message: 'Login inválido!' };
  },
});

function selectProxyHost(req) {
  if (req.path.startsWith(process.env.PATH_AUTENTICACAO)) return httpProxy(process.env.HOST_AUTENTICACAO);
  else if (req.path.startsWith(process.env.PATH_CLIENTE)) return httpProxy(process.env.HOST_CLIENTE);
  else if (req.path.startsWith(process.env.PATH_ANALISE)) return httpProxy(process.env.HOST_ANALISE);
  else if (req.path.startsWith(process.env.PATH_CONTA)) return httpProxy(process.env.HOST_CONTA);
  else if (req.path.startsWith(process.env.PATH_GERENTE)) return httpProxy(process.env.HOST_GERENTE);
}

// ############################################### ROTAS ###############################################

// ############ Autenticação
app.post(process.env.PATH_AUTENTICACAO + '/login', (req, res, next) => {
  authServiceProxy(req, res, next);
});

app.get(process.env.PATH_AUTENTICACAO + '/logout', (req, res) => {
  res.json({ auth: false, token: null });
});

// #####################################################################################################

// Configurações do app
app.use(logger('dev'));
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Cria o servidor na porta
var server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`API Gateway rodando na porta ${PORT}`);
});
