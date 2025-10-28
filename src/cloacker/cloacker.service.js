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
const { findOne, updateById, save, findAll } = require('../query');
const { isEmpty } = require('../helpers/helpers.global');


const saveNewIp = async(body)=>{
    try{

        const exist = await findOne(WhiteList, {ip:body.ip})
        
        if(!isEmpty(exist)){
            throw(statusHandler.newResponse(400, 'Ip ja cadastrado'));
        }

        const nowUTC = new Date();
        const offsetMs = 3 * 60 * 60 * 1000; // 3 horas em milissegundos
        const nowBrazil = new Date(nowUTC.getTime() - offsetMs);

        body['createdAt'] = nowBrazil;
        await save(WhiteList, body);

        return statusHandler.newResponse(200, 'ok');

    }catch(error){
        throw(statusHandler.serviceError(error))
    }
};

const getAllIps = async()=>{
    try{

        let ips = await findAll(WhiteList);
        ips = ips.map(value=>{

            const {ip, createdAt} = value;
            const date = new Date(createdAt);
            const day = (date.getDate()+"").length == 1 ? `0${date.getDate()}` : date.getDate();
            const month = ((date.getMonth()+1)+"").length == 1 ? `0${date.getMonth()+1}` : date.getMonth()+1;

            return {
                ip,
                createdAt:`${day}/${month}/${date.getFullYear()}`
            }

        });

        return statusHandler.newResponse(200, ips);

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

module.exports = { 
    useragent, 
    getAllIps,
    saveNewIp
};