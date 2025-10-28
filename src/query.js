const mongoose = require('mongoose');
const statusHandler = require("./helpers/helpers.statusHandler");

const findOne = async(schema, query = {})=>{
    try{

        mongoose.connect(process.env.URL_DB);

        return await schema.findOne(query);

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
}

const findById = async(schema, _id, select = null)=>{
    try{

        mongoose.connect(process.env.URL_DB);

        return !select ? (await schema.findOne({_id})) : (await schema.findOne({_id}).select(select));
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const save = async(schema, value)=>{
    try{    

        mongoose.connect(process.env.URL_DB);

        const insert = new schema(value);

        return await insert.save()

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const findAll = async(schema, query = {}, select = null)=>{
    try{

       await mongoose.connect(process.env.URL_DB);

        return select ? (await schema.find(query).select(select)) : (await schema.find(query));

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};


const updateById = async(schema, _id, value)=>{
    try{    

        mongoose.connect(process.env.URL_DB);

        const update = await schema.updateOne({_id}, value);

        (!update.acknowledged && !update.modifiedCount)?(()=>{ throw(statusHandler.newResponse(400, `Error updating ${model}`))})():null;

        return true;

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const removeOne = async(schema, _id)=>{
    try{

        mongoose.connect(process.env.URL_DB);

        const result = await schema.deleteOne({_id});
       
        return;
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const populate = async(schema, value, populate)=>{
    try{
        mongoose.connect(process.env.URL_DB);

        const result = await schema.populate(value, populate);

        return result;
    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const countDocuments = async(schema, query = {})=>{
    try{
     
        await mongoose.connect(process.env.URL_DB);

        return await schema.countDocuments(query)

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const aggregate = async(schema, query)=>{
    try{

        await mongoose.connect(process.env.URL_DB);
        
        const result = await schema.aggregate(query);

        return result;
    }catch(error){
       
        throw(statusHandler.serviceError(error));
    }
};

module.exports = {
    save,
    findById,
    findAll,
    updateById,
    findOne,
    removeOne,
    populate,
    countDocuments,
    aggregate
};