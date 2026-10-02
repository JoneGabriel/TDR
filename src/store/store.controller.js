
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

// todas as rotas de configuração de loja são do painel admin
router.use("/store-config", requireAdminApi);
const statusHandler = require("../helpers/helpers.statusHandler");

router.post("/store-config", async({body}, res)=>{
    try{    

        const response = await createStore(body);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.put("/store-config/:id", async({body, params}, res)=>{
    try{    

        const response = await changeStore(params.id, body);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.get("/store-config", async(req, res)=>{
    try{    

        const response = await getAllStores();

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.get("/store-config/:id", async({params}, res)=>{
    try{    

        const response = await getStoreById(params.id);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.get("/store-config/:idStore/:idFile", async({params, query}, res)=>{
    try{    

        const response = await getFile(params, query.layout);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.put("/store-config/:idStore/:idFile", async({params, body, query}, res)=>{
    try{    

        const response = await changeFile(params, body, query.layout);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});


// políticas da loja (privacy | shipping | return | terms)
router.get("/store-config/:idStore/policy/:key", async({params}, res)=>{
    try{    

        const response = await getPolicy(params);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.put("/store-config/:idStore/policy/:key", async({params, body}, res)=>{
    try{    

        const response = await changePolicy(params, body);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.delete("/store-config/:id", async({params}, res)=>{
    try{    

        const response = await removeStore(params.id);

        return res.status(response.status).send(response);
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

module.exports = router;
