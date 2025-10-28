let editor;

const cleanStoreFilds = ()=>{
    try{

       $("[c-id=form]").find("input,select,textarea").each(function(){
            const hasClass = $(this).hasClass("form-check-input");

            if(hasClass){
                $(this).attr("checked", false);
                return
            }
            $(this).val("");
        });

        $("[c-id=form]").find("[c-id=img-logo],[c-id=banner-1],[c-id=banner-2],[c-id=banner-3]")
        .attr("src", "")
        .closest("div").addClass("none")
        $("[c-id=form]").find("[c-id=save-store]").removeAttr("id");
        $("[c-id=form]").find("[c-id=name-store]").text("");


    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const getBase64 = async(fild = "[c-id=logo]")=>{
    try{

        const file = $("[c-id=form]").find(fild).prop("files");
        
        let imgs = [];

        if(file.length){

            for(i in file){

                if(file[i].size){
                    const base64 = await convertFileToBase64(file[i]);
                    imgs.push(base64);
                }
                
            }
            
        }
        
        return imgs[0];
    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const getCountry = ()=>{
    try{

        let val = [];

        const ctx = "[c-id=form]";
        const check = $(ctx).find("[c-id=country]").find("input");

        $(check).each(function(){
            const isCheck = $(this).prop("checked");

            if(isCheck){
                
                val.push($(this).attr("value"));
            }
        });
        
        if(!val.length){    
            throw(statusHandler.messageError("Selecione no minimo um pais", true));
        }

        return val;

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const getBodyStore = ()=>{
    try{

        const ctx = "[c-id=form]";

        let body = {};
       
        body["name"] = $(ctx).find("[c-id=name]").val();
        body["idioma"] = $(ctx).find("[c-id=idioma]").val();
        body["moeda"] = $(ctx).find("[c-id=moeda]").val();
        body["country"] = getCountry();

        const logo = $(ctx).find("[c-id=img-logo]").attr("src");

        if(logo){
            body["logo"] = logo;
        }

        body['position_logo'] = $("[c-id=position-logo]").find("[value=left]").prop("checked") ? "left" : "center";

        const banner_1 = $(ctx).find("[c-id=banner-1]").attr("src");

        banner_1 && (body["banner_1"] = banner_1);

        const banner_2 = $(ctx).find("[c-id=banner-2]").attr("src");
        
        banner_2 && (body["banner_2"] = banner_2);

        const banner_3 = $(ctx).find("[c-id=banner-3]").attr("src");
        
        banner_3 && (body["banner_3"] = banner_3);


        body["message_top"] = $(ctx).find("[c-id=message_top]").val();
        body["color_message_top"] = $(ctx).find("[c-id=color_message]").val();
        body["bk_message_top"] = $(ctx).find("[c-id=bk_message]").val();

        body["color_btn_product"] = $(ctx).find("[c-id=color_btn_product]").val();
        body["bk_btn_product"] = $(ctx).find("[c-id=bk_btn_product]").val();

        body["color_btn_add_items"] = $(ctx).find("[c-id=color_btn_add_items]").val();
        body["bk_btn_add_items"] = $(ctx).find("[c-id=bk_btn_add_items]").val();

        body["color_btn_checkout"] = $(ctx).find("[c-id=color_btn_checkout]").val();
        body["bk_btn_checkout"] = $(ctx).find("[c-id=bk_btn_checkout]").val();

        body["color_footer"] = $(ctx).find("[c-id=color_footer]").val();
        body["bk_footer"] = $(ctx).find("[c-id=bk_footer]").val();

        body["color_icons"] = $(ctx).find("[c-id=color_icons]").val();
        body["color_n_items_cart"] = $(ctx).find("[c-id=color_n_items_cart]").val();
        body["css"] = editor.getValue();

        return body;    

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const saveStore = async(id = false) =>{
    try{

        const body = getBodyStore();
        const method = id ? "PUT" : "POST";
        const url = id ? `/store-config/${id}` : '/store-config'; 
        const response = await request(method, url, body);

        if(response.status == 200){
            statusHandler.newMessage(`Loja ${!id ? "Criada" : "Atualizada"}`);

            return;
        }

        throw(statusHandler.messageError("Erro ao salvar loja", true));

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
                
                const ctx = "[c-id=all-stores]";

                $(ctx).html("");

                content.forEach(store=>{

                    const {logo, name, _id, idioma, moeda, status} = store;
                    const model = $("[c-id=model-store]").clone()[0];
                    
                    $(model).find("img").attr("src", logo || 'https://gravitec.net/pt/empty.jpg');
                    $(model).find("a").text(name);
                    $(model).find("[c-id=idioma]").text(idioma);
                    $(model).find("[c-id=moeda]").text(moeda);
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

const listStoreInForm = (store)=>{
    try{
        
        cleanStoreFilds();
        
        let {logo, name, _id, idioma, moeda, country, banner_1, banner_2, banner_3, position_logo} = store;

        const {
            message_top, 
            color_message_top, 
            bk_message_top, color_btn_product, 
            bk_btn_product, color_btn_add_items, bk_btn_add_items, color_btn_checkout, bk_btn_checkout, color_footer, bk_footer, color_icons, color_n_items_cart, css} = store;

        const ctx = "[c-id=form]";

        $(ctx).find("[c-id=name-store]").text(name);
        $(ctx).find("[c-id=name]").val(name);
        $(ctx).find("[c-id=idioma]").val(idioma);
        $(ctx).find("[c-id=moeda]").val(moeda);

        $(ctx).find("[c-id=message_top]").val(message_top);
        $(ctx).find("[c-id=color_message]").val(color_message_top);
        $(ctx).find("[c-id=bk_message]").val(bk_message_top);

        $(ctx).find("[c-id=color_btn_product]").val(color_btn_product);
        $(ctx).find("[c-id=bk_btn_product]").val(bk_btn_product);


        $(ctx).find("[c-id=color_btn_add_items]").val(color_btn_add_items);
        $(ctx).find("[c-id=bk_btn_add_items]").val(bk_btn_add_items);

        $(ctx).find("[c-id=color_btn_checkout]").val(color_btn_checkout);
        $(ctx).find("[c-id=bk_btn_checkout]").val(bk_btn_checkout);

        $(ctx).find("[c-id=color_footer]").val(color_footer);
        $(ctx).find("[c-id=bk_footer]").val(bk_footer);

        $(ctx).find("[c-id=color_icons]").val(color_icons);
        $(ctx).find("[c-id=color_n_items_cart]").val(color_n_items_cart);

        $(ctx).find(`[value=${position_logo}]`).prop("checked", true);

        logo && listLogo(logo);        
        banner_1 && listBanner(banner_1, "[c-id=banner-1]");
        banner_2 && listBanner(banner_2, "[c-id=banner-2]");
        banner_3 && listBanner(banner_3, "[c-id=banner-3]");

        const checks = $(ctx).find("[c-id=country] input");

        $(checks).each(function(){
            
            const value = $(this).attr("value");

            const exist = country.find(val=> val == value);
            
            if(exist){
                $(this).prop("checked", true)
            }
        });

        $(ctx).find("[c-id=save-store]").attr("id", _id);

        return css;

    }catch(error){
        throw(statusHandler.messageError(error));
    }
}

const getStoreById = async(id)=>{
    try{

        const response = await request("GET", `/store-config/${id}`);

        if(response.status == 200){

            return listStoreInForm(response.content);
        }

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const listLogo = (img)=>{
    try{

        $("[c-id=img-logo]").attr("src", img);
        $("[c-id=img-logo]").closest("div").removeClass("none");

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const listBanner = (img, banner)=>{
    try{

        $(banner).attr("src", img);
        $(banner).closest("div").removeClass("none");

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

$(document).ready(function(){

    $("body").on("click", "[c-id=model-store]", async(e)=>{
        try{

            const id = $(e.currentTarget).attr("id");
            const target = $(e.target).attr("c-id");

            if(target == 'status'){
                const checked = $(e.target).prop("checked");
                //return await changeStatusProduct(id, checked);
            }

            const css = await getStoreById(id);
            
            $("[c-id=modal-store]").modal("show");
            $("#editor").html("");
            require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' }});
                require(['vs/editor/editor.main'], function () {
                    editor = monaco.editor.create(document.getElementById('editor'), {
                        value: css,
                        language: 'css',
                        theme: 'vs-dark',
                        automaticLayout: true
                });
            });
            await delay(500);
            
        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("[c-id=save-store]").on("click", async(e)=>{
        try{

            const id = $(e.target).attr("id");

            $(e.target).addClass("none");

            await saveStore(id);
            cleanStoreFilds();
        
            $("[c-id=modal-store]").modal("hide");
            $(e.target).removeClass("none");
           
            await listStores();

        }catch(error){
            statusHandler.messageError(error);
            $(e.target).removeClass("none");
        }
    });

    $("[c-id=new-store]").on("click", ()=>{
        $("[c-id=modal-store]").modal("show");

        $("#editor").html("");
        require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' }});
        require(['vs/editor/editor.main'], function () {
            editor = monaco.editor.create(document.getElementById('editor'), {
            value: '',
            language: 'css',
            theme: 'vs-dark',
            automaticLayout: true
        });
    });


    });

    $("[c-id=close-modal]").on("click", ()=>{
        try{

            cleanStoreFilds();
            $("[c-id=modal-store]").modal("hide");

        }catch(error){
            throw(statusHandler.messageError(error));
        }
    })

    $("[c-id=banner_1], [c-id=banner_2], [c-id=banner_3]").on("change", async(e)=>{
        try{

            const target = $(e.currentTarget).attr("c-id");
            const src = await getBase64(`[c-id=${target}]`);

            listBanner(src, `[c-id=banner-${target.replace("banner_", "")}]`);

            $(e.currentTarget).val('');


        }catch(error){
            statusHandler.messageError(error);
        }
    });
   
    $("[c-id=logo]").on("change", async(e)=>{
        try{

            const img = await getBase64();

            $("[c-id=img-logo]").attr("src", img)
            $("[c-id=img-logo]").removeClass("none");

            $(e.target).val('');
            listLogo(img);

        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("body").on("click", "[c-id=remove-img]", (e)=>{
        
        $(e.currentTarget).closest("div")
        .addClass("none")
        .find("img").attr("src", "");
    });

});