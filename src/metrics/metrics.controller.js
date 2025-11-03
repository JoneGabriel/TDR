const {
    getAllSessions,
    getSessionsInterval,
    createNewEvent,
    getMetrics
} = require("./metrics.service");

const router = require("express").Router();
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


router.post("/add-cart", async({body}, res)=>{
    try{    

        const response = await createNewEvent(body, 'add-to-cart')

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.post("/init-checkout", async({body}, res)=>{
    try{    

        const response = await createNewEvent(body, 'init-checkout')

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

module.exports = router;