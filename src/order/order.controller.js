const router = require("express").Router();
const statusHandler = require("../helpers/helpers.statusHandler");
const { getCountry } = require("../trail/trail.service");
const {
    createTextGpt,
    saveChange
} = require("./order.service");

router.get("/order/support/:idOrder", async({params, query, ip, connection}, res)=>{
    try{
        
        const ip_ = ip || connection.remoteAddress
        const country = await getCountry(ip_);
        const response = await createTextGpt(params.idOrder, query, country);

        return res.status(response.status).send(response);

    }catch(error){

        return statusHandler.responseError(error, res);
    }
});

router.post("/order/charge", async({body, ip, connection}, res)=>{
    try{

        const ip_ = ip || connection.remoteAddress
        const country = await getCountry(ip_)
        const response = await saveChange(body, country);

        return res.status(response.status).send(response);

    }catch(error){

        return statusHandler.responseError(error, res);
    }
});


module.exports = router;