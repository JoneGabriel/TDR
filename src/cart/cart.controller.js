const router = require("express").Router();
const statusHandler = require("../helpers/helpers.statusHandler");
const {
 getInfoProducts
} = require("./cart.service");

router.post("/checkout", async({body}, res)=>{
    try{

        const response = await getInfoProducts(body);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

module.exports = router;