
const listAllCollections = async()=>{
    try{    

        const collections = await request("GET", "/collection");

        if(collections.status == 200){
            const {content} = collections;

            if(content.length){
                
                const ctx = "[c-id=all-collection]";

                $(ctx).html("");

                content.forEach(collection=>{
                    const {name, image, products, _id, status} = collection;
                    const model = $("[c-id=model-collection]").clone()[0];

                    $(model).find("a").text(name);
                    $(model).find("[c-id=collection-product]").text(products);
                    $(model).attr("id", _id)

                    image ? $(model).find("img").attr("src", image) : $(model).find("img").attr("src", 'https://gravitec.net/pt/empty.jpg')
                    $(model).find("[c-id=status]").prop('checked', status);

                    $(model).removeClass("none");
                    $(ctx).append(model);
                });
            }
        }

    }catch(error){
        statusHandler.messageError(error);
    };
};

const getImageCollection = () =>{
    try{    

        let imgs = [];

        const models = $("[c-id=image-list]").find("[c-id=model-img]");

        $(models).each(function(el){
            const src = $(this).find("img").attr("src");
            imgs.push(src);
        });

        if(imgs.length){
            return imgs[0];
        }

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const cleanCollectionFilds = ()=>{
    try{

        $("input,select,textarea").each(function(){
            $(this).val("");
        });

        $("[c-id=form]").find("[c-id=image-list]").html("");
        $("[c-id=form]").find("[c-id=name-collection]").text("");
        $("[c-id=form]").find("[c-id=save-collection]").removeAttr("id");



    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const saveCollection = async(id=false)=>{
    try{

        let body = {};
        body["name"] = $("[c-id=name]").val();

        const img = getImageCollection();

        img ? (body["image"] = img) : (body["image"] = "");

        const store = $("[c-id=store-config]").val();

        store && (body["store"] = store);

        const method = !id ? "POST" : "PUT";
        const url = !id ? `/collection` : `/collection/${id}`; 

        const response = await request(method, url, body);

        if(response.status == 200){
            statusHandler.newMessage(`Coleção ${!id ? "Criada" : "Atualizada"}`);
            cleanCollectionFilds();
            await listAllCollections()
        }

    }catch(error){
        throw(statusHandler.messageError(error));
    }
}

const listImg = (imgs)=>{
    try{

        $("[c-id=image-list]").html("");

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

const getImages = async()=>{
    try{

        const file = $("[c-id=modal-collection]").find("[c-id=images]").prop("files");
        
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

const listCollectionInForm = (collection)=>{
    try{
        
        cleanCollectionFilds();
        
        let {image, name, _id, store} = collection;
    

        listImg([image]);
        
        const ctx = "[c-id=modal-collection]";

        $(ctx).find("[c-id=name-collection]").text(name);
        $(ctx).find("[c-id=name]").val(name);
        $(ctx).find("[c-id=store-config]").val(store);


        $(ctx).find("[c-id=save-collection]").attr("id", _id);

    }catch(error){
        throw(statusHandler.messageError(error));
    }
}

const getCollectionById = async(id)=>{
    try{

        const response = await request("GET", `/collection/${id}`);

        if(response.status == 200){

            listCollectionInForm(response.content);
        }

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const changeStatusCollection = async(id, checked)=>{
    try{

        const {status} = await request("PUT", `/collection/status/${id}`, {status:checked});

        if(status == 200){
            statusHandler.newMessage(`Coleção ${checked ? 'ativada' : 'desativada'}`);
            await listAllCollections();
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
               
                $(model).find('a').text(`https://${value.domain}/collections/${id}`)
                $(model).find('a').attr("href",`https://${value.domain}/collections/${id}`)
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

$(document).ready(function(){

    listStores();

     $("body").on("click", "[c-id=copy]", async(e)=>{
        try{

            const a = $(e.target).prev().attr("href");
            
            await navigator.clipboard.writeText(a);
            statusHandler.newMessage("Texto copiado");

        }catch(error){
            statusHandler.messageError(error);
        }
    });


    $("[c-id=close-modal-link]").on("click", ()=>{
        $("[c-id=modal-link]").modal("hide");
    });

    $("body").on("click", "[c-id=model-collection]", async(e)=>{
        try{

            const id = $(e.currentTarget).attr("id");
            const target = $(e.target).attr("c-id");

            if(target == 'status'){
                const checked = $(e.target).prop("checked");
                return await changeStatusCollection(id, checked);
            }

            if(target == "btn-link"){

                return await listAllDomains(id); 
            }

            await getCollectionById(id);
            $("[c-id=modal-collection]").modal("show");

        }catch(error){
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
    

    $("[c-id=save-collection]").on("click", async(e)=>{
        try{

            const id = $(e.target).attr("id");

            await saveCollection(id);
            $("[c-id=modal-collection]").modal("hide");

        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("[c-id=new-collection]").on("click", ()=>{
        try{

            $("[c-id=modal-collection]").modal("show");

        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("[c-id=close-modal]").on("click", ()=>{
        try{

            cleanCollectionFilds();
            $("[c-id=modal-collection]").modal("hide");

        }catch(error){
            throw(statusHandler.messageError(error));
        }
    });

    $("[c-id=image-list]").on("click", "[c-id=remove-img]", (e)=>{
        $(e.currentTarget).closest("[c-id=model-img]").remove();
    });
});