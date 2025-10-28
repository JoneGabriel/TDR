class statusHandler {

    constructor(message){
        this.message = message;
    }

    static newMessage(newMessage){
        const {message:msg} = new statusHandler(newMessage);

        return $.notify(msg, "success"); 
    };

    static messageError(newError, error){
        console.log(newError);

        if(error){
            const {message:msg} = new statusHandler(newError);

            return $.notify(msg, "error");
        }
    };
};