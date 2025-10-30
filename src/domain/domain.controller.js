const {
    getAllDomains,
    createDomain,
    changeStatusDomain,
    getDomainById,
    changeDomain
} = require("./domain.service");

const router = require("express").Router();
const statusHandler = require("../helpers/helpers.statusHandler");

router.post("/domain", async({body}, res)=>{
    try{

        const response = await createDomain(body);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.put("/domain/:id", async({body, params}, res)=>{
    try{

        const response = await changeDomain(params, body);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.get("/domain", async({query}, res)=>{
    try{

        const response = await getAllDomains(query);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

router.get("/domain/:id", async({params}, res)=>{
    try{

        const response = await getDomainById(params);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});


router.put("/domain/status/:id", async({body, params}, res)=>{
    try{

        const response = await changeStatusDomain(params, body);

        return res.status(response.status).send(response);
    }catch(error){  

        return statusHandler.responseError(error, res);
    }
});

module.exports = router;