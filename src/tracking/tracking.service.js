// Rastreio pelo 17TRACK (API v2.4, chave em API_KEY_17TRACK). Cada código é registrado uma vez no 17TRACK
// (é o que consome cota) e o resultado fica em cache no documento Tracking; nova consulta só depois de
// TRACKING_TTL_MINUTES (padrão 30) ou com refresh explícito (no mínimo 2 min entre refreshes).
// Nada aqui lança para a página: erro do 17TRACK vai no campo `error` do item e o cache anterior é mantido.
// Modo dropshipping global: ver ORIGIN_* abaixo; nada da origem (China/Hong Kong) é exibido ao cliente.
const statusHandler = require("../helpers/helpers.statusHandler");
const { request } = require("../helpers/helpers.global");
const { findAll, findOne, save, updateById } = require("../query");
const { Tracking } = require("./tracking.schema");

const API = process.env.TRACK17_API || "https://api.17track.net/track/v2.4";
const ALREADY_REGISTERED = -18019901;
const NOT_REGISTERED = -18019902;
const MAX_EVENTS = 40;
const REFRESH_MIN_MS = 2 * 60000;

// estágio da linha do tempo do pedido a partir do status do 17TRACK (null = sem informação)
const STAGE_BY_STATUS = {
    InfoReceived:"shipped",
    InTransit:"in_transit",
    OutForDelivery:"in_transit",
    AvailableForPickup:"in_transit",
    DeliveryFailure:"in_transit",
    Exception:"in_transit",
    Expired:"in_transit",
    Delivered:"delivered",
    NotFound:null
};
const PROBLEM_STATUS = ["DeliveryFailure", "Exception", "Expired"];

