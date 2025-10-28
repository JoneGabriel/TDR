const router = require("express").Router();
const statusHandler = require("../helpers/helpers.statusHandler");

const {
    createShopify,
    getAllShopify,
    removeStore,
    getShopifyById,
    changeShopify
} = require("./shopify.service");


router.post("/store", async({body}, res)=>{
    try{

        const response = await createShopify(body);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});


router.get("/store", async({}, res)=>{
    try{

        const response = await getAllShopify();

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.get("/store/:id", async({params}, res)=>{
    try{

        const response = await getShopifyById(params);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});


router.put("/store/:id", async({body, params}, res)=>{
    try{

        const response = await changeShopify(params, body);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

module.exports = router;