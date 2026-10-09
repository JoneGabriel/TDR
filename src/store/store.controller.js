
const {
    createStore,
    getAllStores,
    getStoreById,
    changeStore,
    removeStore,
    getFile,
    changeFile,
    getPolicy,
    changePolicy
} = require("./store.service");
const router = require("express").Router();
const { requireAdminApi } = require("../auth/auth.service");
const { assertStore } = require("../account/account.service");

// todas as rotas de configuração de loja são do painel admin e respeitam a conta em uso (req.scope)
router.use("/store-config", requireAdminApi);
const statusHandler = require("../helpers/helpers.statusHandler");

router.post("/store-config", async(req, res)=>{
    try{    

        const response = await createStore(req.body, req.scope);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.put("/store-config/:id", async(req, res)=>{
    try{    

        await assertStore(req.scope, req.params.id);
        delete req.body.account;   // a conta dona não muda pelo painel

        const response = await changeStore(req.params.id, req.body);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.get("/store-config", async(req, res)=>{
    try{    

        const response = await getAllStores(req.scope);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.get("/store-config/:id", async(req, res)=>{
    try{    

        await assertStore(req.scope, req.params.id);

        const response = await getStoreById(req.params.id);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.get("/store-config/:idStore/:idFile", async(req, res)=>{
    try{    

        await assertStore(req.scope, req.params.idStore);

        const response = await getFile(req.params, req.query.layout);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.put("/store-config/:idStore/:idFile", async(req, res)=>{
    try{    

        await assertStore(req.scope, req.params.idStore);

        const response = await changeFile(req.params, req.body, req.query.layout);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});


// políticas da loja (privacy | shipping | return | terms)
router.get("/store-config/:idStore/policy/:key", async(req, res)=>{
    try{    

        await assertStore(req.scope, req.params.idStore);

        const response = await getPolicy(req.params);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.put("/store-config/:idStore/policy/:key", async(req, res)=>{
    try{    

        await assertStore(req.scope, req.params.idStore);

        const response = await changePolicy(req.params, req.body);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.delete("/store-config/:id", async(req, res)=>{
    try{    

        await assertStore(req.scope, req.params.id);

        const response = await removeStore(req.params.id);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

module.exports = router;
