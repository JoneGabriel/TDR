const getShopify = ()=>{
    try{

        const ctx = "[c-id=form]";

        const url = $(ctx).find("[c-id=url]").val();
        const token_storefront = $(ctx).find("[c-id=token_storefront]").val();
        const token_admin = $(ctx).find("[c-id=token_admin]").val();
        const store = $("[c-id=store-config]").val();


        return {
            url,
            token_storefront,
            token_admin,
            store
        };

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const listShopify = async()=>{
    try{


        const stores = await request("GET", "/store");

        if(stores.status == 200){

            const {content} = stores;

            if(content.length){
                const ctx = "[c-id=all-store]";
                $(ctx).html("");

                content.forEach(store=>{

                    const model = $("[c-id=model-store]").clone()[0];

                    $(model).attr("id", store._id);
                    $(model).find("a").text(store.url);
                    $(model).find("[c-id=storefront]").text(store.token_storefront);
                    $(model).find("[c-id=admin]").text(store.token_admin);
                    $(model).removeClass("none");
                    $(ctx).append(model);
                });
            }
        }

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const cleanShopifyFilds = ()=>{
    try{

        $("input,select,textarea").each(function(){
            $(this).val("");
        });

        $("[c-id=form]").find("[c-id=name-store]").text("");
        $("[c-id=form]").find("[c-id=save-store]").removeAttr("id");

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const saveShopify = async(id = false)=>{
    try{

        const body = getShopify();
        const method = !id ? "POST" : "PUT";
        const url = !id ? `/store` : `/store/${id}`; 

        const response = await request(method, url, body);

        if(response.status == 200){
            cleanShopifyFilds();
            statusHandler.newMessage(`Shopify ${!id ? "Criada" : "Shopify"}`);
            await listShopify();
        }

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const listShopifyInForm = (shopify)=>{
    try{
        
        cleanShopifyFilds();
        
        let {url, token_storefront, token_admin, _id, store} = shopify;
        
        const ctx = "[c-id=modal-store]";

        $(ctx).find("[c-id=name-store]").text(url);
        $(ctx).find("[c-id=url]").val(url);

        $(ctx).find("[c-id=token_storefront]").val(token_storefront);
        $(ctx).find("[c-id=token_admin]").val(token_admin);
        $(ctx).find("[c-id=store-config]").val(store);



        $(ctx).find("[c-id=save-store]").attr("id", _id);

    }catch(error){
        throw(statusHandler.messageError(error));
    }
}

const getShopifyById = async(id)=>{
    try{

        const response = await request("GET", `/store/${id}`);

        if(response.status == 200){

            listShopifyInForm(response.content);
        }

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const listShopifyConfig = async()=>{
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


$(document).ready(function(){

    listShopifyConfig();


    $("[c-id=save-store]").on("click", async(e)=>{
        try{

            const id = $(e.target).attr("id");

            await saveShopify(id);
            $("[c-id=modal-store]").modal("hide");

        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("[c-id=new-store]").on("click", ()=>{
        $("[c-id=modal-store]").modal("show");
    });


    $("[c-id=close-modal]").on("click", ()=>{
        try{

            cleanShopifyFilds();
            $("[c-id=modal-store]").modal("hide");

        }catch(error){
            throw(statusHandler.messageError(error));
        }
    });

    $("body").on("click", "[c-id=model-store]", async(e)=>{
        try{

            const id = $(e.currentTarget).attr("id");

            await getShopifyById(id);
            $("[c-id=modal-store]").modal("show");

        }catch(error){
            statusHandler.messageError(error);
        }
    });
});