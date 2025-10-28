class statusHandler {
    constructor(status, content){
        this.status = status;
        this.content = content;
    }

    static newResponse(status, content){
        
        return new statusHandler(status, content);
    };

    static serviceError(error){
        error.status !== 401 && error.status !== 500  ? console.warn('\x1b[33m%s\x1b[0m', error) : console.warn('\x1b[33m%s\x1b[0m', error);

        return error.status ? error : new statusHandler(500, "Internal Error");
    };

    static responseError (error, res){
        error.status !== 401 && error.status !== 500  ? console.warn('\x1b[33m%s\x1b[0m', error) : console.warn('\x1b[33m%s\x1b[0m', error);

        return error.status ? res.status(error.status).send(error) : res.status(500).send({status:500, content:"Internal Error"});
    }

};

module.exports = statusHandler;