const router = require("express").Router();
const { requireAdminApi, requireScope } = require("../auth/auth.service");
const { assertIp } = require("../account/account.service");

// todas as rotas do cloacker são do painel admin; a lista branca é por conta
router.use("/cloacker", requireAdminApi);
const statusHandler = require("../helpers/helpers.statusHandler");
const {
    
    getAllIps,
    saveNewIp,
    removeIp
} = require("./cloacker.service");

router.get("/cloacker/white-list", async(req, res)=>{
    try{

        const response = await getAllIps(req.scope);

        return res.status(response.status).send(response);

    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.post("/cloacker/white-list", requireScope, async(req, res)=>{
    try{

        const response = await saveNewIp(req.body, req.scope);

        return res.status(response.status).send(response);

    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.delete("/cloacker/white-list/:id", async(req, res)=>{
    try{

        await assertIp(req.scope, req.params.id);

        const response = await removeIp(req.params);

        return res.status(response.status).send(response);

    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

module.exports = router;
