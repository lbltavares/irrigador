const axios = require('axios').default;
const Nedb = require('nedb');

const udb = new Nedb({ autoload: true, filename: 'coletas.db' });

// Delay entre as coletas de dados (em ms)
const DELAY_COLETA = process.env.DELAY_COLETA || 1000 * 60 * 5; // Padrao: a cada 5 minutos

// URL do dispositivo IOT (ESP8266)
const URL_DISPOSITIVO = process.env.URL_IRRIGADOR || process.exit(-1);

// URL da planilha online do Google
const URL_PLANILHA = process.env.URL_PLANILHA;

// Coleta os dados do dispositivo:
async function coletar() {
    try {
        console.log("Coletando dados do irrigador");

        let res = await axios.get(URL_DISPOSITIVO);
        if (!res?.data?.status)
            throw new Error("Erro durante a coleta dos dados do dispositivo");
        let status = res.data.status;

        // Converte a ultima irrigacao para o tempo atual
        if (!status.ultimaIrrigacao) {
            status.ultimaIrrigacao = await getUltimaIrrigacao();
        } else {
            let agora = Date.now();
            status.ultimaIrrigacao = new Date(agora - status.time + status.ultimaIrrigacao);
        }
        status.time = new Date();
        console.log(`Ultima irrigacao: ${status.ultimaIrrigacao}`);

        // Armazena e publica os dados
        console.log(`Armazenando Status: ${JSON.stringify(status)}`);
        udb.insert(res.data);
        if (URL_PLANILHA)
            postPlanilha({ timestamp: new Date(), ...status });

    } catch (ex) {
        console.error(err); F
    }
}


function postPlanilha(dados) {
    console.log("Publicando os dados na planilha online");
    axios.post(URL_PLANILHA, dados)
        .then(res => console.log(`Planilha atualizada (${res.status}): ${JSON.stringify(res.data)}`))
        .catch(err => console.error("Erro ao atualizar planilha: " + err));
}


function getUltimaIrrigacao() {
    return new Promise((resolve, reject) => {
        try {
            udb.find({}).sort({ "status.ultimaIrrigacao": -1 }).limit(1)
                .exec((err, docs) => {
                    if (err || !docs?.length)
                        return resolve(new Date());
                    return resolve(docs[0].status.ultimaIrrigacao);
                });
        } catch (ex) {
            reject(ex);
        }
    });
}

coletar();
setInterval(coletar, DELAY_COLETA);