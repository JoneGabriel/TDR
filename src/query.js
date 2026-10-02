const mongoose = require('mongoose');
const statusHandler = require("./helpers/helpers.statusHandler");

// URL do banco. Com MONGO_HOST definido (docker-compose), monta a URL a partir de MONGO_USER/MONGO_PASSWORD/MONGO_DB
// escapando usuário e senha (caracteres como @ # : / quebram a URL se forem crus); senão usa URL_DB (Atlas, local).
const dbUrl = ()=>{
    const host = (process.env.MONGO_HOST || "").trim();
    if(!host) return process.env.URL_DB;

    const user = process.env.MONGO_USER || "";
    const password = process.env.MONGO_PASSWORD || "";
    const db = process.env.MONGO_DB || "TDR";
    const port = process.env.MONGO_PORT || "27017";
    const auth = user ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}@` : "";
    const authSource = user ? `?authSource=${encodeURIComponent(process.env.MONGO_AUTH_SOURCE || "admin")}` : "";

    return `mongodb://${auth}${host}:${port}/${db}${authSource}`;
};

const findOne = async(schema, query = {})=>{
    try{

        mongoose.connect(dbUrl());

        return await schema.findOne(query);

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
}

const findById = async(schema, _id, select = null)=>{
    try{

        mongoose.connect(dbUrl());

        return !select ? (await schema.findOne({_id})) : (await schema.findOne({_id}).select(select));
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const save = async(schema, value)=>{
    try{    

        mongoose.connect(dbUrl());

        const insert = new schema(value);

        return await insert.save()

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const findAll = async(schema, query = {}, select = null)=>{
    try{

       await mongoose.connect(dbUrl());

        return select ? (await schema.find(query).select(select)) : (await schema.find(query));

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};


const updateById = async(schema, _id, value)=>{
    try{    

        mongoose.connect(dbUrl());

        const update = await schema.updateOne({_id}, value);

        (!update.acknowledged && !update.modifiedCount)?(()=>{ throw(statusHandler.newResponse(400, `Error updating ${model}`))})():null;

        return true;

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const removeOne = async(schema, _id)=>{
    try{

        mongoose.connect(dbUrl());

        const result = await schema.deleteOne({_id});
       
        return;
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const removeMany = async(schema, query)=>{
    try{

        mongoose.connect(dbUrl());

        const result = await schema.deleteMany(query);

        return result.deletedCount;
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const populate = async(schema, value, populate)=>{
    try{
        mongoose.connect(dbUrl());

        const result = await schema.populate(value, populate);

        return result;
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const countDocuments = async(schema, query = {})=>{
    try{
     
        await mongoose.connect(dbUrl());

        return await schema.countDocuments(query)

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const aggregate = async(schema, query)=>{
    try{

        await mongoose.connect(dbUrl());
        
        const result = await schema.aggregate(query);

        return result;
    }catch(error){
       
        throw(statusHandler.serviceError(error));
    }
};

module.exports = {
    dbUrl,
    save,
    findById,
    findAll,
    updateById,
    findOne,
    removeOne,
    removeMany,
    populate,
    countDocuments,
    aggregate
};