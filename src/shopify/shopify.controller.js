const router = require("express").Router();
const { requireAdminApi } = require("../auth/auth.service");
const { assertStore, assertShopify } = require("../account/account.service");

// todas as rotas de lojas Shopify são do painel admin e respeitam a conta em uso (req.scope)
router.use("/store", requireAdminApi);
const statusHandler = require("../helpers/helpers.statusHandler");

const {
    createShopify,
    getAllShopify,
    getShopifyById,
    changeShopify,
    removeShopify
} = require("./shopify.service");


router.post("/store", async(req, res)=>{
    try{

        if(req.scope && !req.body.store){
            throw(statusHandler.newResponse(400, "Selecione a loja desta conta Shopify"));
        }

        req.body.store && await assertStore(req.scope, req.body.store);

        const response = await createShopify(req.body);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});


router.get("/store", async(req, res)=>{
    try{

        const response = await getAllShopify(req.scope);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.get("/store/:id", async(req, res)=>{
    try{

        await assertShopify(req.scope, req.params.id);

        const response = await getShopifyById(req.params);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});


router.put("/store/:id", async(req, res)=>{
    try{

        await assertShopify(req.scope, req.params.id);
        req.body.store && await assertStore(req.scope, req.body.store);

        const response = await changeShopify(req.params, req.body);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.delete("/store/:id", async(req, res)=>{
    try{

        await assertShopify(req.scope, req.params.id);

        const response = await removeShopify(req.params);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

module.exports = router;
