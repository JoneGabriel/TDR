const {
    getAllSessions,
    getSessionsInterval,
    createNewEvent,
    getMetrics,
    pingSession,
    getSummary,
    getRealtime
} = require("./metrics.service");

const router = require("express").Router();
const { requireAdminApi } = require("../auth/auth.service");

// leituras do painel exigem admin; /add-cart, /init-checkout e /heartbeat são enviados pela vitrine
router.use(["/session", "/metrics"], requireAdminApi);
const statusHandler = require("../helpers/helpers.statusHandler");


router.get("/session", async({query}, res)=>{
    try{

        const response = await getAllSessions(query.start, query.end, query.domain, true);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.get("/session/interval", async({query}, res)=>{
    try{

        const response = await getSessionsInterval(query.start, query.end);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});


router.post("/add-cart", async(req, res)=>{
    const {body} = req;
    try{    

        const response = await createNewEvent(body, 'add-to-cart', req)

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.post("/init-checkout", async(req, res)=>{
    const {body} = req;
    try{    

        const response = await createNewEvent(body, 'init-checkout', req)

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});


router.get("/metrics", async({query}, res)=>{
    try{

        const response = await getMetrics(query.start, query.end, query.domain);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

// heartbeat público da vitrine (fora do prefixo /session para não exigir admin)
router.post("/heartbeat", async(req, res)=>{
    try{

        const response = await pingSession(req, req.body);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

// painel: resumo do período e usuários em tempo real
router.get("/metrics/summary", async({query}, res)=>{
    try{

        const response = await getSummary(query.start, query.end, query.domain);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.get("/metrics/realtime", async({query}, res)=>{
    try{

        const response = await getRealtime(query.domain);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

module.exports = router;