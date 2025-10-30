




const cleanDomainFilds = ()=>{
    try{

        $("input,select,textarea").each(function(){
            $(this).val("");
        });

        $("[c-id=form]").find("[c-id=save-domain]").removeAttr("id");

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};



const listAllDomains = async()=>{
    try{

         const collections = await request("GET", "/domain");

        if(collections.status == 200){
            const {content} = collections;

            if(content.length){
                
                const ctx = "[c-id=all-domain]";

                $(ctx).html("");

                content.forEach(info=>{
                    const {domain, _id, status, store} = info;
                    const model = $("[c-id=model-domain]").clone()[0];

                    $(model).find("[c-id=domain]").text(domain);
                    $(model).find("[c-id=name-store]").text(store.name);

                    $(model).find("[c-id=status]").prop('checked', status);
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


const saveDomain = async(id=false)=>{
    try{

        let body = {};
        body["domain"] = $('[c-id=form]').find("[c-id=domain]").val();
        body["store"] = $('[c-id=form]').find("[c-id=store-config]").val();


        if(!body["domain"] || !body["store"]){
            throw(statusHandler.messageError("Campo dominio e loja não pode ser vazio", true));
        }


        const method = !id ? "POST" : "PUT";
        const url = !id ? `/domain` : `/domain/${id}`; 

        const response = await request(method, url, body);

        if(response.status == 200){
            statusHandler.newMessage(`Dominio ${!id ? "cadastrado" : "atualizado"}`);
            cleanDomainFilds();
            await listAllDomains()
            
            return;
        }

        throw(statusHandler.messageError(response.content, true));

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};


const changeStatusDomain = async(id, checked)=>{
    try{

        const {status} = await request("PUT", `/domain/status/${id}`, {status:checked});

        if(status == 200){
            statusHandler.newMessage(`Dominio ${checked ? 'ativado' : 'desativado'}`);
            await listAllDomains();
        }

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const listStores = async()=>{
    try{

        const stores = await request("GET", "/store-config");
        
        if(stores.status == 200){
            const {content} = stores;

            if(content.length){

                const ctx = "[c-id=store-config]"

                content.forEach((store, index)=>{
                    const {status, name, _id} = store;

                    !index && $(ctx).append(`<option  selected disabled hidden>Escolha uma Loja</option>`)

                    if(status){
                        $(ctx).append(`<option value="${_id}">${name}</option>`);

                    }

                });
            }
        }

    }catch(error){
        statusHandler.messageError(error);
    }
};


const listDomainInForm = (filds)=>{
    try{
        
        cleanDomainFilds();
        
        let { domain, _id, store} = filds;
        
        const ctx = "[c-id=modal-domain]";

        $(ctx).find("[c-id=domain]").val(domain);
        $(ctx).find("[c-id=store-config]").val(store);


        $(ctx).find("[c-id=save-domain]").attr("id", _id);

    }catch(error){
        throw(statusHandler.messageError(error));
    }
}

const getDomainById = async(id)=>{
    try{

        const response = await request("GET", `/domain/${id}`);

        if(response.status == 200){

            listDomainInForm(response.content);
        }

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

$(document).ready(function(){

    listStores();

    $("body").on("click", "[c-id=model-domain]", async(e)=>{
        try{

            const id = $(e.currentTarget).attr("id");
            const target = $(e.target).attr("c-id");

            if(target == 'status'){
                const checked = $(e.target).prop("checked");
                return await changeStatusDomain(id, checked);
            }

            await getDomainById(id);
            $("[c-id=modal-domain]").modal("show");

        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("[c-id=save-domain]").on("click", async(e)=>{
        try{

            const id = $(e.target).attr("id");
            const target = $(e.target).attr("c-id");

            if(target == 'status'){
                const checked = $(e.target).prop("checked");
                return await changeStatusDomain(id, checked);
            }

            await saveDomain(id);
            $("[c-id=modal-domain]").modal("hide");

        }catch(error){
            statusHandler.messageError(error);
        }
    });


    $("[c-id=new-domain]").on("click", ()=>{
        cleanDomainFilds();
        $("[c-id=modal-domain]").modal("show");
    });

    $("[c-id=close-modal]").on("click", ()=>{
        try{

            cleanDomainFilds();
            $("[c-id=modal-domain]").modal("hide");

        }catch(error){
            throw(statusHandler.messageError(error));
        }
    });
    
});