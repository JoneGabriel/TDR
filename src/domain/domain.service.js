const statusHandler = require("../helpers/helpers.statusHandler");
const {
    save,
    findOne,
    findAll,
    findById,
    populate,
    updateById,
    removeOne,
} =require("../query");

const {
    Domain
} = require("./domain.schema");

const {
    isEmpty
} = require("../helpers/helpers.global");

const { storeFilter } = require("../account/account.service");
const { isReservedHost } = require("../auth/auth.service");

const dns = require("dns").promises;
const https = require("https");
const tls = require("tls");

// ---------------------------------------------------------------- provisionamento (DNS + SSL)
// O cron `domain.sh sync` da VPS roda a cada SYNC_MINUTES: emite o certificado e cria o bloco do nginx assim que o
// registro A do domínio aponta para esta VPS. Estas funções só observam (DNS e uma chamada HTTPS a /health) para
// mostrar ao usuário em que etapa o domínio está; quem provisiona continua sendo o sync.
const SYNC_MINUTES = 10;
const IP_TTL_MS = 60 * 60 * 1000;
const IP_RETRY_MS = 5 * 60 * 1000;
const PROBE_TIMEOUT_MS = 7000;
const IPV4 = /^\d+\.\d+\.\d+\.\d+$/;
const LOCAL_HOST = /^(localhost|[^.]+\.local|[^.]+\.test|\d+\.\d+\.\d+\.\d+)(:\d+)?$/i;
const SELF_SIGNED = ["DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN"];

let ipCache = {ip:null, at:0};

// IP público desta VPS: PUBLIC_IP do .env ou consulta ao ipify (a mesma fonte do domain.sh); cache de 1 h (5 min se falhar)
const serverIp = async()=>{
    const fixed = String(process.env.PUBLIC_IP || "").trim();

    if(fixed){
        return fixed;
    }

    if(Date.now() - ipCache.at < (ipCache.ip ? IP_TTL_MS : IP_RETRY_MS)){
        return ipCache.ip;
    }

    try{
        const response = await fetch("https://api.ipify.org", {signal:AbortSignal.timeout(5000)});
        const ip = (await response.text()).trim();

        ipCache = {ip:IPV4.test(ip) ? ip : null, at:Date.now()};
    }catch(error){
        ipCache = {ip:null, at:Date.now()};
    }

    return ipCache.ip;
};

// Resolvedores públicos além do do sistema: o resolvedor da VPS (ou do Docker) pode guardar um NXDOMAIN antigo por
// horas depois de o registro A ser criado, e o domínio parece "não resolver" enquanto o resto do mundo já o enxerga
const PUBLIC_RESOLVERS = ["1.1.1.1", "8.8.8.8"];

const resolveWith = async(host, servers = null)=>{
    try{
        if(!servers){
            return await dns.resolve4(host);
        }

        const resolver = new dns.Resolver({timeout:4000, tries:1});

        resolver.setServers(servers);

        return await resolver.resolve4(host);
    }catch(error){
        return [];
    }
};

const resolveHost = async(host)=>{
    const [public_ips, local_ips] = await Promise.all([resolveWith(host, PUBLIC_RESOLVERS), resolveWith(host)]);

    return {ips:[...new Set([...public_ips, ...local_ips])], public_ips, local_ips};
};

// GET https://<ip>/health com SNI do domínio: diz se algo responde na 443, que certificado serve e se quem responde é o TDR.
// `rejectUnauthorized:false` é só para conseguir ler o certificado; a validade é avaliada à mão abaixo.
const probeHttps = (host, ip)=> new Promise((resolve)=>{
    let cert = null;
    let authorized = false;
    let authorizationError = null;

    const req = https.request({
        host:ip || host,
        port:443,
        servername:host,
        path:"/health",
        method:"GET",
        headers:{Host:host, "User-Agent":"TDR-domain-check"},
        rejectUnauthorized:false,
        agent:false,
        timeout:PROBE_TIMEOUT_MS
    }, (res)=>{
        let body = "";

        res.on("data", (chunk)=> body += chunk);
        res.on("end", ()=>{
            const nameError = cert?.subject ? tls.checkServerIdentity(host, cert) : new Error("sem certificado");
            const expired = cert?.valid_to ? new Date(cert.valid_to) < new Date() : true;
            const selfSigned = SELF_SIGNED.includes(authorizationError);

            resolve({
                reachable:true,
                http_status:res.statusCode,
                tdr:res.statusCode == 200 && /"content"\s*:\s*"ok"/.test(body),
                ssl:{
                    valid:authorized && !nameError && !expired,
                    self_signed:selfSigned,
                    error:selfSigned ? "certificado autoassinado (provisório)" : (authorizationError || nameError?.code || nameError?.message || (expired ? "certificado expirado" : null)),
                    issuer:cert?.issuer?.O || null,
                    valid_to:cert?.valid_to ? new Date(cert.valid_to).toISOString() : null
                }
            });
        });
    });

    req.on("socket", (socket)=> socket.on("secureConnect", ()=>{
        cert = socket.getPeerCertificate();
        authorized = socket.authorized;
        authorizationError = socket.authorizationError ? String(socket.authorizationError.code || socket.authorizationError) : null;
    }));
    req.on("timeout", ()=> req.destroy(new Error("ETIMEDOUT")));
    req.on("error", (error)=> resolve({reachable:false, error:error.code || error.message}));
    req.end();
});

