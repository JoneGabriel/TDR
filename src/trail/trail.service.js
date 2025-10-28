const { WhiteList } = require("../cloacker/cloacker.schema");
const {
    request,
    isEmpty
} = require("../helpers/helpers.global");
    
const statusHandler = require("../helpers/helpers.statusHandler");

const {
    save,
    findOne,
    findAll,
} = require("../query");

const {
    Trail
} = require("./trail.schema");

const getInfosAboutIp = async(ip)=>{
    try{

        const url = `http://ipwhois.pro/${ip}?key=m913msTC0Ib1BXF0&security=1`
        const response = await request("GET", url);

        if(response.success){

            return {
                country: response.country,
                city: response.city,
                region: response.region,
                country_code: response.country_code,
                org: response.connection?.org,
                proxy:response.security?.proxy,
                vpn:response.security?.vpn,
                hosting:response.security?.hosting,
            }
        }

        return null;

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const checkSession = async(ip)=>{
    try{

        const offsetMs = 3 * 60 * 60 * 1000; 
        const nowBrazil = Date.now() - offsetMs;
        const twoMinutesAgoBrazil = new Date(nowBrazil - 2 * 60 * 1000);

        const exist = await findOne(Trail, {
            ip,
            createdAt: { $gt: twoMinutesAgoBrazil }
        })

        return exist;

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const saveSession = async(req, country = [])=>{
    try{

        const whiteList = await findAll(WhiteList, {
            $or: [
                { ip: req.ip },
                { ip: req.connection.remoteAddress }
            ]
        });

    
        if(whiteList.length || process.env.ENV == "DEV"){
            return true;
        }

    

        let object = {};

        object["domain"] = req.headers.host;
        object["isMobile"] = req.useragent.isMobile;
        object["browser"] = req.useragent.browser;
        object["os"] = req.useragent.os;
        object["cookies"] = req.headers.cookie;
        object["language"] = req.headers['accept-language'];
        object["last_page"] = req.headers['referer'];
        object["ip"] = req.ip || req.connection.remoteAddress;

        const nowUTC = new Date();
        const offsetMs = 3 * 60 * 60 * 1000; // 3 horas em milissegundos
        const nowBrazil = new Date(nowUTC.getTime() - offsetMs);

        object["createdAt"] = nowBrazil;

        const location = await getInfosAboutIp(object["ip"]);

        if(!isEmpty(location)){
            object  = {
                ...object,
                ...location
            };
        }
        
        const regex = /google\s*l+\.?l+\.?c+/i;

        const conditionCountry =  !(country.find(val=> val == object["country_code"]));
        const conditionSecurity = object.proxy || object.vpn || object.hosting || !object["isMobile"] || regex.test(object.org);

        (conditionCountry || conditionSecurity) ? (object['page'] = 'white') : (object['page'] = 'black')

        const check = await checkSession(object["ip"]);
        
        if(!check){
            await save(Trail, object);
        }


        if(conditionCountry || conditionSecurity){

            return false
        }


        return true;

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

module.exports = {
    saveSession
};