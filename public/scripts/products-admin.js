const cleanProductFilds = ()=>{
    try{

        $("input,select,textarea").each(function(){
            $(this).val("");
        });

        $("[c-id=form]").find("[c-id=image-list]").html("");
        $("[c-id=form]").find("[c-id=save-product]").removeAttr("id");
        $("[c-id=form]").find("[c-id=all-stores]").html("");
        $("[c-id=form]").find("[c-id=name-product]").text("");


    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const getStores = ()=>{
    try{

        let arrayStores = [];
        const stores = $("[c-id=all-stores]").find("[c-id=model-store]");

        $(stores).each(function(){

            let object = {};
            object["id_shopify_store"] = $(this).find("[c-id=id_shopify_store]").val();
            object["store"] = $(this).attr("id");
            
            arrayStores.push(object);

        });

        return arrayStores;

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const getBodyProduct = async()=>{
    try{

        const ctx = "[c-id=form]"

        let body = {};
       
        body["name"] = $(ctx).find("[c-id=name]").val();
        body["last_price"] = $(ctx).find("[c-id=last_price]").val();
        body["price"] = $(ctx).find("[c-id=price]").val();
       

        body["images"] = getImagesBody();
        //body["lp"] = await getLeadingPage(); 

        const collection = $("[c-id=collection]").val();
        const store = $("[c-id=store-config]").val();

        
        const description = tinymce.get('description').getContent()
        const other_shopify = getStores();

        other_shopify.length && (body["other_shopify"]= other_shopify);

        description && (body["description"] = description);
        collection && (body["collection_"] = collection);
        store && (body["store"] = store);


        return body;

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const listProducts = async()=>{
    try{    

        const products = await request("GET", "/product");

        if(products.status == 200){
            const {content} = products;

            if(content.length){
                
                const ctx = "[c-id=all-products]";

                $(ctx).html("");

                content.forEach(product=>{

                    const {images, name, _id, price, collection_, status} = product;
                    const model = $("[c-id=model-product]").clone()[0];
                    
                    $(model).find("img").attr("src", images?.[0]?.base64 || 'https://gravitec.net/pt/empty.jpg');
                    $(model).find("a").text(name);
                    $(model).find("[c-id=price]").text(`${price} €`);
                    $(model).find("[c-id=collection-product]").text(collection_?.name);
                    $(model).find("[c-id=status]").prop('checked', status);
                    

                    $(model).attr("id", _id);   
                    $(model).removeClass("none");
                    $(ctx).append(model);

                });
            }
        }

    }catch(error){
        statusHandler.messageError(error);
    }
};

const listCollections = async()=>{
    try{

        const collections = await request("GET", "/collection");
        
        if(collections.status == 200){
            const {content} = collections;

            if(content.length){

                const ctx = "[c-id=collection]"

                content.forEach((collection, index)=>{
                    const {status, name, _id} = collection;

                    !index && $(ctx).append(`<option  selected disabled hidden>Escolha uma coleção</option>`)

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

const saveProduct = async(id = false)=>{
    try{

        const body = await getBodyProduct();
        const method = !id ? "POST" : "PUT";
        const url = !id ? `/product` : `/product/${id}`; 

        const response = await request(method, url, body);

        if(response.status == 200){
            statusHandler.newMessage(`Produto ${!id ? "Criado" : "Atualizado"}`);
        }

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const getLeadingPage = async()=>{
    try{

        const file = $("[c-id=form]").find("[c-id=lp]").prop("files");
        
        if(file.length){
            const base64 = await convertFileToBase64(file[0]);
            
            return base64;
        }
        
        return false;

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const getImages = async()=>{
    try{

        const file = $("[c-id=form]").find("[c-id=images]").prop("files");
        
        let imgs = [];

        if(file.length){

            for(i in file){

                if(file[i].size){
                    const base64 = await convertFileToBase64(file[i]);
                    imgs.push(base64);
                }
                
            }
            
        }
        
        return imgs;
    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const listImg = (imgs)=>{
    try{

        imgs.forEach(val => {

            const model = $("[c-id=model-img]").clone()[0];

            $(model).find("img").attr("src", val);
            $(model).removeClass("none");
            $("[c-id=image-list]").append(model);
        });

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const getImagesBody = () =>{
    try{    

        let imgs = [];

        const models = $("[c-id=image-list]").find("[c-id=model-img]");

        $(models).each(function(el){
            const src = $(this).find("img").attr("src");
            imgs.push({base64:src});
        });

        return imgs;

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const listProductInForm = (product)=>{
    try{
        
        cleanProductFilds();
        
        let {images, name, _id, last_price, price, description, collection_, other_shopify, brand, store} = product;
        images = images.map(img=> img.base64);

        other_shopify?.length && other_shopify.forEach(val=>{
            
            addStore(val.store._id, val.store.url, val._id, val.id_shopify);
        });

        listImg(images);
        
        const ctx = "[c-id=form]";

        $(ctx).find("[c-id=name-product]").text(name);
        $(ctx).find("[c-id=name]").val(name);

        $(ctx).find("[c-id=last_price]").val(last_price);
        $(ctx).find("[c-id=price]").val(price);
        $(ctx).find("[c-id=brand]").val(brand);
        $(ctx).find("[c-id=store-config]").val(store);


        $(ctx).find("[c-id=collection]").val(collection_);
        $(ctx).find("[c-id=description]").val(description);
        $(ctx).find("[c-id=save-product]").attr("id", _id);

    }catch(error){
        throw(statusHandler.messageError(error));
    }
}

const loadingAfterOpenModal = (enable) =>{

    if(enable){
        $("html").css({
            "filter": "brightness(0.8)",
            "pointer-events": "none"
        });
        $("[c-id=loading-center]").removeClass("none");
        return;
    }

    $("html").css("filter", "none");
    $("html").css("pointer-events", "auto");
    $("[c-id=loading-center]").addClass("none");


}

const getProductById = async(id)=>{
    try{

        loadingAfterOpenModal(true);
        const response = await request("GET", `/product/${id}`);

        if(response.status == 200){

            listProductInForm(response.content);
        }

        loadingAfterOpenModal(false);

        return response.content.description;

    }catch(error){
        loadingAfterOpenModal(false);
        throw(statusHandler.messageError(error));
    }
};

const listShopifys = async()=>{
    try{

        const stores = await request("GET", "/store");
        
        if(stores.status == 200){
            const {content} = stores;

            if(content.length){

                const ctx = "[c-id=stores]"

                content.forEach((store, index)=>{
                    const {url, _id} = store;

                    !index && $(ctx).append(`<option  selected disabled hidden>Escolha uma coleção</option>`)

                    
                    $(ctx).append(`<option value="${_id}">${url}</option>`);

                    

                });
            }
        }

    }catch(error){

    }
}

const checkExistStore = (val)=>{
    try{

        $($("[c-id=all-stores]").find("[c-id=model-store]")).each(function(){
            const id = $(this).attr("id");
            if(id == val){
                throw(statusHandler.messageError("Loja ja adicionada", true));
            }
        });

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const addStore = (val, text, id = null, id_shopify)=>{
    try{

        if(!val){
            throw(statusHandler.messageError("Selecione uma loja", true));
        }

        checkExistStore(val);
        
        const ctx = "[c-id=all-stores]";
        const model = $("[c-id=model-store]").clone()[0];

        $(model).find("[c-id=url]").text(text);
        $(model).attr("id", val);
        $(model).removeClass("none");

        if(id){
            $(model).find("[c-id=remove-store]").attr("id", id);
            $(model).find("[c-id=id_shopify_store]").val(id_shopify);
        }
        
        $(ctx).append(model);
        

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const removeStore = async(e, id = null)=>{
    try{

        if(!confirm("Deseja remover essa loja? Essa ação é irreversivel")){
            return;
        }

        if(id){
            const remove = await request("DELETE", `/product/store/${id}`);
            
            if(remove.status != 200){
                throw(statusHandler.messageError("Erro ao remover loja", true))
            }
        }

        $(e.currentTarget).closest("[c-id=model-store]").remove();
        statusHandler.newMessage("Loja removida");

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const changeStatusProduct = async(id, checked)=>{
    try{

        const {status} = await request("PUT", `/product/status/${id}`, {status:checked});

        if(status == 200){
            statusHandler.newMessage(`Produto ${checked ? 'ativado' : 'desativado'}`);
            await listProducts();
        }

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const listAllDomains = async(id)=>{
    try{

        const response = await request("GET", `/domain?status=true`);

        if(response.status == 200){
            const ctx = '[c-id=all-links]';

            $(ctx).html("");

            response.content.forEach(value=>{
                const model = $("[c-id=model-link]").clone()[0];
               
                $(model).find('a').text(`https://${value.domain}/products/${id}`)
                $(model).find('a').attr("href",`https://${value.domain}/products/${id}`)
                $(model).removeClass("none");

                $(ctx).append(model);
            });

            $("[c-id=modal-link]").modal("show");
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

document.addEventListener('focusin', function (e) { 
  if (e.target.closest('.tox-tinymce-aux, .moxman-window, .tam-assetmanager-root') !== null) { 
    e.stopImmediatePropagation();
  } 
});

$(document).ready(function(){

 
    listCollections();
    listShopifys();
    listStores();
    
    $("[c-id=new-product]").on("click", ()=>{
        $("[c-id=modal-product]").modal("show");
        tinymce.init({
            selector: 'textarea',  
            menu: {
                happy: { title: 'HTML', items: 'code' }
            },
            plugins: 'code',  
            menubar: 'happy' ,
            
        });
        tinymce.get('description').setContent('');

    });

    $("[c-id=close-modal]").on("click", ()=>{
        try{

            cleanProductFilds();
            $("[c-id=modal-product]").modal("hide");

        }catch(error){
            throw(statusHandler.messageError(error));
        }
    })

    $("[c-id=close-modal-link]").on("click", ()=>{
        $("[c-id=modal-link]").modal("hide");
        
    });

    $("body").on("click", "[c-id=copy]", async(e)=>{
        try{

            const a = $(e.target).prev().attr("href");
            
            await navigator.clipboard.writeText(a);
            statusHandler.newMessage("Texto copiado");

        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("body").on("click", "[c-id=remove-store]", async(e)=>{
        try{

            const id = $(e.currentTarget).attr("id");

            await removeStore(e, id);

        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("[c-id=add-store]").on("click", ()=>{
        try{    

            const val = $("[c-id=form]").find("[c-id=stores]").val();
            const text = $("[c-id=form]").find("[c-id=stores] option:selected").text();

            addStore(val, text);
        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("body").on("click", "[c-id=model-product]", async(e)=>{
        try{

            const id = $(e.currentTarget).attr("id");
            const target = $(e.target).attr("c-id");

            if(target == 'status'){
                const checked = $(e.target).prop("checked");
                return await changeStatusProduct(id, checked);
            }

            if(target == "btn-link"){

                return await listAllDomains(id); 
            }

            const description = await getProductById(id);
            $("[c-id=modal-product]").modal("show");
            tinymce.init({
                selector: 'textarea',  
                menu: {
                    happy: { title: 'HTML', items: 'code' }
                },
                plugins: 'code',  
                menubar: 'happy' ,
                
            });
            tinymce.get('description').setContent(description);


        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("[c-id=image-list]").on("click", "[c-id=remove-img]", (e)=>{
        $(e.currentTarget).closest("[c-id=model-img]").remove();
    });

    $("[c-id=save-product]").on("click", async(e)=>{
        try{

            const id = $(e.target).attr("id");
            $("[c-id=loading-btn]").removeClass("none");
            $(e.target).addClass("none");

            await saveProduct(id);
            cleanProductFilds();
            $("[c-id=loading-btn]").addClass("none");
            $("[c-id=modal-product]").modal("hide");
            $(e.target).removeClass("none");
            loadingAfterOpenModal(true);
            await listProducts();
            loadingAfterOpenModal(false);


        }catch(error){
            $("[c-id=loading-btn]").addClass("none");
            $(e.target).removeClass("none");
            loadingAfterOpenModal(false);
            statusHandler.messageError(error);
        }
    });

    $("[c-id=images]").on("change", async(e)=>{
        try{

            const imgs = await getImages();

            listImg(imgs);

            $(e.target).val('');

        }catch(error){
            statusHandler.messageError(error);
        }
    });

});