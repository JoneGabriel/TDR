const { Domain } = require("../domain/domain.schema");
const { isEmpty } = require("../helpers/helpers.global");
const statusHandler = require("../helpers/helpers.statusHandler")

const {
    aggregate,
    save,
    findOne,
    findById,
    countDocuments
} = require("../query");

const {
    findActiveSession,
    touchSession,
    nowBrazil,
    VISITOR_COOKIE
} = require("../trail/trail.service");
const { Store } = require("../store/store.schema");

const {
 Trail
} = require("../trail/trail.schema");

const {
    Event
} = require("./metrics.schema");


// Filtro por domínio respeitando a conta em uso: `allowed` = domínios da conta (null = todas as contas).
// Domínio pedido fora da conta responde 404; sem domínio pedido, limita aos da conta.
const domainMatch = (domain, allowed = null)=>{
    if(!allowed){
        return isEmpty(domain) ? {} : {domain};
    }

    if(!isEmpty(domain)){
        if(!allowed.includes(domain)){
            throw(statusHandler.newResponse(404, "Domínio não encontrado"));
        }

        return {domain};
    }

    return {domain:{$in:allowed}};
};

const getSessionsInterval = async(start , end, domain, allowed = null)=>{
    try{
        
        start = new Date(start);
        end = new Date(end);
        
        let hours = [{start:0, end:3}, {start:4, end:7}, {start:8, end:11}, {start:12, end:15}, {start:16, end:19}, {start:20, end:23}, {start:23, end:23}];

        let response = []
        let country_code;

        const getDomain = await findOne(Domain, {domain});

        if(!isEmpty(getDomain)){
            const {store} = getDomain;
            const {country} = await findById(Store, store, "country");

            country_code = {
                $in:country
            }
            
        }

        for(i in hours){

            const {start:startHour, end:endHour} = hours[i];

            start.setUTCHours(startHour, 0, 0, 0);
            end.setUTCHours(endHour, 59, 0, 0)

            let query = [
                {
                    $match: {
                        createdAt: { $gte: start, $lte:end },
                        page: "black",
                        country_code,
                    }
                },
                {
                    $group: {
                        _id: "$ip" 
                    }
                },
                {
                    $count: "total_ips_unicos" 
                }
            ];

            Object.assign(query[0]['$match'], domainMatch(domain, allowed));

            const sessions = await aggregate(Trail, query);
           
            response.push([`${startHour}h`, (sessions?.[0]?.total_ips_unicos || 0)]);
        }
        
        return statusHandler.newResponse(200, response);

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const getAllSessions = async(start , end, domain, api = false, allowed = null)=>{
    try{
        
        if(isEmpty(start) && isEmpty(end)){
            start = new Date(Date.now()); 
            start.setHours(0, 0, 0, 0);
            

            end = new Date(Date.now());
            end.setHours(23, 59, 0, 0);

        }else{
            start = new Date(start);
            start.setUTCHours(0, 0, 0, 0);  
            
            end = new Date(end);
            end.setUTCHours(23, 59, 0, 0);
            
        }   

        let country_code;

        const getDomain = await findOne(Domain, {domain});

        if(!isEmpty(getDomain)){
            const {store} = getDomain;
            const {country} = await findById(Store, store, "country");

            country_code = {
                $in:country
            }
            
        }

        let query = [
            {
                $match: {
                    createdAt: { $gte: start, $lte:end },
                    page: "black",
                    country_code
                }
            },
            {
                $group: {
                    _id: "$ip" // agrupa por IP (remove duplicados)
                }
            },
            {
                $count: "total_ips_unicos" // conta quantos IPs únicos ficaram
            }
        ];
       
        Object.assign(query[0]['$match'], domainMatch(domain, allowed));
        
        const sessions = await aggregate(Trail, query);
        

        if(api){
            
            const {content} = await getSessionsInterval(start, end, domain, allowed);

            let response = {
                total:(sessions[0]?.total_ips_unicos || 0),
                interval:content
            }

            return statusHandler.newResponse(200, response)
        }

        return statusHandler.newResponse(200, sessions)

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// Evento da vitrine (add-to-cart / init-checkout). Identidade: cookie tdr_vid, com fallback no id do localStorage.
// Marca o funil na sessão ativa (uma vez por sessão) e guarda o evento como histórico, sem duplicar por sessão.
const createNewEvent = async(client = {}, event, req = null)=>{
    try{

        const visitor = req?.cookies?.[VISITOR_COOKIE] || client.id;
        const domain = client.domain || req?.headers?.host;

        if(!visitor){
            return statusHandler.newResponse(200, 'ok');
        }

        const now = nowBrazil();
        const session = await findActiveSession(visitor, domain);

        if(session){
            const flag = event == 'add-to-cart' ? 'added_cart' : 'init_checkout';
            let extra = {};

            if(!session[flag]){
                extra[flag] = true;
                extra[`${flag}_at`] = now;
            }

            await touchSession(session, null, extra);
        }

        const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
        const dedupe = session
            ? {session:session._id, type_event:event}
            : {id:visitor, type_event:event, createdAt:{$gte:dayStart}};
        const exist = await findOne(Event, dedupe);

        if(!isEmpty(exist)){
            return statusHandler.newResponse(200, 'ok');
        }

        await save(Event, {
            id:visitor,
            visitor,
            session:session?._id,
            domain,
            type_event:event,
            product:client.product,
            path:client.path,
            createdAt:now
        });

        return statusHandler.newResponse(200, 'ok');

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// Heartbeat da vitrine (public/scripts/session.js): renova a sessão ativa para o contador em tempo real
const pingSession = async(req, {domain, path} = {})=>{
    try{

        const visitor = req.cookies?.[VISITOR_COOKIE];
        const session = await findActiveSession(visitor, domain || req.headers.host);

        if(session){
            await touchSession(session, null, path ? {last_path:path} : {});
        }

        return statusHandler.newResponse(200, 'ok');

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// Datas do painel chegam como YYYY-MM-DD. O banco guarda horário de Brasília deslocado,
// então o dia local corresponde a 00:00Z–23:59:59Z do mesmo valor.
const dayStart = (ymd)=> new Date(`${ymd}T00:00:00.000Z`);
const dayEnd = (ymd)=> new Date(`${ymd}T23:59:59.999Z`);
const todayYmd = ()=> nowBrazil().toISOString().slice(0, 10);
const pct = (part, total)=> total ? Math.round(part / total * 1000) / 10 : 0;

const buildMatch = (start, end, domain, allowed = null)=>{
    return {
        createdAt:{$gte:dayStart(start), $lte:dayEnd(end)},
        is_bot:{$ne:true},
        ...domainMatch(domain, allowed)
    };
};

// Resumo do período para o painel: totais, funil, série temporal, páginas, países e dispositivos.
// Bots ficam fora de tudo (contados à parte); sessões antigas sem os campos novos contam como 1 pageview.
const getSummary = async(start, end, domain, allowed = null)=>{
    try{

        start = /^\d{4}-\d{2}-\d{2}$/.test(start || "") ? start : todayYmd();
        end = /^\d{4}-\d{2}-\d{2}$/.test(end || "") ? end : start;
        start > end && ([start, end] = [end, start]);

        const byHour = start == end;
        const match = buildMatch(start, end, domain, allowed);
        const flag = (field)=> ({$sum:{$cond:[{$eq:[`$${field}`, true]}, 1, 0]}});
        const views = {$ifNull:["$pageviews", 1]};

        const pipeline = [
            {$match:match},
            {$facet:{
                totals:[{$group:{
                    _id:null,
                    sessions:{$sum:1},
                    pageviews:{$sum:views},
                    passed:{$sum:{$cond:[{$eq:["$page", "black"]}, 1, 0]}},
                    filtered:{$sum:{$cond:[{$eq:["$page", "white"]}, 1, 0]}},
                    mobile:flag("isMobile"),
                    bounces:{$sum:{$cond:[{$lte:[views, 1]}, 1, 0]}},
                    added_cart:flag("added_cart"),
                    init_checkout:flag("init_checkout")
                }}],
                series:[
                    {$group:{
                        _id:{$dateToString:{format:byHour ? "%H" : "%Y-%m-%d", date:"$createdAt"}},
                        sessions:{$sum:1},
                        added_cart:flag("added_cart"),
                        init_checkout:flag("init_checkout")
                    }},
                    {$sort:{_id:1}}
                ],
                pages:[
                    {$unwind:"$pages"},
                    {$group:{_id:"$pages", views:{$sum:1}}},
                    {$sort:{views:-1}},
                    {$limit:8}
                ],
                countries:[
                    {$group:{_id:{$ifNull:["$country_code", "?"]}, sessions:{$sum:1}}},
                    {$sort:{sessions:-1}},
                    {$limit:6}
                ],
                devices:[
                    {$group:{_id:{$cond:[{$eq:["$isMobile", true]}, "mobile", "desktop"]}, sessions:{$sum:1}}},
                    {$sort:{sessions:-1}}
                ]
            }}
        ];

        const [result] = await aggregate(Trail, pipeline);
        const totals = result.totals[0] || {sessions:0, pageviews:0, passed:0, filtered:0, mobile:0, bounces:0, added_cart:0, init_checkout:0};
        const bots = await countDocuments(Trail, {...match, is_bot:true});

        // série com todos os intervalos, mesmo os vazios
        const found = Object.fromEntries(result.series.map(row=> [row._id, row]));
        let series = [];

        if(byHour){
            for(let h = 0; h < 24; h++){
                const key = (h + "").padStart(2, "0");
                const row = found[key] || {};

                series.push({label:`${key}h`, sessions:row.sessions || 0, added_cart:row.added_cart || 0, init_checkout:row.init_checkout || 0});
            }
        }else{
            for(let d = dayStart(start); d <= dayEnd(end); d = new Date(d.getTime() + 24 * 60 * 60 * 1000)){
                const key = d.toISOString().slice(0, 10);
                const row = found[key] || {};

                series.push({label:`${key.slice(8, 10)}/${key.slice(5, 7)}`, sessions:row.sessions || 0, added_cart:row.added_cart || 0, init_checkout:row.init_checkout || 0});
            }
        }

        return statusHandler.newResponse(200, {
            range:{start, end, granularity:byHour ? "hour" : "day", domain:domain || null},
            sessions:totals.sessions,
            pageviews:totals.pageviews,
            passed:totals.passed,
            filtered:totals.filtered,
            mobile:totals.mobile,
            bounces:totals.bounces,
            bots,
            added_cart:totals.added_cart,
            init_checkout:totals.init_checkout,
            rates:{
                cart:pct(totals.added_cart, totals.sessions),
                checkout:pct(totals.init_checkout, totals.sessions),
                checkout_from_cart:pct(totals.init_checkout, totals.added_cart),
                bounce:pct(totals.bounces, totals.sessions),
                mobile:pct(totals.mobile, totals.sessions),
                pages_per_session:totals.sessions ? Math.round(totals.pageviews / totals.sessions * 10) / 10 : 0
            },
            series,
            pages:result.pages.map(row=> ({path:row._id, views:row.views})),
            countries:result.countries.map(row=> ({country:row._id, sessions:row.sessions})),
            devices:result.devices.map(row=> ({device:row._id, sessions:row.sessions}))
        });

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// Usuários em tempo real: sessões com atividade nos últimos 5 minutos (heartbeat ou navegação), sem bots
const REALTIME_WINDOW_MS = 5 * 60 * 1000;

const getRealtime = async(domain, allowed = null)=>{
    try{

        let match = {
            lastSeenAt:{$gte:new Date(nowBrazil().getTime() - REALTIME_WINDOW_MS)},
            is_bot:{$ne:true},
            ...domainMatch(domain, allowed)
        };

        const pipeline = [
            {$match:match},
            {$facet:{
                totals:[{$group:{
                    _id:null,
                    active:{$sum:1},
                    mobile:{$sum:{$cond:[{$eq:["$isMobile", true]}, 1, 0]}},
                    passed:{$sum:{$cond:[{$eq:["$page", "black"]}, 1, 0]}},
                    filtered:{$sum:{$cond:[{$eq:["$page", "white"]}, 1, 0]}},
                    added_cart:{$sum:{$cond:[{$eq:["$added_cart", true]}, 1, 0]}}
                }}],
                pages:[
                    {$group:{_id:{$ifNull:["$last_path", "$entry_page"]}, users:{$sum:1}}},
                    {$sort:{users:-1}},
                    {$limit:6}
                ],
                domains:[
                    {$group:{_id:"$domain", users:{$sum:1}}},
                    {$sort:{users:-1}},
                    {$limit:6}
                ]
            }}
        ];

        const [result] = await aggregate(Trail, pipeline);
        const totals = result.totals[0] || {active:0, mobile:0, passed:0, filtered:0, added_cart:0};

        return statusHandler.newResponse(200, {
            window_minutes:REALTIME_WINDOW_MS / 60000,
            generated_at:new Date().toISOString(),
            active:totals.active,
            mobile:totals.mobile,
            passed:totals.passed,
            filtered:totals.filtered,
            added_cart:totals.added_cart,
            pages:result.pages.filter(row=> row._id).map(row=> ({path:row._id, users:row.users})),
            domains:result.domains.map(row=> ({domain:row._id, users:row.users}))
        });

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const getMetrics = async(start , end, domain, allowed = null)=>{
    try{

        start = new Date(start);
        start.setUTCHours(0, 0, 0, 0);  
            
        end = new Date(end);
        end.setUTCHours(23, 59, 0, 0);

        const query = [
            {
                $match: {
                    createdAt: { $gte: start, $lte:end },
                    ...domainMatch(domain, allowed)
                }
            },
        ];

        const metrics = await aggregate(Event, query);

        return statusHandler.newResponse(200, metrics)

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

module.exports = {
    getAllSessions,
    getSessionsInterval,
    createNewEvent,
    getMetrics,
    pingSession,
    getSummary,
    getRealtime
}