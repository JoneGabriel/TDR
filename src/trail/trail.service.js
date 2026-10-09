const { WhiteList } = require("../cloacker/cloacker.schema");
const {
    request,
    isEmpty
} = require("../helpers/helpers.global");
    
const statusHandler = require("../helpers/helpers.statusHandler");

const {
    save,
    findOne,
    findAll,
    updateById
} = require("../query");
const crypto = require("crypto");
const geoip = require("geoip-lite");
const { deviceOf, allowedDevices } = require("../helpers/helpers.devices");

// Chave do ipwhois.pro em IPWHOIS_KEY. A chave antiga ficou no código (e no histórico do git): troque-a no ipwhois e
// defina a nova no .env; o fallback existe só para não derrubar o filtro de visitantes antes disso.
const LEGACY_IPWHOIS_KEY = "m913msTC0Ib1BXF0";
const ipwhoisKey = ()=> process.env.IPWHOIS_KEY || LEGACY_IPWHOIS_KEY;

!process.env.IPWHOIS_KEY && console.warn('\x1b[33m%s\x1b[0m', "IPWHOIS_KEY não definido no .env: usando a chave antiga do código (troque-a no ipwhois.pro e configure a variável)");
const { isbot } = require("isbot");

const VISITOR_COOKIE = "tdr_vid";
const SESSION_WINDOW_MS = 30 * 60 * 1000;        // 30 min sem atividade = nova sessão
const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000;     // datas gravadas em horário de Brasília (convenção do projeto)

const nowBrazil = ()=> new Date(Date.now() - BRAZIL_OFFSET_MS);

// Identidade do visitante: cookie first-party de 1 ano, criado aqui quando não existe.
// HttpOnly: o JS da vitrine não precisa dele, o navegador envia sozinho em fetch same-origin.
const getVisitorId = (req, res)=>{
    let visitor = req.cookies?.[VISITOR_COOKIE];

    if(!visitor || !/^[a-f0-9]{32}$/.test(visitor)){
        visitor = crypto.randomBytes(16).toString("hex");

        res && res.cookie(VISITOR_COOKIE, visitor, {
            httpOnly:true,
            sameSite:"lax",
            secure:req.secure,
            path:"/",
            maxAge:365 * 24 * 60 * 60 * 1000
        });
    }

    return visitor;
};

