const router = require("express").Router();
const statusHandler = require("../helpers/helpers.statusHandler");
const { getConfigStore } = require("../store/store.service");
const { getCountry } = require("../trail/trail.service");
const {
    createTextGpt,
    saveChange
} = require("./order.service");

router.get("/order/support/:idOrder", async(req, res)=>{
    try{
        
        const config = await getConfigStore(req.get('host'), 'domain');
        const country =config.country[0];

        const response = await createTextGpt(req.params.idOrder, req.query, country);

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