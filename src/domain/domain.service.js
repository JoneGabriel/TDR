const statusHandler = require("../helpers/helpers.statusHandler");
const {
    save,
    findOne,
    findAll,
    findById,
    populate,
    updateById,
    removeOne,
} =require("../query");

const {
    Domain
} = require("./domain.schema");

const {
    isEmpty
} = require("../helpers/helpers.global");

const { storeFilter } = require("../account/account.service");

// `status` truthy = só ativos; `scope` = conta em uso (filtra pelas lojas dela)
const getAllDomains = async(status, scope = null)=>{
    try{
        
        let query = await storeFilter(scope);

        if(!isEmpty(status)){
            query['status'] = true;
        }

        let domains = await findAll(Domain, query);
        domains = await populate(Domain, domains, 'store');
        

        return statusHandler.newResponse(200, domains);

    }catch(error){
        throw(statusHandler.serviceError(error))
    }
};

const createDomain = async(domain)=>{
    try{

        const exist = await findOne(Domain, {domain:domain.domain});

        if(exist){
            throw(statusHandler.newResponse(400, 'Dominio ja cadastrado'));
        }

        await save(Domain, domain);

        return statusHandler.newResponse(200, 'ok');

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const changeStatusDomain = async({id}, {status})=>{
    try{

        await updateById(Domain, id, {status});

        return statusHandler.newResponse(200, 'ok');

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const getDomainById = async({id})=>{
    try{

        const domain = await findById(Domain, id);

        return statusHandler.newResponse(200, domain);

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const changeDomain = async({id}, domain)=>{
    try{    

        await updateById(Domain, id, domain);

        return statusHandler.newResponse(200, "ok");

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
}

// Exclusão definitiva do domínio (nada depende dele além das sessões já gravadas)
const removeDomain = async({id})=>{
    try{

        const domain = await findById(Domain, id);

        if(!domain){
            throw(statusHandler.newResponse(404, "Domínio não encontrado"));
        }

        await removeOne(Domain, id);

        return statusHandler.newResponse(200, "Domínio excluído");

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

module.exports = {
    removeDomain,
    getAllDomains,
    createDomain,
    changeStatusDomain,
    getDomainById,
    changeDomain
};