const fmtDay = (iso)=> iso ? new Date(iso).toLocaleDateString("pt-BR") : "";

// Estado do domínio: ready | dns_pending | dns_other | ssl_pending | ssl_error | unreachable | other_app | inactive | local
const checkDomain = async(host, active = true)=>{
    const expected_ip = await serverIp();
    const result = {host, expected_ip, sync_minutes:SYNC_MINUTES, checked_at:new Date().toISOString(), dns:{ips:[], ok:false}, ssl:null};
    const done = (state, label, message)=> ({...result, state, label, message:result.dns.note ? `${message} ${result.dns.note}` : message});

    if(!active){
        return done("inactive", "Desativado", "Domínio desativado no painel: o sync remove o bloco do nginx e não renova o certificado. Ative para provisionar.");
    }

    if(LOCAL_HOST.test(host)){
        return done("local", "Local", "Host local ou IP: não há DNS público nem certificado para verificar.");
    }

    const {ips, public_ips, local_ips} = await resolveHost(host);

    result.dns = {ips, public_ips, local_ips, ok:ips.length > 0 && (!expected_ip || ips.includes(expected_ip))};

    if(public_ips.length && !local_ips.length){
        result.dns.note = "(Resolvedores públicos já enxergam o registro; o desta VPS ainda guarda a resposta antiga em cache, o que se resolve sozinho.)";
    }

    if(!ips.length){
        return done("dns_pending", "Aguardando DNS", `O domínio ainda não resolve (conferido em 1.1.1.1, 8.8.8.8 e no resolvedor desta VPS). Crie um registro A de ${host} apontando para ${expected_ip || "o IP desta VPS"}. A propagação leva de alguns minutos até 48 h; depois o SSL sai sozinho em até ${SYNC_MINUTES} min.`);
    }

    if(ips.some(isPrivateIp)){
        return done("dns_other", "DNS em IP privado", `O DNS aponta para ${ips.join(", ")}, um endereço privado ou reservado. O registro A precisa apontar para o IP público desta VPS${expected_ip ? ` (${expected_ip})` : ""}.`);
    }

    if(expected_ip && !ips.includes(expected_ip)){
        return done("dns_other", "DNS em outro IP", `O DNS aponta para ${ips.join(", ")}, mas o IP desta VPS é ${expected_ip}. Corrija o registro A. (Atrás do proxy da Cloudflare isso é esperado: use SSL "Full" e o sync com --no-dns-check.)`);
    }

    const probe = await probeHttps(host, ips[0]);

    result.ssl = probe.ssl || null;

    if(!probe.reachable){
        return done("unreachable", "Sem resposta", `DNS ok, mas ${host} não respondeu em HTTPS (${probe.error}). Confira a porta 443 no firewall e se o nginx está no ar.`);
    }

    if(probe.ssl.valid && probe.tdr){
        return done("ready", "Pronto", `DNS e SSL ativos. Certificado ${probe.ssl.issuer || "válido"} até ${fmtDay(probe.ssl.valid_to)}, renovado automaticamente.`);
    }

    if(probe.ssl.valid){
        return done("other_app", "Outro serviço", `HTTPS responde com certificado válido, mas quem respondeu não foi o TDR (HTTP ${probe.http_status}). Confira se o DNS aponta para esta VPS.`);
    }

    if(probe.ssl.self_signed){
        return done("ssl_pending", "Aguardando SSL", `DNS ok. O certificado é emitido automaticamente em até ${SYNC_MINUTES} min (o sync roda a cada ${SYNC_MINUTES} min). Se a emissão falhar, a próxima tentativa é em 1 h.`);
    }

    return done("ssl_error", "SSL inválido", `O certificado servido não vale para ${host} (${probe.ssl.error}). O sync tenta emitir de novo em até 1 h; detalhes em /var/log/tdr-domains.log na VPS.`);
};

