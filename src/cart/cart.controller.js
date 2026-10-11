const router = require("express").Router();
const statusHandler = require("../helpers/helpers.statusHandler");
const { rateLimit } = require("../helpers/helpers.ratelimit");

// checkout cria carrinhos na Shopify: limite por IP contra abuso
const checkoutLimiter = rateLimit({name:"checkout", windowMs:60 * 1000, max:30, methods:["POST"]});
const {
 getInfoProducts,
 getInfoProductsNew,
 buildCartJson
} = require("./cart.service");

router.post("/checkout", checkoutLimiter, async({body, query}, res)=>{
    try{

        const response = await getInfoProducts(body, query.country);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});


// carrinho local no formato do /cart.js da Shopify, para o checkout externo (public/scripts/pag-checkout.js)
router.post("/checkout/cart-json", checkoutLimiter, async({body, query}, res)=>{
    try{

        const response = await buildCartJson(body, query.country);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.post("/checkout/pagou", checkoutLimiter, async({body}, res)=>{
    try{

        const response = await getInfoProductsNew(body);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

module.exports = router;