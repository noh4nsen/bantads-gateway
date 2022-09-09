const express = require('express');
const router = express.Router();

router.get(process.env.PATH_CONTA, async (_req, res) => {
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

// router.get('/:id', function (req, res) {
//   userService
//     .getById(req.params.id)
//     .then((result) => res.status(200).send(result))
//     .catch((err) => res.status(500).send(err));
// });

module.exports = router;

async function getGerentesByIdGerente(gerentesConta) {
    const gerentes = [];
    const promises = gerentesConta.map(async (gerente) => {
      const response = await axios
        .get(process.env.HOST_GERENTE + process.env.PATH_GERENTE + `/${gerente.idExternoGerente}`)
        .then((response) => response.data)
        .catch((e) => e);
      gerentes.push({ ...gerente, ...response }); // Retorna objeto mesclado
    });
  
    await Promise.all(promises);
  
    const promises2 = gerentes.map(async (gerente) => {
      const response = await axios
        .get(process.env.HOST_AUTENTICACAO + process.env.PATH_AUTENTICACAO + `/${gerente.idExternoUsuario}`)
        .then((response) => response.data)
        .catch((e) => e);
  
      gerente.usuario = response;
    });
  
    await Promise.all(promises2);
  
    return gerentes;
  }
  