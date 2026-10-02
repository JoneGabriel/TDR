// Integração com o MCP da Higgsfield (geração de imagens por IA) usada pelas áreas de imagem do admin.
// Autenticação: OAuth 2.1 do próprio MCP (registro dinâmico de cliente + PKCE + refresh token), feita pelo SDK oficial;
// o admin conecta uma vez em /admin/integrations e os tokens ficam em Setting(higgsfield).
// Geração: tools/call generate_image_batch -> jobs_wait até terminar -> download da imagem -> data URL para o admin.
const axios = require("axios");
const crypto = require("crypto");
const statusHandler = require("../helpers/helpers.statusHandler");
const { findOne, save, updateById } = require("../query");
const { Setting } = require("./ai.schema");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport } = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
const { auth, UnauthorizedError } = require("@modelcontextprotocol/sdk/client/auth.js");

const KEY = "higgsfield";
const SCOPE = "openid email offline_access";
const DEFAULTS = {
    url:process.env.HIGGSFIELD_MCP_URL || "https://mcp.higgsfield.ai/mcp",
    model:"gpt_image_2_5",
    aspect_ratio:"1:1",
    quality:"medium",
    use_unlim:false
};
const IMAGE_MODELS = [
    {id:"gpt_image_2_5", name:"GPT Image 2.5 — geral, fotorrealista, texto"},
    {id:"marketing_studio_image", name:"Marketing Studio — produto e anúncios"},
    {id:"soul_2", name:"Soul 2 — retratos, moda, UGC"}
];
const ASPECT_RATIOS = ["1:1", "4:5", "3:4", "2:3", "9:16", "4:3", "3:2", "16:9", "21:9"];
const QUALITIES = ["low", "medium", "high"];
const JOB_TIMEOUT_MS = 180 * 1000;
const JOB_TTL_MS = 30 * 60 * 1000;

const sleep = (ms)=> new Promise(resolve=> setTimeout(resolve, ms));

// ---------------------------------------------------------------- configurações
const getSettings = async()=>{
    const doc = await findOne(Setting, {key:KEY});

    return {...DEFAULTS, ...(doc?.value || {})};
};

const saveSettings = async(patch)=>{
    const doc = await findOne(Setting, {key:KEY});
    const value = {...(doc?.value || {}), ...patch};

    doc
        ? await updateById(Setting, doc._id, {value, updatedAt:new Date()})
        : await save(Setting, {key:KEY, value, updatedAt:new Date()});

    return value;
};

const decodeIdToken = (idToken)=>{
    try{
        const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));

        return {email:payload.email, name:payload.name, sub:payload.sub};
    }catch(error){
        return null;
    }
};

// Estado público (sem segredos) para a tela de integrações
const getStatus = async()=>{
    const settings = await getSettings();
    const tokens = settings.tokens;
    const expiresAt = tokens?.obtained_at && tokens?.expires_in ? new Date(tokens.obtained_at + tokens.expires_in * 1000) : null;

    return {
        connected:!!tokens?.access_token,
        account:settings.account || null,
        connected_at:settings.connected_at || null,
        token_expires_at:expiresAt,
        has_refresh_token:!!tokens?.refresh_token,
        url:settings.url,
        redirect_uri:settings.client?.redirect_uri || null,
        model:settings.model,
        aspect_ratio:settings.aspect_ratio,
        quality:settings.quality,
        use_unlim:!!settings.use_unlim,
        models:IMAGE_MODELS,
        aspect_ratios:ASPECT_RATIOS,
        qualities:QUALITIES
    };
};

