const Storage = require("Storage");
const http = require("http");
const wifi = require("Wifi");

process.on('uncaughtException', e => _ultimoErro = e);

pinMode(A0, "input");
pinMode(D5, "output");
D5.set();

var params = {

    // Se a umidade estiver abaixo deste valor, o irrigador sera acionado:
    LIMITE_UMIDADE: 0.640,

    // Tempo de acionamento de cada dose de irrigacao:
    TEMPO_ACIONAMENTO: 1000 * 2, // segundo(s)

    // Tempo entre cada checagem de irrigacao:
    DELAY_CHECK_IRRIGACAO: 1000 * 60 * 5, // minuto(s)

    // Numero de amostras de umidade:
    AMOSTRAS_UMIDADE: 10,

    // Tempo de coleta de amostras da umidade:
    DELAY_AMOSTRAGEM: 1000 * 6, // segundo(s)

    // Tempo para que o led pisque:
    DELAY_BLINK: 1000 * 1, // segundo(s)

    // Maximo de logs permitidos:
    LIMITE_LOGS: 20,

};


var _logs = [],
    _umidades = [],
    _ultimaIrrigacao,
    _ultimoErro,
    _blinkInterval;


// Registra um log
function log(msg) {
    let logMsg = `[${Date.now().toFixed(3).toString().padStart(15)}ms] LOG - ${msg}`;
    _logs.push(logMsg);
    _logs = _logs.slice(-1 * params.LIMITE_LOGS);
    console.log(logMsg);
}


// Coleta uma amostra de umidade:
function coletarUmidade() {
    let u = getUmidade();
    _umidades.push(u);
    _umidades = _umidades.slice(-1 * params.AMOSTRAS_UMIDADE);
}


// Retorna a umidade lida pelo sensor:
function getUmidade() {
    let u = analogRead(A0);
    return 1 - u;
}


// Retorna a media das amostragens de umidade:
function getUmidadeMedia() {
    let size = _umidades.length;
    if (size == 0) return getUmidade();
    let result = 0;
    for (let u of _umidades)
        result += u;
    return result / size;
}


// Retorna o status geral
function getStatus() {
    let um = getUmidadeMedia();
    return {
        status: {
            time: Date.now(),
            umidade: um,
            umidadeReal: getUmidade(),
            ultimaIrrigacao: _ultimaIrrigacao,
            deveIrrigar: um < params.LIMITE_UMIDADE,
            irrigador: digitalRead(D5),
        },
        params: params,
        system: {
            lastError: _ultimoErro,
            logs: _logs,
            memory: process.memory(),
            storage: {
                free: Storage.getFree(),
                files: Storage.list(),
            }
        },
    };
}


// Irriga o solo
function irrigar() {
    try {
        if (digitalRead(D5) == 0) return;
        log('Irrigando');
        _ultimaIrrigacao = Date.now();
        digitalPulse(D5, 0, params.TEMPO_ACIONAMENTO);
    } catch (ex) {
        log(`irrigar() error: ${ex}`);
    }
}


// Aciona o irrigador caso necessario
function checkIrrigacao() {
    try {
        let u = getUmidade();
        let um = getUmidadeMedia();
        let lim = params.LIMITE_UMIDADE;
        let deveIrrigar = u < params.LIMITE_UMIDADE;
        log(`Umidade (media): ${um.toFixed(3)} | Umidade (real): ${u.toFixed(3)} | Limite: ${lim.toFixed(3)} | Deve Irrigar: ${deveIrrigar}`);
        if (deveIrrigar)
            irrigar();
    } catch (ex) {
        log(`checkIrrigacao() error: ${ex}`);
    }
}


// Servidor
function app(req, res) {
    log(`${req.method} ${req.url}`);
    try {
        let url = req.url.toLowerCase();

        if (url.startsWith('/favicon.ico')) {
            res.writeHead(200);
            return res.end();
        }
        else if (url.startsWith('/umidade')) {
            res.writeHead(200, { "Content-Type": "text/plain" });
            return res.end(getUmidade());
        }
        else if (url.startsWith('/status')) {
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(getStatus()));
        }
        else if (url.startsWith('/setparams')) {
            res.writeHead(200, { "Content-Type": "text/plain" });
            return res.end("Ainda nao implementado :(");
        }
        else if (url.startsWith('/logs')) {
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(_logs));
        }
        throw new Error("Rota nao encontrada");
    } catch (ex) {
        res.writeHead(500);
        return res.end(ex);
    }
}


function onConnect() {
    try {
        log("Conectado.");
        if (_blinkInterval)
            clearInterval(_blinkInterval);
        _blinkInterval = setInterval(() => D2.toggle(), params.DELAY_BLINK);
        http.createServer(app).listen(80);
    } catch (ex) {
        log(`onConnect() error: ${ex}`);
    }
}

wifi.on("connected", onConnect);

function onInit() {
    setTime(0);
    log("Iniciando");

    if (wifi.getStatus().station === "connected")
        onConnect();
    else
        _blinkInterval = setInterval(() => digitalPulse(D2, 0, 50), params.DELAY_BLINK);

    setInterval(coletarUmidade, params.DELAY_AMOSTRAGEM);
    setInterval(checkIrrigacao, params.DELAY_CHECK_IRRIGACAO);
}