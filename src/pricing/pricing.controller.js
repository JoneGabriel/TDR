const router = require("express").Router();
const { requireAdminApi } = require("../auth/auth.service");

// atualização do cache de preços por país é ação do painel admin
router.use("/pricing", requireAdminApi);
const statusHandler = require("../helpers/helpers.statusHandler");
const { refreshAllPrices, refreshProductPrices } = require("./pricing.service");

router.post("/pricing/refresh", async(req, res)=>{
    try{

        const result = await refreshAllPrices();

        return res.status(200).send(statusHandler.newResponse(200, result));
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.post("/pricing/refresh/:productId", async({params}, res)=>{
    try{

        const result = await refreshProductPrices(params.productId);

        return res.status(200).send(statusHandler.newResponse(200, result));
    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

module.exports = router;
