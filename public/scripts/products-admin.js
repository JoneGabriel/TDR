const cleanProductFilds = ()=>{
    try{

        $("input,select,textarea").each(function(){
            $(this).val("");
        });

        $("[c-id=form]").find("[c-id=image-list]").html("");
        $("[c-id=form]").find("[c-id=image-list-second]").html("");
        $("[c-id=form]").find("[c-id=save-product]").removeAttr("id");
        $("[c-id=form]").find("[c-id=all-stores]").html("");
        $("[c-id=form]").find("[c-id=all-bundles]").html("");

        $("[c-id=form]").find("[c-id=name-product]").text("");
        $("[c-id=discount-preview]").addClass("none").text("");


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

const getBundles = ()=>{
    try{

        let arrayBundles = [];
        const bundles = $("[c-id=all-bundles]").find("[c-id=model-bundle]");

        $(bundles).each(function(){
            let object = {};
            object["title_bundle"] = $(this).find("[c-id=title_bundle]").val();
            object["last_price_bundle"] = $(this).find("[c-id=last_price_bundle]").val();
            object["price_bundle"] = $(this).find("[c-id=price_bundle]").val();
            object["amount"] = $(this).find("[c-id=amount]").val();
            object["default_bundle"] = $(this).find("[c-id=default_bundle]").prop("checked");
            object["cupom_code"] = $(this).find("[c-id=cupom_code]").val();
  
            const id = $(this).attr("id");

            if(id){
                object["id"] = id;
            }

            arrayBundles.push(object);

        });

        return arrayBundles;

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const listBundles = (bundles)=>{
    try{    

        const ctx = "[c-id=all-bundles]";

        $(ctx).html("");

        bundles.forEach(bundle=>{
            const { last_price_bundle, title_bundle, _id, price_bundle, default_bundle, amount, cupom_code} = bundle;

            const model = $("[c-id=model-bundle]").clone()[0];

            
            $(model).find("[c-id=price_bundle]").val(price_bundle);

            default_bundle && $(model).find("[c-id=default_bundle]").prop("checked", true);
            $(model).find("[c-id=last_price_bundle]").val(last_price_bundle);
            $(model).find("[c-id=amount]").val(amount);
            $(model).find("[c-id=cupom_code]").val(cupom_code);
            $(model).find("[c-id=title_bundle]").val(title_bundle);
            $(model).attr("id", _id);

            $(ctx).append(model);
            $(model).removeClass("none");

        });

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

        // versão second do produto (visitante filtrado); campos vazios caem na versão first
        body["layouts"] = {
            second:{
                name:$(ctx).find("[c-id=name_second]").val(),
                last_price:$(ctx).find("[c-id=last_price_second]").val(),
                price:$(ctx).find("[c-id=price_second]").val(),
                description:tinymce.get('description_second')?.getContent() || "",
                images:getImagesBody("[c-id=image-list-second]")
            }
        };
        //body["lp"] = await getLeadingPage(); 

        const collection = $("[c-id=collection]").val();
        const store = $("[c-id=store-config]").val();

        
        const description = tinymce.get('description').getContent()
        const other_shopify = getStores();
        const bundles = getBundles();

        other_shopify.length && (body["other_shopify"]= other_shopify);

        description && (body["description"] = description);
        collection && (body["collection_"] = collection);
        store && (body["store"] = store);
        
        bundles.length && (body["bundle"]= bundles);
        
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

// imagens do input de arquivo, já redimensionadas/comprimidas no navegador (admin-media.js)
const getImages = async(selector = "[c-id=images]")=>{
    try{

        return await AdminMedia.filesToDataUrls($("[c-id=form]").find(selector).prop("files"));

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

// desconto implícito entre comparação de preço e preço
const updateDiscountPreview = ()=>{
    const price = parseFloat($("[c-id=form]").find("[c-id=price]").val());
    const last = parseFloat($("[c-id=form]").find("[c-id=last_price]").val());
    const chip = $("[c-id=discount-preview]");

    (price > 0 && last > price)
        ? chip.text(`-${Math.round(100 - price * 100 / last)}%`).removeClass("none")
        : chip.addClass("none").text("");
};

const listImg = (imgs, ctx = "[c-id=image-list]")=>{
    try{

        imgs.forEach(val => {

            const model = $("[c-id=model-img]").clone()[0];

            $(model).find("img").attr("src", val);
            $(model).removeClass("none");
            $(ctx).append(model);
        });

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const getImagesBody = (ctx = "[c-id=image-list]") =>{
    try{    

        let imgs = [];

        const models = $(ctx).find("[c-id=model-img]");

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
        
        let {images, name, _id, last_price, price, description, collection_, other_shopify, brand, store, bundles} = product;
        images = images.map(img=> img.base64);

        other_shopify?.length && other_shopify.forEach(val=>{
            
            addStore(val.store._id, val.store.url, val._id, val.id_shopify);
        });

        listImg(images);

        listBundles(bundles);
        
        const ctx = "[c-id=form]";

        $(ctx).find("[c-id=name-product]").text(name);
        $(ctx).find("[c-id=name]").val(name);

        $(ctx).find("[c-id=last_price]").val(last_price);
        $(ctx).find("[c-id=price]").val(price);
        updateDiscountPreview();
        $(ctx).find("[c-id=brand]").val(brand);
        $(ctx).find("[c-id=store-config]").val(store);


        $(ctx).find("[c-id=collection]").val(collection_);
        $(ctx).find("[c-id=description]").val(description);
        $(ctx).find("[c-id=save-product]").attr("id", _id);

        // versão second (campos vazios = usa a first)
        const second = product.layouts?.second || {};

        $(ctx).find("[c-id=name_second]").val(second.name);
        $(ctx).find("[c-id=last_price_second]").val(second.last_price);
        $(ctx).find("[c-id=price_second]").val(second.price);
        listImg((second.images || []).map(img=> img.base64), "[c-id=image-list-second]");

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

        return response.content;

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

                    !index && $(ctx).append(`<option  selected disabled hidden>Escolha uma shopify</option>`)

                    
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

// Exclusão definitiva (não é desativação): pede confirmação antes
const deleteProduct = async(id, nome)=>{
    try{

        const ok = await confirmAction({
            title:"Excluir produto",
            message:`Excluir "${nome}" definitivamente? Variantes Shopify e bundles do produto também serão apagados. Essa ação não pode ser desfeita.`
        });

        if(!ok){
            return;
        }

        const response = await request("DELETE", `/product/${id}`);

        if(response.status != 200){
            throw(statusHandler.messageError(response.content || "Erro ao excluir", true));
        }

        statusHandler.newMessage("Produto excluído(a)");
        await listProducts();

    }catch(error){
        throw(statusHandler.messageError(error));
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

    // fotos: arrastar e soltar, reordenar, capa e contador (componente em admin-media.js)
    AdminMedia.bindDropzone(document.querySelector("[c-id=dropzone-images]"), async(files)=> listImg(await AdminMedia.filesToDataUrls(files)));
    AdminMedia.bindDropzone(document.querySelector("[c-id=dropzone-images-second]"), async(files)=> listImg(await AdminMedia.filesToDataUrls(files), "[c-id=image-list-second]"));
    AdminMedia.enableReorder(document.querySelector("[c-id=image-list]"));
    AdminMedia.enableReorder(document.querySelector("[c-id=image-list-second]"));
    AdminMedia.watchCount(document.querySelector("[c-id=image-list]"), document.querySelector("[c-id=media-count]"));
    AdminMedia.watchCount(document.querySelector("[c-id=image-list-second]"), document.querySelector("[c-id=media-count-second]"));

    $("[c-id=image-list], [c-id=image-list-second]").on("click", "[c-id=set-cover]", (e)=>{
        const item = $(e.currentTarget).closest("[c-id=model-img]");

        item.prependTo(item.parent());
    });

    $("[c-id=form]").on("input", "[c-id=price], [c-id=last_price]", updateDiscountPreview);

    // gerar foto com IA (Higgsfield) nas duas versões
    AdminMedia.bindAiBar(document.querySelector("[c-id=ai-bar-images]"), (image)=> listImg([image]));
    AdminMedia.bindAiBar(document.querySelector("[c-id=ai-bar-images-second]"), (image)=> listImg([image], "[c-id=image-list-second]"));
    
    $("body").on("click", "[c-id=remove-bundle]", async(e)=>{
        try{

            const id = $(e.currentTarget).closest("[c-id=model-bundle]").attr("id");

            if(!confirm("Deseja remover o bundle? Essa ação é irreversivel")){

                return;
            }

            if(id){
                const remove = await request("DELETE", `/product/bundle/${id}`);
            
                if(remove.status != 200){
                    throw(statusHandler.messageError("Erro ao remover loja", true))
                }
            }

            $(e.currentTarget).closest("[c-id=model-bundle]").remove();
            statusHandler.newMessage("Bundle removido");

        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("[c-id=new-bundle]").on("click", ()=>{
        try{

            const model = $("[c-id=model-bundle]").clone()[0];
            
            $(model).removeClass("none");
            $("[c-id=all-bundles]").append(model);

        }catch(error){
            statusHandler.messageError(error);
        }
    });

    // cache de preços por país (Shopify Markets) de todos os produtos
    $("[c-id=refresh-prices]").on("click", async(e)=>{
        try{

            $(e.target).prop("disabled", true).text("Atualizando...");
            loadingAfterOpenModal(true);

            const response = await request("POST", "/pricing/refresh");

            if(response.status != 200){
                throw(statusHandler.messageError(response.content || "Erro ao atualizar preços", true));
            }

            const {products, variants, errors, seconds} = response.content;

            statusHandler.newMessage(`Preços atualizados: ${products} produto(s), ${variants} variante(s) em ${seconds}s`);
            errors.length && statusHandler.messageError(`${errors.length} erro(s): ${errors.slice(0, 3).join(" | ")}`, true);

        }catch(error){
            statusHandler.messageError(error);
        }finally{
            loadingAfterOpenModal(false);
            $(e.target).prop("disabled", false).text("Atualizar preços");
        }
    });

    $("[c-id=new-product]").on("click", ()=>{
        $("[c-id=modal-product]").modal("show");
        tinymce.init({
            selector: 'textarea',  
            menu: {
                happy: { title: 'HTML', items: 'code' }
            },
            plugins: 'code',  
            menubar: 'happy' ,
            skin: 'oxide-dark',
            content_css: 'dark',
            
        });
        tinymce.get('description').setContent('');
        tinymce.get('description_second')?.setContent('');

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
            const target = $(e.target).closest("[c-id]").attr("c-id");

            if(target == 'status'){
                const checked = $(e.target).prop("checked");
                return await changeStatusProduct(id, checked);
            }

            if(target == "btn-link"){

                return await listAllDomains(id); 
            }

            if(target == "btn-delete"){
                return await deleteProduct(id, $(e.currentTarget).find("a").first().text());
            }

            const product = await getProductById(id);
            $("[c-id=modal-product]").modal("show");
            tinymce.init({
                selector: 'textarea',  
                menu: {
                    happy: { title: 'HTML', items: 'code' }
                },
                plugins: 'code',  
                menubar: 'happy' ,
                skin: 'oxide-dark',
                content_css: 'dark',
                
            });
            tinymce.get('description').setContent(product.description || '');
            tinymce.get('description_second')?.setContent(product.layouts?.second?.description || '');


        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("[c-id=image-list], [c-id=image-list-second]").on("click", "[c-id=remove-img]", (e)=>{
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

    $("[c-id=images-second]").on("change", async(e)=>{
        try{

            const imgs = await getImages("[c-id=images-second]");

            listImg(imgs, "[c-id=image-list-second]");

            $(e.target).val('');

        }catch(error){
            statusHandler.messageError(error);
        }
    });

    // preenche a versão second com os valores atuais da versão first
    $("[c-id=copy-first]").on("click", ()=>{
        try{

            const ctx = "[c-id=form]";

            $(ctx).find("[c-id=name_second]").val($(ctx).find("[c-id=name]").val());
            $(ctx).find("[c-id=last_price_second]").val($(ctx).find("[c-id=last_price]").val());
            $(ctx).find("[c-id=price_second]").val($(ctx).find("[c-id=price]").val());
            tinymce.get('description_second')?.setContent(tinymce.get('description')?.getContent() || '');

            $(ctx).find("[c-id=image-list-second]").html("");
            listImg(getImagesBody().map(img=> img.base64), "[c-id=image-list-second]");

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

});