// Verifica um domínio do painel e guarda o resultado em Domain.check (a lista mostra o último estado conhecido)
const checkDomainById = async({id})=>{
    try{

        const domain = await findById(Domain, id);

        if(!domain){
            throw(statusHandler.newResponse(404, "Domínio não encontrado"));
        }

        const check = await checkDomain(domain.domain, domain.status);

        await updateById(Domain, id, {check});

        return statusHandler.newResponse(200, check);

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// IP para o qual o usuário deve apontar o registro A (mostrado no modal e nas instruções pós-cadastro)
const getServerIp = async()=>{
    try{

        return statusHandler.newResponse(200, {ip:await serverIp(), sync_minutes:SYNC_MINUTES});

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const HOSTNAME = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

// IPs privados/reservados: um domínio que resolve para eles não é sondado (evita usar o app como proxy para a rede interna)
const isPrivateIp = (ip)=>{
    const [a, b] = String(ip).split(".").map(Number);

    return a == 10 || a == 127 || a == 0 || (a == 172 && b >= 16 && b <= 31) || (a == 192 && b == 168) || (a == 169 && b == 254) || (a == 100 && b >= 64 && b <= 127) || a >= 224;
};

// normaliza e recusa o domínio principal do sistema (painel): ele nunca serve uma loja
const checkDomainName = (value)=>{
    const domain = String(value || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

    if(!domain){
        throw(statusHandler.newResponse(400, "Informe o domínio"));
    }

    // só hostname válido (RFC 1123): o nome vai para o cabeçalho Host, para o nginx e para o certbot via domain.sh
    if(!HOSTNAME.test(domain)){
        throw(statusHandler.newResponse(400, "Domínio inválido: use só letras, números, hífen e pontos (ex.: loja.com ou www.loja.com)"));
    }

    if(isReservedHost(domain)){
        throw(statusHandler.newResponse(400, "Este domínio é reservado ao painel do sistema e não pode ser usado por uma loja"));
    }

    return domain;
};

// `status` truthy = só ativos; `scope` = conta em uso (filtra pelas lojas dela)
const getAllDomains = async(status, scope = null)=>{
    try{
        
        let query = await storeFilter(scope);

        if(!isEmpty(status)){
            query['status'] = true;
        }

        let domains = await findAll(Domain, query);
        domains = await populate(Domain, domains, 'store');
        

        return statusHandler.newResponse(200, domains);

    }catch(error){
        throw(statusHandler.serviceError(error))
    }
};

const createDomain = async(domain)=>{
    try{

        domain.domain = checkDomainName(domain.domain);

        const exist = await findOne(Domain, {domain:domain.domain});

        if(exist){
            throw(statusHandler.newResponse(400, 'Dominio ja cadastrado'));
        }

        const saved = await save(Domain, domain);

        // o painel usa `server_ip` nas instruções de apontamento e `_id` para começar a acompanhar o status
        return statusHandler.newResponse(200, {_id:saved?._id, domain:domain.domain, server_ip:await serverIp(), sync_minutes:SYNC_MINUTES});

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const changeStatusDomain = async({id}, {status})=>{
    try{

        await updateById(Domain, id, {status});

        return statusHandler.newResponse(200, 'ok');

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const getDomainById = async({id})=>{
    try{

        const domain = await findById(Domain, id);

        return statusHandler.newResponse(200, domain);

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const changeDomain = async({id}, domain)=>{
    try{    

        if(domain.domain !== undefined){
            domain.domain = checkDomainName(domain.domain);

            const exist = await findOne(Domain, {domain:domain.domain});

            if(exist && String(exist._id) != String(id)){
                throw(statusHandler.newResponse(400, 'Dominio ja cadastrado'));
            }

            // nome novo: a verificação anterior não vale mais
            domain.check = null;
        }

        await updateById(Domain, id, domain);

        return statusHandler.newResponse(200, "ok");

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
}

// Exclusão definitiva do domínio (nada depende dele além das sessões já gravadas)
const removeDomain = async({id})=>{
    try{

        const domain = await findById(Domain, id);

        if(!domain){
            throw(statusHandler.newResponse(404, "Domínio não encontrado"));
        }

        await removeOne(Domain, id);

        return statusHandler.newResponse(200, "Domínio excluído");

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

module.exports = {
    removeDomain,
    getAllDomains,
    createDomain,
    changeStatusDomain,
    getDomainById,
    changeDomain,
    checkDomain,
    checkDomainById,
    getServerIp,
    serverIp
};