// ---------------------------------------------------------------- modo dropshipping (global, sempre ligado)
// Equivalente ao "Hide all China info" do app da Shopify, que a API do 17TRACK não oferece: eventos, transportadoras
// e links do trecho de origem (China/Hong Kong/Macau) nunca chegam à página nem ao chat; só a última milha aparece.
const ORIGIN_COUNTRIES = ["CN", "HK", "MO"];
const ORIGIN_PLACE = /\b(china|chinese|hong ?kong|macau|macao|shenzhen|guangzhou|yiwu|hangzhou|shanghai|beijing|dongguan|ningbo|xiamen|wuhan|chengdu|jinhua|foshan|zhengzhou|nanjing|suzhou|qingdao|tianjin|fuzhou|zhongshan|huizhou|quanzhou|wenzhou|changsha|hefei|chongqing|kunming|jiangmen|zhuhai|shantou|xi'?an|guangdong|zhejiang|jiangsu|fujian|shandong|henan|hubei|sichuan|yunnan|hunan|anhui|guangxi|hainan|cn|hk)\b|中国|中國|香港|深圳|广州|義烏|义乌|杭州|上海|北京/i;
const ORIGIN_EVENT = /\borigin\b|export customs|export clearance|outbound in sorting center|hand(ed)? over to (the )?airline|departed? from (the )?(facility|warehouse)? ?(in )?(cn|china)|arrived at (the )?departure|departure from (the )?departure/i;
const ORIGIN_CARRIER = /yanwen|yun ?express|yunexpress|4px|cainiao|china ?post|china ?ems|ems china|sf ?express|sfc\b|send ?from ?china|cj ?packet|anjun|winit|ubi ?logistics|ubi smart|sunyou|equick|jcex|flyt|yw ?express|aliexpress|cne\b|cne express|\bzto\b|\byto\b|\bsto\b|best express|deppon|jd ?logistics|jingdong|\bhtt\b|wanb|dhl ecommerce (china|asia)|hk ?post|hong ?kong post|epacket|e-packet|china/i;
const ORIGIN_URL = /17track|yanwen|4px|cainiao|yunexpress|yuntrack|chinapost|ems\.com\.cn|sf-express|aliexpress|\.cn(\/|$)|\.hk(\/|$)/i;

const isOriginCountry = (code)=> ORIGIN_COUNTRIES.includes(String(code || "").toUpperCase());
const isOriginCarrier = (name)=> ORIGIN_CARRIER.test(String(name || ""));
const isOriginUrl = (url)=> ORIGIN_URL.test(String(url || ""));
// evento do trecho de origem: país, cidade/local ou descrição típica do lado chinês
const isOriginPlace = ({country, city, state, province, location, description, message} = {})=>{
    if(isOriginCountry(country)) return true;

    const place = [city, state, province, location].filter(Boolean).join(" ");

    if(ORIGIN_PLACE.test(place)) return true;

    const text = String(description || message || "");

    return ORIGIN_PLACE.test(text) || ORIGIN_EVENT.test(text);
};

const apiKey = ()=> (process.env.API_KEY_17TRACK || "").trim();
const enabled = ()=> !!apiKey();
const ttlMs = ()=> Math.max(1, Number(process.env.TRACKING_TTL_MINUTES) || 30) * 60000;
const cleanNumber = (value)=> String(value || "").replace(/\s+/g, "").trim();
const toDate = (value)=>{
    const date = value ? new Date(value) : null;

    return date && !isNaN(date) ? date : null;
};

const call = async(path, body)=>{
    const response = await request("POST", `${API}/${path}`, body, {"17token":apiKey()});

    if(!response || typeof response.code == "undefined"){
        throw(statusHandler.newResponse(502, `17TRACK: resposta inválida em ${path}`));
    }

    if(response.code !== 0){
        const detail = response.data?.errors?.[0]?.message || response.message || `código ${response.code}`;

        throw(statusHandler.newResponse(502, `17TRACK: ${detail} (${path})`));
    }

    return response.data || {};
};

const mapEvent = (event = {}, providerOrigin = false)=>{
    const mapped = {
        time:toDate(event.time_iso || event.time_utc),
        description:event.description_translation || event.description || "",
        location:event.location || [event.address?.city, event.address?.state, event.address?.country].filter(Boolean).join(", "),
        stage:event.stage || event.sub_status || "",
        country:String(event.address?.country || "").toUpperCase()
    };

    mapped.origin = providerOrigin || isOriginPlace({country:mapped.country, location:mapped.location, description:mapped.description});

    return mapped;
};

// track_info do 17TRACK -> campos do documento Tracking
const normalize = (item = {})=>{
    const info = item.track_info || {};
    const providers = info.tracking?.providers || [];
    const providerIsOrigin = (p)=> isOriginCountry(p?.provider?.country) || isOriginCarrier(p?.provider?.name);
    const events = providers.flatMap(p=> (p.events || []).map(e=> mapEvent(e, providerIsOrigin(p)))).filter(e=> e.time).sort((a, b)=> b.time - a.time).slice(0, MAX_EVENTS);
    const visible = events.filter(e=> !e.origin);
    const latest = info.latest_event ? mapEvent(info.latest_event) : null;
    const eta = info.time_metrics?.estimated_delivery_date || {};

    // transportadora exibida = última milha: misc_info.local_provider ou o primeiro provedor fora da origem
    const misc = info.misc_info || {};
    const lastMile = providers.find(p=> !providerIsOrigin(p) && (!misc.local_key || String(p.provider?.key) == String(misc.local_key))) || providers.find(p=> !providerIsOrigin(p)) || null;
    const carrierName = (misc.local_provider && !isOriginCarrier(misc.local_provider)) ? misc.local_provider : (lastMile?.provider?.name || "");

    return {
        carrier:lastMile?.provider?.key ?? (misc.local_key || null),
        carrier_name:carrierName,
        carrier_url:(lastMile?.provider?.homepage && !isOriginUrl(lastMile.provider.homepage)) ? lastMile.provider.homepage : "",
        origin_country:String(info.shipping_info?.shipper_address?.country || "").toUpperCase(),
        hidden_events:events.length - visible.length,
        status:info.latest_status?.status || "NotFound",
        sub_status:info.latest_status?.sub_status || "",
        sub_status_descr:info.latest_status?.sub_status_descr || "",
        latest_event:(latest && latest.time && !latest.origin) ? latest : (visible[0] || null),
        events,
        estimated_from:toDate(eta.from),
        estimated_to:toDate(eta.to),
        days_in_transit:info.time_metrics?.days_of_transit ?? null,
        days_since_update:info.time_metrics?.days_after_last_update ?? null,
        fetched_at:new Date(),
        error:""
    };
};

const upsert = async(number, fields, order = null)=>{
    const doc = await findOne(Tracking, {number});

    if(doc){
        let update = {$set:fields};

        order && (update.$addToSet = {orders:String(order)});

        return await updateById(Tracking, doc._id, update);
    }

    return await save(Tracking, {number, ...fields, orders:order ? [String(order)] : []});
};

// registra códigos no 17TRACK; "já registrado" conta como sucesso
const register = async(items)=>{
    const data = await call("register", items.map(({number, carrier})=> carrier ? {number, carrier} : {number}));
    const ok = new Set((data.accepted || []).map(a=> a.number));
    let errors = {};

    (data.rejected || []).forEach(r=>{
        r.error?.code === ALREADY_REGISTERED ? ok.add(r.number) : (errors[r.number] = r.error?.message || "rejeitado pelo 17TRACK");
    });

    return {ok, errors};
};

const fetchInfo = async(items)=>{
    if(!items.length){
        return {accepted:[], notRegistered:[], errors:{}};
    }

    const data = await call("gettrackinfo", items.map(({number, carrier})=> carrier ? {number, carrier} : {number}));
    let notRegistered = [];
    let errors = {};

    (data.rejected || []).forEach(r=>{
        r.error?.code === NOT_REGISTERED ? notRegistered.push(r.number) : (errors[r.number] = r.error?.message || "rejeitado pelo 17TRACK");
    });

    return {accepted:data.accepted || [], notRegistered, errors};
};

// item devolvido à página/chat: cache + dados da Shopify (transportadora e link) como fallback
const present = (doc, wanted)=>{
    const data = doc || {};
    const status = data.status || "NotFound";
    // modo dropshipping: só eventos fora da origem; transportadora/link da Shopify só se não forem do trecho chinês
    const events = (data.events || []).filter(e=> !e.origin);
    const hidden = (data.events || []).length - events.length;
    const company = isOriginCarrier(wanted.company) ? "" : (wanted.company || "");
    const url = (!company || isOriginUrl(wanted.url)) ? "" : (wanted.url || "");
    const latest = (data.latest_event?.time && !data.latest_event.origin) ? data.latest_event : (events[0] || null);

    return {
        number:wanted.number,
        company,
        url,
        carrier:data.carrier ?? null,
        carrier_name:data.carrier_name || company,
        carrier_url:data.carrier_url || "",
        status,
        stage:STAGE_BY_STATUS[status] ?? null,
        problem:PROBLEM_STATUS.includes(status),
        // em trânsito internacional: só há eventos do trecho de origem (ocultos) e o pacote ainda não chegou ao destino
        international:!latest && hidden > 0 && !["Delivered", "NotFound"].includes(status),
        hidden_events:hidden,
        sub_status:data.sub_status || "",
        sub_status_descr:data.sub_status_descr || "",
        latest_event:latest,
        events,
        estimated_from:data.estimated_from || null,
        estimated_to:data.estimated_to || null,
        days_in_transit:data.days_in_transit ?? null,
        days_since_update:data.days_since_update ?? null,
        fetched_at:data.fetched_at || null,
        error:data.error || ""
    };
};

// Rastreio de uma lista de códigos (ex.: order.tracking da Shopify). Um item por código, na mesma ordem.
// `force` ignora o TTL (respeitando o mínimo de 2 min); `order` é anotado no documento para auditoria.
const getTrackings = async(list = [], {force = false, order = null} = {})=>{
    let wanted = [];
    const seen = new Set();

    (list || []).forEach(t=>{
        const number = cleanNumber(t?.number);

        if(number && !seen.has(number)){
            seen.add(number);
            wanted.push({number, company:t.company || "", url:t.url || ""});
        }
    });

    if(!wanted.length || !enabled()){
        return [];
    }

    const numbers = wanted.map(w=> w.number);
    const docs = await findAll(Tracking, {number:{$in:numbers}});
    let byNumber = Object.fromEntries(docs.map(d=> [d.number, d]));
    const now = Date.now();

    const stale = wanted.filter(w=>{
        const doc = byNumber[w.number];

        if(!doc || !doc.fetched_at) return true;
        if(doc.status == "Delivered" && !doc.error) return false;   // entrega final não muda mais

        const age = now - new Date(doc.fetched_at).getTime();

        return force ? age > REFRESH_MIN_MS : age > ttlMs();
    });

    if(stale.length){
        try{

            const unregistered = stale.filter(w=> !byNumber[w.number]?.registered);
            let registeredNow = new Set(stale.filter(w=> byNumber[w.number]?.registered).map(w=> w.number));

            if(unregistered.length){
                const {ok, errors} = await register(unregistered);

                for(const w of unregistered){
                    if(ok.has(w.number)){
                        registeredNow.add(w.number);
                        await upsert(w.number, {registered:true, registered_at:new Date(), error:""}, order);
                    }else{
                        await upsert(w.number, {error:errors[w.number] || "não registrado no 17TRACK", fetched_at:new Date()}, order);
                    }
                }
            }

            let {accepted, notRegistered, errors} = await fetchInfo(stale.filter(w=> registeredNow.has(w.number)));

            // registro perdido do lado do 17TRACK: registra de novo e tenta uma vez
            if(notRegistered.length){
                const again = await register(notRegistered.map(number=> ({number})));
                const retry = await fetchInfo([...again.ok].map(number=> ({number})));

                accepted = accepted.concat(retry.accepted);
                errors = {...errors, ...again.errors, ...retry.errors};
            }

            for(const item of accepted){
                await upsert(item.number, normalize(item), order);
            }

            for(const [number, message] of Object.entries(errors)){
                // "No tracking information at this time": o 17TRACK ainda não achou o código; estado normal, não erro
                /no tracking information/i.test(message)
                    ? await upsert(number, {status:"NotFound", error:"", fetched_at:new Date()}, order)
                    : await upsert(number, {error:message, fetched_at:new Date()}, order);
            }

        }catch(error){
            // chave inválida, rede, cota: mantém o cache e evita martelar a API até o próximo TTL/refresh
            const message = error.content || error.message || String(error);

            console.warn('\x1b[33m%s\x1b[0m', `[17track] ${message}`);

            for(const w of stale){
                await upsert(w.number, {error:message, fetched_at:new Date()}, order).catch(()=>{});
            }
        }

        const fresh = await findAll(Tracking, {number:{$in:numbers}});

        byNumber = Object.fromEntries(fresh.map(d=> [d.number, d]));
    }

    return wanted.map(w=> present(byNumber[w.number] ? (byNumber[w.number].toJSON ? byNumber[w.number].toJSON() : byNumber[w.number]) : null, w));
};

// remove o código do 17TRACK e do cache (uso administrativo/testes)
const deleteTracking = async(number)=>{
    number = cleanNumber(number);

    if(!number || !enabled()) return false;

    await call("deletetrack", [{number}]).catch(()=>{});

    const doc = await findOne(Tracking, {number});

    doc && await updateById(Tracking, doc._id, {$set:{registered:false, fetched_at:null, error:"removido"}});

    return true;
};

module.exports = {
    enabled,
    getTrackings,
    deleteTracking,
    normalize,
    isOriginCountry,
    isOriginCarrier,
    isOriginUrl,
    isOriginPlace,
    STAGE_BY_STATUS,
    PROBLEM_STATUS
};
