const router = require("express").Router();
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
    removeBundle
} =require("./product.service");

router.post("/collection", async({body}, res)=>{
    try{

        const response = await createCollections(body);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.put("/collection/:id", async({params, body}, res)=>{
    try{

        const response = await changeCollection(params, body);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.get("/collection", async({}, res)=>{
    try{

        const response = await getAllCollections();

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.get("/collection/:id", async({params}, res)=>{
    try{

        const response = await getCollectionById(params);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.post("/product", async({body}, res)=>{
    try{

        const response = await createProduct(body);

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

router.get("/product", async({body}, res)=>{
    try{

        const response = await getAllProducts();

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.get("/product/:id", async({params}, res)=>{
    try{

        const response = await getProductById(params.id, true);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.put("/product/:id", async({params, body}, res)=>{
    try{

        const response = await changeProduct(params, body);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.delete("/product/store/:id", async({params}, res)=>{
    try{

        const response = await removeStore(params);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.put("/product/status/:id", async({params, body}, res)=>{
    try{

        const response = await changeStatusProduct(params, body);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.put("/collection/status/:id", async({params, body}, res)=>{
    try{

        const response = await changeStatusCollection(params, body);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.delete("/product/bundle/:id", async({params}, res)=>{
    try{

        const response = await removeBundle(params);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

module.exports = router;
