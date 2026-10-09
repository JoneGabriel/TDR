const router = require("express").Router();
const { requireAdminApi } = require("../auth/auth.service");
const { assertStore, assertCollection, assertProduct, assertShopify, assertBundle, assertOtherVariant } = require("../account/account.service");

// corpo de produto: loja, coleção e Shopifys citados precisam estar na conta em uso
const assertProductBody = async(scope, body = {})=>{
    body.store && await assertStore(scope, body.store);
    body.collection_ && await assertCollection(scope, body.collection_);

    for(const item of (body.other_shopify || [])){
        item?.store && await assertShopify(scope, item.store);
    }
};

// coleções são do painel admin; em /product só carrinho (/product/cart) e variantes (/product/variant) ficam públicos
router.use("/collection", requireAdminApi);
const statusHandler = require("../helpers/helpers.statusHandler");

const {
    createProduct,
    getAllProducts,
    createCollections,
    getAllCollections,
    getProductByIdForCart,
    getProductById,
    changeProduct,
    removeStore,
    getCollectionById,
    changeCollection,
    changeStatusProduct,
    changeStatusCollection,
    removeBundle,
    getPriceByVariants,
    removeProduct,
    removeCollection
} =require("./product.service");

router.post("/collection", async(req, res)=>{
    try{

        if(req.scope && !req.body.store){
            throw(statusHandler.newResponse(400, "Selecione a loja da coleção"));
        }

        req.body.store && await assertStore(req.scope, req.body.store);

        const response = await createCollections(req.body);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.put("/collection/:id", async(req, res)=>{
    try{

        await assertCollection(req.scope, req.params.id);
        req.body.store && await assertStore(req.scope, req.body.store);

        const response = await changeCollection(req.params, req.body);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.get("/collection", async(req, res)=>{
    try{

        const response = await getAllCollections(true, undefined, req.scope);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.get("/collection/:id", async(req, res)=>{
    try{

        await assertCollection(req.scope, req.params.id);

        const response = await getCollectionById(req.params);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.post("/product", requireAdminApi, async(req, res)=>{
    try{

        await assertProductBody(req.scope, req.body);

        const response = await createProduct(req.body);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.post("/product/cart/:id", async({params, body}, res)=>{
    try{

        const response = await getProductByIdForCart(params, body);

        return res.status(response.status).send(response);

    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.get("/product", requireAdminApi, async(req, res)=>{
    try{

        const response = await getAllProducts(req.scope);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.get("/product/:id", requireAdminApi, async(req, res)=>{
    try{

        await assertProduct(req.scope, req.params.id);

        const response = await getProductById(req.params.id, true);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.post("/product/variant/:id", async({params, body, query}, res)=>{
    try{

        const response = await getPriceByVariants(params, body, query.country);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.put("/product/:id", requireAdminApi, async(req, res)=>{
    try{

        await assertProduct(req.scope, req.params.id);
        await assertProductBody(req.scope, req.body);

        const response = await changeProduct(req.params, req.body);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.delete("/product/store/:id", requireAdminApi, async(req, res)=>{
    try{

        await assertOtherVariant(req.scope, req.params.id);

        const response = await removeStore(req.params);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.put("/product/status/:id", requireAdminApi, async(req, res)=>{
    try{

        await assertProduct(req.scope, req.params.id);

        const response = await changeStatusProduct(req.params, req.body);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.put("/collection/status/:id", async(req, res)=>{
    try{

        await assertCollection(req.scope, req.params.id);

        const response = await changeStatusCollection(req.params, req.body);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.delete("/product/bundle/:id", requireAdminApi, async(req, res)=>{
    try{

        await assertBundle(req.scope, req.params.id);

        const response = await removeBundle(req.params);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

// exclusões definitivas (com confirmação no admin)
router.delete("/product/:id", requireAdminApi, async(req, res)=>{
    try{

        await assertProduct(req.scope, req.params.id);

        const response = await removeProduct(req.params);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.delete("/collection/:id", async(req, res)=>{
    try{

        await assertCollection(req.scope, req.params.id);

        const response = await removeCollection(req.params);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

module.exports = router;
