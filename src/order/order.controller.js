const router = require("express").Router();
const { rateLimit } = require("../helpers/helpers.ratelimit");

// rotas públicas da página do pedido: chat usa a OpenAI, rastreio usa o 17TRACK e o formulário grava no banco
const chatLimiter = rateLimit({name:"order-chat", windowMs:5 * 60 * 1000, max:30, methods:["POST"], message:"Muitas mensagens em pouco tempo. Aguarde alguns minutos."});
const trackingLimiter = rateLimit({name:"order-tracking", windowMs:60 * 1000, max:20});
const chargeLimiter = rateLimit({name:"order-charge", windowMs:10 * 60 * 1000, max:10, methods:["POST"]});
const statusHandler = require("../helpers/helpers.statusHandler");
const { getConfigStore } = require("../store/store.service");
const { getCountry } = require("../trail/trail.service");
const {
    createTextGpt,
    saveChange,
    getChat,
    sendChat,
    getLiveTracking
} = require("./order.service");

router.get("/order/support/:idOrder", async(req, res)=>{
    try{
        
        const config = await getConfigStore(req.get('host'), 'domain');
        const country =config.country[0];

        const response = await createTextGpt(req.params.idOrder, req.query, country, config);

        return res.status(response.status).send(response);

    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.post("/order/charge", chargeLimiter, async({body, ip, connection}, res)=>{
    try{

        // só os campos do formulário, com tamanho limitado (rota pública: nada do corpo vai direto para o banco)
        const text = (value, max)=> String(value || "").trim().slice(0, max);
        const charge = {
            idOrder:text(body?.idOrder, 64),
            email:text(body?.email, 200),
            justification:text(body?.justification, 5000),
            images:(Array.isArray(body?.images) ? body.images : []).slice(0, 5).filter(image=> typeof image == "string" && image.startsWith("data:image/") && image.length <= 2 * 1024 * 1024)
        };

        if(!charge.idOrder || !charge.email || !charge.justification){
            throw(statusHandler.newResponse(400, "Informe pedido, e-mail e descrição do problema"));
        }

        const ip_ = ip || connection.remoteAddress
        const country = await getCountry(ip_)
        const response = await saveChange(charge, country);

        return res.status(response.status).send(response);

    }catch(error){

        return statusHandler.responseError(error, res);
    }
});


// chat de suporte do pedido (vitrine): histórico/saudação e envio de mensagem
router.get("/order/chat/:idOrder", async(req, res)=>{
    try{

        const config = await getConfigStore(req.get('host'), 'domain');
        const response = await getChat(req.params.idOrder, req.query, config);

        return res.status(response.status).send(response);

    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

// rastreio ao vivo (17TRACK) dos códigos do pedido; público como o chat. ?refresh=1 força nova consulta
router.get("/order/tracking/:idOrder", trackingLimiter, async(req, res)=>{
    try{

        const config = await getConfigStore(req.get('host'), 'domain');
        const response = await getLiveTracking(req.params.idOrder, {urlStore:req.query.urlStore, refresh:req.query.refresh == "1"}, config);

        return res.status(response.status).send(response);

    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.post("/order/chat/:idOrder", chatLimiter, async(req, res)=>{
    try{

        const config = await getConfigStore(req.get('host'), 'domain');
        config.domain = req.get('host');
        const response = await sendChat(req.params.idOrder, {...req.body, visitor:req.cookies?.tdr_vid}, config);

        return res.status(response.status).send(response);

    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

module.exports = router;