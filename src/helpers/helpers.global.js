const axios = require('axios');

const isEmptyObject = (obj)=>{
    try{

        if(typeof obj !== "object" ){
            return true;
        }

        for (const prop in obj) {
            if (Object.hasOwn(obj, prop)) {
              return false;
            }
          }
        
          return true;
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const isEmpty = (value)=> value === null || value === undefined || value === NaN || value === "undefined" || value === "null" || value === "" || (()=>{ return typeof value == "object" ? isEmptyObject(value): false;})();

const request = async(method, url, data = null, headers = {})=>{
    try{

        headers["Content-Type"] = "application/json";

        const options = !!data ? {
            method,
            data:JSON.stringify(data),
            headers,
            responseType: 'json',
            url
        } : {
            method,
            headers,
            responseType: 'json',
            url
        };
        
        const response = await axios(options);
       
        return response.data;   
    }catch(error){
        console.log(error)
        return error?.response?.data ? error?.response?.data  : {status:500, content:"Internal Error"};
    }
};

module.exports = {
    isEmpty,
    request
};