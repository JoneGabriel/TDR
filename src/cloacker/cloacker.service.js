const useragent = require('express-useragent');
const {isbot} = require('isbot'); 
const axios = require('axios');
const ipRangeCheck = require('ip-range-check');
const path = require('path');
const relativePath =  path.resolve(`${__dirname}/../`);
const {OpenAI} = require("openai")

const {
    saveSession
} = require("../trail/trail.service");

const {
    WhitePage,
    WhiteList
} = require("./cloacker.schema");
const statusHandler = require('../helpers/helpers.statusHandler');
const { findOne, updateById, save, findAll, findById, removeOne } = require('../query');
const { isEmpty } = require('../helpers/helpers.global');


// lista branca por conta: o IP só libera o cloaker nas lojas da própria conta
const saveNewIp = async(body, account)=>{
    try{

        const exist = await findOne(WhiteList, {ip:body.ip, account})
        
        if(!isEmpty(exist)){
            throw(statusHandler.newResponse(400, 'Ip ja cadastrado'));
        }

        const nowUTC = new Date();
        const offsetMs = 3 * 60 * 60 * 1000; // 3 horas em milissegundos
        const nowBrazil = new Date(nowUTC.getTime() - offsetMs);

        body['createdAt'] = nowBrazil;
        body['account'] = account;
        const saved = await save(WhiteList, body);

        return statusHandler.newResponse(200, {_id:saved?._id, message:"ok"});

    }catch(error){
        throw(statusHandler.serviceError(error))
    }
};

const getAllIps = async(scope = null)=>{
    try{

        let ips = await findAll(WhiteList, scope ? {account:scope} : {});
        ips = ips.map(value=>{

            const {_id, ip, createdAt} = value;
            const date = new Date(createdAt);
            const day = (date.getDate()+"").length == 1 ? `0${date.getDate()}` : date.getDate();
            const month = ((date.getMonth()+1)+"").length == 1 ? `0${date.getMonth()+1}` : date.getMonth()+1;

            // _id é necessário para editar/excluir a linha no admin
            return {
                _id,
                ip,
                createdAt:`${day}/${month}/${date.getFullYear()}`
            }

        });

        return statusHandler.newResponse(200, ips);

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// Exclusão definitiva de um IP da white list
const removeIp = async({id})=>{
    try{

        const ip = await findById(WhiteList, id);

        if(!ip){
            throw(statusHandler.newResponse(404, "IP não encontrado"));
        }

        await removeOne(WhiteList, id);

        return statusHandler.newResponse(200, "IP excluído");

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

module.exports = { 
    removeIp,
    useragent, 
    getAllIps,
    saveNewIp
};