// Sessão ativa do visitante neste domínio (última atividade dentro da janela)
const findActiveSession = async(visitor, domain)=>{
    try{

        if(!visitor || !domain){
            return null;
        }

        return await findOne(Trail, {
            visitor,
            domain,
            lastSeenAt:{$gte:new Date(nowBrazil().getTime() - SESSION_WINDOW_MS)}
        });

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// Renova a sessão; com `path` conta uma pageview e guarda o caminho (últimos 20)
const touchSession = async(session, path = null, extra = {})=>{
    try{

        let update = {lastSeenAt:nowBrazil(), ...extra};

        if(path){
            update.last_path = path;
            update.$inc = {pageviews:1};
            update.$push = {pages:{$each:[path], $slice:-20}};
        }

        await updateById(Trail, session._id, update);

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const {
    Trail
} = require("./trail.schema");

const getInfosAboutIp = async(ip)=>{
    try{

        const url = `https://ipwhois.pro/${encodeURIComponent(ip)}?key=${encodeURIComponent(ipwhoisKey())}&security=1`
        const response = await request("GET", url);

        if(response.success){

            return {
                country: response.country,
                city: response.city,
                region: response.region,
                country_code: response.country_code,
                org: response.connection?.org,
                proxy:response.security?.proxy,
                vpn:response.security?.vpn,
                hosting:response.security?.hosting,
            }
        }

        return null;

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const checkSession = async(ip)=>{
    try{

        const offsetMs = 3 * 60 * 60 * 1000; 
        const nowBrazil = Date.now() - offsetMs;
        const twoMinutesAgoBrazil = new Date(nowBrazil - 2 * 60 * 1000);

        const exist = await findOne(Trail, {
            ip,
            createdAt: { $gt: twoMinutesAgoBrazil }
        })

        return exist;

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const getCountry = async(ip)=>{
    try{    

        // ipwhois sem resposta (IP reservado, serviço fora): tenta a base local; sem país, o chamador usa o padrão
        const location = await getInfosAboutIp(ip);

        return location?.country_code || geoip.lookup(ip)?.country || null;
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// Registra a visita e decide o filtro do cloaker. Devolve true = visitante liberado (layout first).
// Chamada: saveSession(req, res, config) — usa config.country (países atendidos), config.devices (dispositivos
// atendidos) e config.account (lista branca da conta). `res` é usado para gravar o cookie do visitante.
// Formas antigas ainda aceitas: saveSession(req, res, country, account) e saveSession(req, country).
const saveSession = async(req, res, country = [], account = null)=>{
    try{

        let devices = null;

        // compatibilidade com a assinatura antiga saveSession(req, country)
        if(Array.isArray(res)){
            country = res;
            res = null;
        }

        // forma nova: o próprio config da loja no lugar da lista de países
        if(country && !Array.isArray(country) && typeof country == "object"){
            const config = country;

            country = config.country || [];
            account = config.account || null;
            devices = config.devices;
        }

        const allowed = allowedDevices(devices);

        const ip = req.ip || req.connection?.remoteAddress;
        // lista branca da conta dona da loja (loja antiga sem conta: qualquer lista)
        let whiteQuery = {$or:[{ip:req.ip}, {ip:req.connection?.remoteAddress}]};

        account && (whiteQuery.account = account);

        const whiteList = await findAll(WhiteList, whiteQuery);

        // IPs da white list (equipe) passam direto e não entram nas métricas
        if(whiteList.length){
            return true;
        }

        const isDev = process.env.ENV == "DEV";
        const visitor = getVisitorId(req, res);
        const domain = req.headers.host;
        const path = (req.originalUrl || "/").split("?")[0];

        // sessão em andamento: só conta a pageview e mantém a decisão já tomada
        // (mesmo layout durante toda a sessão e nenhuma consulta de IP repetida)
        const current = await findActiveSession(visitor, domain);

        if(current){
            await touchSession(current, path);
            req.visitorCountry = current.country_code;

            return isDev || current.page == "black";
        }

        const now = nowBrazil();

        let object = {
            visitor,
            domain,
            ip,
            isMobile:req.useragent?.isMobile,
            device:deviceOf(req.useragent),
            browser:req.useragent?.browser,
            os:req.useragent?.os,
            cookies:req.headers.cookie,
            language:req.headers['accept-language'],
            last_page:req.headers['referer'],
            entry_page:path,
            last_path:path,
            pages:[path],
            pageviews:1,
            createdAt:now,
            startedAt:now,
            lastSeenAt:now,
            is_bot:isbot(req.headers['user-agent'] || "")
        };

        if(isDev){
            // em DEV todo visitante é liberado e não há consulta de IP; a sessão é gravada para o painel
            object.page = "black";
        }else{
            const location = await getInfosAboutIp(object["ip"]);

            if(!isEmpty(location)){
                object = {
                    ...object,
                    ...location,
                    geo_source:"ipwhois"
                };
            }else{
                // ipwhois indisponível: geoip-lite (base local) preenche país/cidade só para as métricas
                const geo = geoip.lookup(object["ip"]);

                if(geo){
                    object = {
                        ...object,
                        country:geo.country,
                        country_code:geo.country,
                        region:geo.region,
                        city:geo.city,
                        geo_source:"geoip-lite"
                    };
                }
            }

            // decisão do cloaker: só confia no ipwhois (sem ele o visitante continua filtrado, como antes)
            const known = isEmpty(location) ? {} : location;
            const regex = /google\s*l+\.?l+\.?c+/i;

            const conditionCountry = !(country.find(val=> val == known["country_code"]));
            // dispositivo fora da lista da loja (padrão: desktop filtrado), como acontece com o país
            const conditionDevice = !allowed.includes(object.device);
            const conditionSecurity = known.proxy || known.vpn || known.hosting || regex.test(known.org);

            object.page = (conditionCountry || conditionDevice || conditionSecurity) ? "white" : "black";
        }

        object.layout = object.page == "black" ? "first" : "second";
        req.visitorCountry = object.country_code;

        await save(Trail, object);

        return object.page == "black";

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

module.exports = {
    saveSession,
    getCountry,
    getVisitorId,
    findActiveSession,
    touchSession,
    nowBrazil,
    VISITOR_COOKIE,
    SESSION_WINDOW_MS
};