const { isEmpty } = require("../helpers/helpers.global");
const statusHandler = require("../helpers/helpers.statusHandler")

const {
    aggregate,
    save,
    findOne
} = require("../query");

const {
 Trail
} = require("../trail/trail.schema");

const {
    Event
} = require("./metrics.schema");


const getSessionsInterval = async(start , end, domain)=>{
    try{
        
        start = new Date(start);
        end = new Date(end);
        
        let hours = [{start:0, end:3}, {start:4, end:7}, {start:8, end:11}, {start:12, end:15}, {start:16, end:19}, {start:20, end:23}, {start:23, end:23}];

        let response = []
        
        for(i in hours){

            const {start:startHour, end:endHour} = hours[i];

            start.setUTCHours(startHour, 0, 0, 0);
            end.setUTCHours(endHour, 59, 0, 0)

            let query = [
                {
                    $match: {
                        createdAt: { $gte: start, $lte:end },
                        page: "black",
                        country_code: "FR",
                    }
                },
                {
                    $group: {
                        _id: "$ip" 
                    }
                },
                {
                    $count: "total_ips_unicos" 
                }
            ];

            if(!isEmpty(domain)){
                query[0]['$match']['domain'] = domain;
            }

            const sessions = await aggregate(Trail, query);
           
            response.push([`${startHour}h`, (sessions?.[0]?.total_ips_unicos || 0)]);
        }
        
        return statusHandler.newResponse(200, response);

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const getAllSessions = async(start , end, domain, api = false)=>{
    try{
        
        if(isEmpty(start) && isEmpty(end)){
            start = new Date(Date.now()); 
            start.setHours(0, 0, 0, 0);
            

            end = new Date(Date.now());
            end.setHours(23, 59, 0, 0);

        }else{
            start = new Date(start);
            start.setUTCHours(0, 0, 0, 0);  
            
            end = new Date(end);
            end.setUTCHours(23, 59, 0, 0);
            
        }
        
        let query = [
            {
                $match: {
                    createdAt: { $gte: start, $lte:end },
                    page: "black",
                    country_code: "FR",
                }
            },
            {
                $group: {
                    _id: "$ip" // agrupa por IP (remove duplicados)
                }
            },
            {
                $count: "total_ips_unicos" // conta quantos IPs únicos ficaram
            }
        ];
       
        if(!isEmpty(domain)){
            query[0]['$match']['domain'] = domain;
        }
        
        const sessions = await aggregate(Trail, query);
        

        if(api){
            
            const {content} = await getSessionsInterval(start, end, domain);

            let response = {
                total:(sessions[0]?.total_ips_unicos || 0),
                interval:content
            }

            return statusHandler.newResponse(200, response)
        }

        return statusHandler.newResponse(200, sessions)

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const createNewEvent = async(client, event)=>{
    try{

        const {id} = client;
        const exist = await findOne(Event, {id, type_event:event});

        if(!isEmpty(exist)){

            return statusHandler.newResponse(200, 'ok');
        }

        const nowUTC = new Date();
        const offsetMs = 3 * 60 * 60 * 1000;
        const nowBrazil = new Date(nowUTC.getTime() - offsetMs);

        client['createdAt'] = nowBrazil;
        client['type_event'] = event;

        await save(Event, client);

        return statusHandler.newResponse(200, 'ok');

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const getMetrics = async(start , end)=>{
    try{

        start = new Date(start);
        start.setUTCHours(0, 0, 0, 0);  
            
        end = new Date(end);
        end.setUTCHours(23, 59, 0, 0);

        const query = [
            {
                $match: {
                    createdAt: { $gte: start, $lte:end },
                }
            },
        ];

        const metrics = await aggregate(Event, query);

        return statusHandler.newResponse(200, metrics)

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

module.exports = {
    getAllSessions,
    getSessionsInterval,
    createNewEvent,
    getMetrics
}