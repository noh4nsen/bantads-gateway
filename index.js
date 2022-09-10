const httpProxy = require('express-http-proxy');
const express = require('express');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
// const verifyJWT = require('./functions/verifyJWT');
const helmet = require('helmet');
const http = require('http');
const jwt = require('jsonwebtoken');
const axios = require('axios').default;

var PORT = 5000;
const tokenExpirationMin = 30; // Quantos minutos para o token expirar
const app = express();

dotenv.config({ path: `${process.env.NODE_ENV !== undefined ? '.env.dev' : '.env'}` });

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());
app.use(cors());

// Geração do token de login
const authServiceProxy = httpProxy(process.env.HOST_AUTENTICACAO + process.env.PATH_AUTENTICACAO + '/login', {
  proxyReqBodyDecorator: function (bodyContent) {
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
  proxyReqOptDecorator: function (proxyReqOpts) {
    // Alteração do header
    proxyReqOpts.headers['Content-Type'] = 'application/json';
    proxyReqOpts.method = 'POST';
    return proxyReqOpts;
  },
  userResDecorator: function (proxyRes, proxyResData, _userReq, userRes) {
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

function verifyJWT(req, res, next) {
  const token = req.headers['x-access-token'];
  if (!token) return res.status(401).json({ auth: false, message: 'Token não fornecido.' });
  jwt.verify(token, process.env.SECRET, function (err, decoded) {
    if (err) return res.status(401).json({ auth: false, message: 'Falha ao autenticar o token.' });
    // se tudo estiver ok, salva no request para uso posterior
    req.userId = decoded.id;
    next();
  });
}

// ############################################### ROTAS ###############################################

// ############ Autenticação
app.post(process.env.PATH_AUTENTICACAO + '/login', async (req, res, next) => {
  authServiceProxy(req, res, next);
});

app.get(process.env.PATH_AUTENTICACAO + '/logout', (_req, res) => {
  res.json({ auth: false, token: null });
});

// ############ Autocadastro
app.post(process.env.PATH_CLIENTE, async (req, res, next) => {
  httpProxy(process.env.HOST_ORQUESTRADOR, {
    userResDecorator: function (proxyRes, _proxyResData, _userReq, userRes) {
      if (proxyRes.statusCode == 201) {
        userRes.status(201);
        return { message: 'Cadastro realizado com sucesso. Consulte seu e-mail para próximos passos.' };
      } else {
        userRes.status(proxyRes.statusCode);
        return { message: 'Um erro ocorreu em seu autocadastro. Tente novamente.' };
      }
    },
  })(req, res, next);
});

// ############ Perfil de Admin
// # Criar novo gerente
app.post(process.env.PATH_GERENTE, verifyJWT, async (req, res, next) => {
  const cpfExists = await cpfExistsGerente(req.body);
  if (!cpfExists) {
    httpProxy(process.env.HOST_ORQUESTRADOR, {
      userResDecorator: function (proxyRes, _proxyResData, _userReq, userRes) {
        if (proxyRes.statusCode == 201) {
          userRes.status(201);
          return { message: 'Gerente criado com sucesso.' };
        } else {
          userRes.status(proxyRes.statusCode);
          return { message: 'Um erro ocorreu ao cadastrar gerente.' };
        }
      },
    })(req, res, next);
  } else {
    return res.status(409).json({ message: 'CPF já cadastrado para outro gerente.' });
  }
});

// Observar que rotas mais específicas devem vir primeiro, se não pega a mais fácil
// # Listar gerentes: 1 gerente conta 2 pega Gerente por id de gerente 3 pega Usuario por id de usuario
app.get(`${process.env.PATH_GERENTE}${process.env.PATH_CONTA}`, verifyJWT, async (_req, res) => {
  try {
    const gerentesContaResponse = await axios
      .get(process.env.HOST_CONTA + process.env.PATH_GERENTE + process.env.PATH_CONTA)
      .then((response) => response)
      .catch((e) => e);

    if (gerentesContaResponse?.status == 200) {
      const gerentesConta = gerentesContaResponse?.data ?? [];
      if (gerentesConta.length == 0) {
        return res.status(200).json(gerentesConta);
      } else {
        const gerentes = await getGerentesByIdGerente(gerentesConta);
        return res.status(200).json(gerentes);
      }
    }
  } catch (e) {
    return res.status(400).json({ message: 'Um erro ocorreu ao buscar gerentes.' });
  }
});

// # Buscar gerente por id
app.get(`${process.env.PATH_GERENTE}/:id`, verifyJWT, (req, res, next) => {
  httpProxy(process.env.HOST_GERENTE + `/${req.query.id}`, {
    userResDecorator: function (proxyRes, proxyResData, _userReq, userRes) {
      if (proxyRes.statusCode == 200) {
        var str = Buffer.from(proxyResData).toString('utf-8');
        userRes.status(200);
        return str;
      } else {
        userRes.status(proxyRes.statusCode);
        return { message: 'Um erro ocorreu ao buscar o gerente.' };
      }
    },
  })(req, res, next);
});

// # Alterar gerente pelo id
app.put(`${process.env.PATH_GERENTE}/:id`, verifyJWT, async (req, res, next) => {
  const cpfExists = await cpfExistsGerente(req.body);
  if (!cpfExists) {
    httpProxy(process.env.HOST_GERENTE + `/${req.query.id}`, {
      userResDecorator: function (proxyRes, proxyResData, _userReq, userRes) {
        if (proxyRes.statusCode == 200) {
          var str = Buffer.from(proxyResData).toString('utf-8');
          userRes.status(200);
          return str;
        } else {
          userRes.status(proxyRes.statusCode);
          return { message: 'Um erro ocorreu ao alterar o gerente.' };
        }
      },
    })(req, res, next);
  } else {
    return res.status(409).json({ message: 'CPF já cadastrado para outro gerente.' });
  }
});

// # Deletar o gerente por id
app.delete(`${process.env.PATH_GERENTE}/:id`, verifyJWT, async (req, res, next) => {
  httpProxy(process.env.HOST_GERENTE + `/${req.query.id}`, {
    userResDecorator: function (proxyRes, _proxyResData, _userReq, userRes) {
      if (proxyRes.statusCode == 200) {
        userRes.status(200);
        return { message: 'Gerente excluído com sucesso.' };
      } else {
        userRes.status(proxyRes.statusCode);
        return { message: 'Um erro ocorreu ao alterar o gerente.' };
      }
    },
  })(req, res, next);
});

// ############ Perfil de Gerente
// # Listar pedidos de autocadastro pendentes pelo id de gerente
app.get(`${process.env.PATH_ANALISE}/por-gerente/:idexternogerente`, verifyJWT, (req, res, next) => {
  httpProxy(process.env.HOST_CLIENTE + `/por-gerente/${req.query.idexternogerente}`, {
    userResDecorator: function (proxyRes, proxyResData, _userReq, userRes) {
      if (proxyRes.statusCode == 200) {
        var lista = Buffer.from(proxyResData).toString('utf-8');
        userRes.status(200);
        return lista;
      } else {
        userRes.status(proxyRes.statusCode);
        return { message: 'Um erro ocorreu ao buscar os clientes.' };
      }
    },
  })(req, res, next);
});

// # Buscar Gerente pelo id de Usuario
app.get(`${process.env.PATH_GERENTE}/por-usuario/:idexternousuario`, verifyJWT, (req, res, next) => {
  httpProxy(process.env.HOST_GERENTE + `/por-usuario/${req.query.idexternousuario}`, {
    userResDecorator: function (proxyRes, proxyResData, _userReq, userRes) {
      if (proxyRes.statusCode == 200) {
        var gerente = Buffer.from(proxyResData).toString('utf-8');
        userRes.status(200);
        return gerente;
      } else {
        userRes.status(proxyRes.statusCode);
        return { message: 'Um erro ocorreu ao buscar o gerente.' };
      }
    },
  })(req, res, next);
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

async function getGerentesByIdGerente(gerentesConta) {
  const gerentes = [];
  const promises = gerentesConta.map(async (gerente) => {
    const response = await axios
      .get(`${process.env.HOST_GERENTE}${process.env.PATH_GERENTE}/${gerente.idExternoGerente}`)
      .then((response) => response.data)
      .catch((e) => e);
    gerentes.push({ ...gerente, ...response }); // Retorna objeto mesclado
  });

  await Promise.all(promises);

  const promises2 = gerentes.map(async (gerente) => {
    const response = await axios
      .get(`${process.env.HOST_AUTENTICACAO}${process.env.PATH_AUTENTICACAO}/${gerente.idExternoUsuario}`)
      .then((response) => response.data)
      .catch((e) => e);

    gerente.usuario = response;
  });

  await Promise.all(promises2);

  return gerentes;
}

async function cpfExistsGerente(gerente) {
  let response = await axios
    .get(`${process.env.HOST_GERENTE}${process.env.PATH_GERENTE}/por-cpf/${gerente.cpf.toString()}`)
    .then((response) => response.data)
    .catch(() => null);

  if (!!response && !!gerente.id) {
    return gerente.id != response.id;
  }
  return !!response;
}
