/*
const gen = async()=>{
    try{

        const response = await request("POST", `/cloacker/new-white`);

        if(response.status == 200){
            statusHandler.newMessage("Layout gerado com sucesso");
        }

    }catch(error){
        throw(statusHandler.messageError(error));
    }
}
 */

const cleanIpFilds = ()=>{
    try{

        $("input,select,textarea").each(function(){
            $(this).val("");
        });




    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const listAllIps = async()=>{
    try{

         const collections = await request("GET", "/cloacker/white-list");

        if(collections.status == 200){
            const {content} = collections;

            if(content.length){
                
                const ctx = "[c-id=all-ip]";

                $(ctx).html("");

                content.forEach(info=>{
                    const {ip, _id, createdAt} = info;
                    const model = $("[c-id=model-ip]").clone()[0];

                    $(model).find("[c-id=createdAt]").text(createdAt);
                    $(model).find("[c-id=ip]").text(ip);
                    $(model).attr("id", _id);
                    
                    $(model).removeClass("none");
                    $(ctx).append(model);
                });
            }
        }

    }catch(error){
        throw(statusHandler.messageError(error));
    }
}

const saveIp = async(id=false)=>{
    try{

        let body = {};
        body["ip"] = $('[c-id=form]').find("[c-id=ip]").val();


        const method = !id ? "POST" : "PUT";
        const url = !id ? `/cloacker/white-list` : `/cloacker/white-list/${id}`; 

        const response = await request(method, url, body);

        if(response.status == 200){
            statusHandler.newMessage(`Ip ${!id ? "Cadastrado" : "Atualizado"}`);
            cleanIpFilds();
            await listAllIps()
        }

    }catch(error){
        throw(statusHandler.messageError(error));
    }
}



$(document).ready(function(){

    $("[c-id=save-ip]").on("click", async(e)=>{
        try{

            const id = $(e.target).attr("id");

            await saveIp(id);
            $("[c-id=modal-ip]").modal("hide");

        }catch(error){
            statusHandler.messageError(error);
        }
    });


    $("[c-id=new-ip]").on("click", ()=>{
        $("[c-id=modal-ip]").modal("show");
    });

    $("[c-id=close-modal]").on("click", ()=>{
        try{

            cleanIpFilds();
            $("[c-id=modal-ip]").modal("hide");

        }catch(error){
            throw(statusHandler.messageError(error));
        }
    });

    /*
    $("[c-id=gen]").on("click", async(e)=>{
        try{    

            $(e.target).addClass("none");
            $("[c-id=message]").find("div").removeClass("none");
            $("[c-id=message]").find("h4").removeClass("none");
            await gen();
            $("[c-id=message]").find("div").addClass("none");
            $("[c-id=message]").find("h4").addClass("none");
            $(e.target).removeClass("none");

        }catch(error){
            statusHandler.messageError(error);
        }
    });
    */
    
});