const updateDefaults = async({model, aspect_ratio, quality, use_unlim} = {})=>{
    try{

        if(model && !IMAGE_MODELS.some(item=> item.id == model)){
            throw(statusHandler.newResponse(400, `Modelo inválido: ${model}`));
        }

        if(aspect_ratio && !ASPECT_RATIOS.includes(aspect_ratio)){
            throw(statusHandler.newResponse(400, `Proporção inválida: ${aspect_ratio}`));
        }

        if(quality && !QUALITIES.includes(quality)){
            throw(statusHandler.newResponse(400, `Qualidade inválida: ${quality}`));
        }

        let patch = {};

        model && (patch.model = model);
        aspect_ratio && (patch.aspect_ratio = aspect_ratio);
        quality && (patch.quality = quality);
        use_unlim !== undefined && (patch.use_unlim = !!use_unlim);

        await saveSettings(patch);

        return statusHandler.newResponse(200, await getStatus());

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// ---------------------------------------------------------------- OAuth (provedor para o SDK)
// Cliente, tokens, verifier e state ficam em Setting(higgsfield). `origin` é o endereço do admin,
// usado como redirect_uri; se mudar, o cliente é registrado de novo.
const createProvider = (origin)=>{
    const redirectUrl = origin ? `${origin}/ai/oauth/callback` : undefined;
    let authorizeUrl = null;

    return {
        get redirectUrl(){
            return redirectUrl;
        },
        get clientMetadata(){
            return {
                client_name:"TDR Admin",
                redirect_uris:redirectUrl ? [redirectUrl] : [],
                grant_types:["authorization_code", "refresh_token"],
                response_types:["code"],
                token_endpoint_auth_method:"none",
                scope:SCOPE
            };
        },
        async state(){
            const state = crypto.randomBytes(16).toString("hex");

            await saveSettings({pending_state:state});

            return state;
        },
        async clientInformation(){
            const {client} = await getSettings();

            if(!client?.info){
                return undefined;
            }

            // host do admin mudou: força novo registro com o redirect certo
            if(redirectUrl && client.redirect_uri && client.redirect_uri !== redirectUrl){
                return undefined;
            }

            return client.info;
        },
        async saveClientInformation(info){
            await saveSettings({client:{info, redirect_uri:redirectUrl}});
        },
        async tokens(){
            const {tokens} = await getSettings();

            return tokens?.access_token ? tokens : undefined;
        },
        async saveTokens(tokens){
            let patch = {tokens:{...tokens, obtained_at:Date.now()}, connected_at:new Date()};
            const account = tokens.id_token ? decodeIdToken(tokens.id_token) : null;

            account && (patch.account = account);

            await saveSettings(patch);
        },
        redirectToAuthorization(url){
            authorizeUrl = url.toString();
        },
        async saveCodeVerifier(verifier){
            await saveSettings({code_verifier:verifier});
        },
        async codeVerifier(){
            const {code_verifier} = await getSettings();

            if(!code_verifier){
                throw new Error("Fluxo OAuth não iniciado (code_verifier ausente)");
            }

            return code_verifier;
        },
        async invalidateCredentials(scope){
            let patch = {};

            (scope == "all" || scope == "tokens") && (patch.tokens = null);
            (scope == "all" || scope == "client") && (patch.client = null);
            (scope == "all" || scope == "verifier") && (patch.code_verifier = null);

            Object.keys(patch).length && await saveSettings(patch);
        },
        get authorizeUrl(){
            return authorizeUrl;
        }
    };
};

// Passo 1: descoberta, registro do cliente e URL de autorização para o admin abrir no navegador
const startConnect = async(origin)=>{
    try{

        if(!origin){
            throw(statusHandler.newResponse(400, "Origem do admin desconhecida"));
        }

        await resetClient();
        await saveSettings({tokens:null, account:null});

        const settings = await getSettings();
        const provider = createProvider(origin);
        const result = await auth(provider, {serverUrl:settings.url, scope:SCOPE});

        if(result == "AUTHORIZED"){
            return statusHandler.newResponse(200, {connected:true});
        }

        if(!provider.authorizeUrl){
            throw(statusHandler.newResponse(502, "A Higgsfield não devolveu a URL de autorização"));
        }

        return statusHandler.newResponse(200, {authorize_url:provider.authorizeUrl});

    }catch(error){
        throw(statusHandler.serviceError(error.status ? error : statusHandler.newResponse(502, `Higgsfield: ${error.message || error}`)));
    }
};

// Passo 2 (callback): valida o state e troca o code pelos tokens
const finishConnect = async(origin, code, state)=>{
    try{

        const settings = await getSettings();

        if(!code){
            throw(statusHandler.newResponse(400, "Autorização sem código"));
        }

        if(!state || state !== settings.pending_state){
            throw(statusHandler.newResponse(400, "State inválido; inicie a conexão de novo"));
        }

        const provider = createProvider(origin);
        const result = await auth(provider, {serverUrl:settings.url, authorizationCode:code, scope:SCOPE});

        if(result != "AUTHORIZED"){
            throw(statusHandler.newResponse(502, "A Higgsfield não concluiu a autorização"));
        }

        await saveSettings({pending_state:null, code_verifier:null});
        await resetClient();

        return statusHandler.newResponse(200, await getStatus());

    }catch(error){
        throw(statusHandler.serviceError(error.status ? error : statusHandler.newResponse(502, `Higgsfield: ${error.message || error}`)));
    }
};

const disconnect = async()=>{
    try{

        await resetClient();
        await saveSettings({tokens:null, account:null, pending_state:null, code_verifier:null, connected_at:null});

        return statusHandler.newResponse(200, await getStatus());

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// ---------------------------------------------------------------- cliente MCP
let cached = null;   // {client, transport, url}

const resetClient = async()=>{
    try{
        await cached?.client?.close();
    }catch(error){}

    cached = null;
};

// 409 (não 401) para o JS do admin não confundir com sessão do painel expirada
const notConnected = (message = "Higgsfield não conectada. Conecte em Admin > Integrações.")=> statusHandler.newResponse(409, message);

const getClient = async()=>{
    const settings = await getSettings();

    if(!settings.tokens?.access_token){
        throw(notConnected());
    }

    if(cached && cached.url == settings.url){
        return cached.client;
    }

    const origin = settings.client?.redirect_uri ? settings.client.redirect_uri.replace(/\/ai\/oauth\/callback$/, "") : null;
    const transport = new StreamableHTTPClientTransport(new URL(settings.url), {authProvider:createProvider(origin)});
    const client = new Client({name:"tdr-admin", version:"1.0.0"});

    try{
        await client.connect(transport);
    }catch(error){
        if(error instanceof UnauthorizedError){
            throw(notConnected("A sessão da Higgsfield expirou. Conecte de novo em Admin > Integrações."));
        }

        throw(statusHandler.newResponse(502, `Higgsfield MCP: ${error.message || error}`));
    }

    cached = {client, transport, url:settings.url};

    return client;
};

const textOf = (result)=> (result?.content || []).filter(item=> item.type == "text").map(item=> item.text).join("\n");

// Resultado da ferramenta: structuredContent quando existe, senão o texto (JSON quando possível)
const parseResult = (result)=>{
    if(result?.structuredContent){
        return result.structuredContent;
    }

    const text = textOf(result);

    try{
        return JSON.parse(text);
    }catch(error){
        return {text};
    }
};

// Chama uma ferramenta do MCP. `retry` só para leituras (uma geração nunca é reenviada automaticamente).
const callTool = async(name, args = {}, retry = false)=>{
    const run = async()=>{
        const client = await getClient();

        return await client.callTool({name, arguments:args});
    };

    let result;

    try{
        result = await run();
    }catch(error){
        if(error.status || !retry){
            await resetClient();
            throw(error.status ? error : statusHandler.newResponse(502, `Higgsfield MCP: ${error.message || error}`));
        }

        await resetClient();
        result = await run();
    }

    if(result?.isError){
        throw(statusHandler.newResponse(502, `Higgsfield: ${textOf(result) || "erro na ferramenta"}`));
    }

    return parseResult(result);
};

// injetável para testes (a geração usa deps.callTool)
const deps = {callTool};

const testConnection = async()=>{
    try{

        const client = await getClient();
        const tools = await client.listTools();
        const names = (tools.tools || []).map(tool=> tool.name);
        let balance = null;

        if(names.includes("balance")){
            balance = await deps.callTool("balance", {}, true);
        }

        return statusHandler.newResponse(200, {tools:names.length, has_generate:names.includes("generate_image_batch"), has_wait:names.includes("jobs_wait"), balance});

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// ---------------------------------------------------------------- geração de imagem (jobs em memória)
const jobs = new Map();

const cleanupJobs = ()=>{
    const limit = Date.now() - JOB_TTL_MS;

    for(const [id, job] of jobs){
        job.created < limit && jobs.delete(id);
    }
};

const publicJob = (job)=>{
    const {image, ...rest} = job;

    return rest;
};

const generateImage = async({prompt, model, aspect_ratio, quality} = {})=>{
    try{

        prompt = String(prompt || "").trim();

        if(!prompt){
            throw(statusHandler.newResponse(400, "Descreva a imagem"));
        }

        const settings = await getSettings();

        if(!settings.tokens?.access_token){
            throw(notConnected());
        }

        model = IMAGE_MODELS.some(item=> item.id == model) ? model : settings.model;
        aspect_ratio = ASPECT_RATIOS.includes(aspect_ratio) ? aspect_ratio : settings.aspect_ratio;
        quality = QUALITIES.includes(quality) ? quality : settings.quality;

        let params = {model, prompt, aspect_ratio, use_unlim:!!settings.use_unlim};

        // `quality` só existe nos modelos GPT Image
        model.startsWith("gpt_image") && (params.quality = quality);

        cleanupJobs();

        const id = crypto.randomUUID();
        let job = {id, status:"running", created:Date.now(), prompt, model, aspect_ratio};

        jobs.set(id, job);

        (async()=>{
            try{
                const submit = await deps.callTool("generate_image_batch", {requests:[{index:0, params}]});
                const first = submit?.jobs?.[0];

                if(!first?.job_id){
                    throw new Error(first?.error || submit?.unlim_choice?.message || submit?.text || "a Higgsfield não aceitou a geração");
                }

                job.hf_job = first.job_id;

                const deadline = Date.now() + JOB_TIMEOUT_MS;

                while(Date.now() < deadline){
                    const wait = await deps.callTool("jobs_wait", {jobs:[{index:0, job_id:first.job_id}], timeout_seconds:15}, true);
                    const state = wait?.jobs?.[0];

                    if(state?.status == "completed" && state.result_url){
                        job.result_url = state.result_url;
                        break;
                    }

                    if(["failed", "error", "canceled", "cancelled"].includes(state?.status)){
                        throw new Error(state.error || `geração ${state.status}`);
                    }

                    if(wait?.all_terminal){
                        throw new Error("a geração terminou sem imagem");
                    }

                    await sleep((wait?.poll_after_seconds || 3) * 1000);
                }

                if(!job.result_url){
                    throw new Error("tempo esgotado esperando a Higgsfield");
                }

                const file = await axios.get(job.result_url, {responseType:"arraybuffer", timeout:60000});

                job.mime = file.headers["content-type"] || "image/png";
                job.image = `data:${job.mime};base64,${Buffer.from(file.data).toString("base64")}`;
                job.bytes = file.data.length;
                job.status = "done";
            }catch(error){
                job.status = "error";
                job.error = error.content || error.message || String(error);
            }

            job.finished = Date.now();
        })();

        return statusHandler.newResponse(200, {job:id});

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const getJob = (id)=>{
    const job = jobs.get(id);

    if(!job){
        throw(statusHandler.newResponse(404, "Geração não encontrada"));
    }

    return statusHandler.newResponse(200, publicJob(job));
};

const getJobImage = (id)=>{
    const job = jobs.get(id);

    if(!job){
        throw(statusHandler.newResponse(404, "Geração não encontrada"));
    }

    if(job.status != "done"){
        throw(statusHandler.newResponse(409, job.status == "error" ? job.error : "Geração ainda em andamento"));
    }

    return statusHandler.newResponse(200, {image:job.image, mime:job.mime, bytes:job.bytes, result_url:job.result_url});
};

module.exports = {
    IMAGE_MODELS,
    ASPECT_RATIOS,
    getSettings,
    saveSettings,
    getStatus,
    updateDefaults,
    startConnect,
    finishConnect,
    disconnect,
    testConnection,
    generateImage,
    getJob,
    getJobImage,
    parseResult,
    deps,
    jobs
};
