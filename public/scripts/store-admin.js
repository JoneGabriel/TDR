let editor;
let edit_twig;


const cleanStoreFilds = ()=>{
    try{

       $("[c-id=form]").find("input,select,textarea").each(function(){
            const hasClass = $(this).hasClass("form-check-input");

            if(hasClass){
                $(this).prop("checked", false);
                return
            }
            $(this).val("");
        });

        $("[c-id=form]").find("[c-id=img-logo],[c-id=banner-1],[c-id=banner-2],[c-id=banner-3]")
        .attr("src", "")
        .closest("div").addClass("none")
        $("[c-id=form]").find("[c-id=save-store]").removeAttr("id");
        $("[c-id=form]").find("[c-id=name-store]").text("");
        $("[c-id=form]").find("img").attr("src", "")
        $("[c-id=modal-store]").find("[c-id=open-template]").addClass("none");
        $("[c-id=modal-store]").find("[c-id=open-policies]").addClass("none");
        $("[c-id=country] .form-check").removeClass("is-hidden");
        updateCountryCount();

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

// primeira imagem do input de arquivo, já redimensionada/comprimida no navegador (admin-media.js)
const getBase64 = async(fild = "[c-id=logo]")=>{
    try{

        const [img] = await AdminMedia.filesToDataUrls($("[c-id=form]").find(fild).prop("files"));

        return img;

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

// contador de países marcados
const updateCountryCount = ()=> $("[c-id=country-count]").text($("[c-id=form]").find("[c-id=country] input:checked").length);

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
        body["support"] = {
            assistant_name:$(ctx).find("[c-id=support_assistant]").val(),
            loyalty_code:$(ctx).find("[c-id=support_loyalty]").val(),
            instructions:$(ctx).find("[c-id=support_instructions]").val()
        };

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
        $(ctx).find("[c-id=support_assistant]").val(store.support?.assistant_name || "");
        $(ctx).find("[c-id=support_loyalty]").val(store.support?.loyalty_code || "");
        $(ctx).find("[c-id=support_instructions]").val(store.support?.instructions || "");

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
        updateCountryCount();

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

// layout selecionado no editor de templates (first | second)
const getSelectedLayout = ()=>{
    return $("[c-id=modal-template]").find("[c-id=layout-file]").val() || "first";
};

// Exclusão definitiva (não é desativação): pede confirmação antes
const deleteStore = async(id, nome)=>{
    try{

        const ok = await confirmAction({
            title:"Excluir loja",
            message:`Excluir "${nome}" definitivamente? Essa ação não pode ser desfeita.`
        });

        if(!ok){
            return;
        }

        const response = await request("DELETE", `/store-config/${id}`);

        if(response.status != 200){
            throw(statusHandler.messageError(response.content || "Erro ao excluir", true));
        }

        statusHandler.newMessage("Loja excluído(a)");
        await listStores();

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const getTemplate = async(idStore, id)=>{
    try{

        const layout = getSelectedLayout();
        const response = await request("GET", `/store-config/${idStore}/${id}?layout=${layout}`);
        
        if(response.status == 200){
            const twig = response.content[id];
            edit_twig.setValue(twig);

            $("[c-id=save-template]").attr("id", id);
        }

    }catch(error){
        throw(statusHandler.messageError(error))
    }
};

const saveTemplate = async(idStore, id)=>{
    try{

        const file = edit_twig.getValue();
        const layout = getSelectedLayout();
        const response = await request("PUT", `/store-config/${idStore}/${id}?layout=${layout}`, {file});

        if(response.status != 200){
            throw(statusHandler.messageError("Erro ao salvar, verifique o arquivo", true));
        }

        statusHandler.newMessage(`Arquivo salvo (layout ${layout})`);

    }catch(error){
        throw(statusHandler.messageError(error));
    }
}

// ---------------------------------------------------------------- políticas da loja
const policyEditor = ()=> tinymce.get('policy-editor');

// Garante o TinyMCE do modal (iniciado só na primeira abertura, com o modal já visível).
// Resolve no evento `init` do editor: o promise de tinymce.init nem sempre resolve dentro de modais.
let policyEditorReady = null;

const ensurePolicyEditor = ()=>{
    if(policyEditorReady){
        return policyEditorReady;
    }

    policyEditorReady = new Promise(resolve=>{
        const done = ()=> resolve(policyEditor());
        const timer = setTimeout(done, 8000);

        tinymce.init({
            selector:'#policy-editor',
            height:520,
            menu:{ happy:{ title:'HTML', items:'code' } },
            plugins:'code',
            menubar:'happy',
            skin:'oxide-dark',
            content_css:'dark',
            setup:(editor)=> editor.on('init', ()=>{
                clearTimeout(timer);
                done();
            })
        });
    });

    return policyEditorReady;
};

const showPolicySource = (source)=>{
    const $tag = $("[c-id=policy-source]").removeClass("is-default is-custom");

    source == "store"
        ? $tag.addClass("is-custom").text("Texto próprio da loja")
        : $tag.addClass("is-default").text("Padrão do país (não personalizado)");
};

const getPolicy = async(idStore, key)=>{
    try{

        const response = await request("GET", `/store-config/${idStore}/policy/${key}`);

        if(response.status != 200){
            throw(statusHandler.messageError(response.content || "Erro ao buscar política", true));
        }

        const {title_policy, text_policy, source} = response.content;
        const editor = await ensurePolicyEditor();

        $("[c-id=policy-title]").val(title_policy || "");
        editor?.setContent(text_policy || "");
        showPolicySource(source);
        $("[c-id=save-policy]").attr("id", key);

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const savePolicy = async(idStore, key, reset = false)=>{
    try{

        const body = reset
            ? {title_policy:"", text_policy:""}
            : {title_policy:$("[c-id=policy-title]").val(), text_policy:policyEditor()?.getContent() || ""};

        const response = await request("PUT", `/store-config/${idStore}/policy/${key}`, body);

        if(response.status != 200){
            throw(statusHandler.messageError(response.content || "Erro ao salvar política", true));
        }

        statusHandler.newMessage(response.content);
        await getPolicy(idStore, key);

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

$(document).ready(function(){

    $("[c-id=open-policies]").on("click", async()=>{
        try{

            // inicia o editor só com o modal totalmente visível e abre a primeira política
            $("[c-id=modal-policies]").one("shown.bs.modal", async()=>{
                try{

                    await ensurePolicyEditor();
                    $("[c-id=model-policy]").first().trigger("click");

                }catch(error){
                    statusHandler.messageError(error);
                }
            });

            $("[c-id=modal-policies]").modal("show");

        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("[c-id=model-policy]").on("click", async(e)=>{
        try{

            const idStore = $("[c-id=modal-store]").find("[c-id=save-store]").attr("id");
            const key = $(e.currentTarget).attr("id");

            $("[c-id=model-policy]").removeClass("active");
            $(e.currentTarget).addClass("active");

            await getPolicy(idStore, key);

        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("[c-id=save-policy]").on("click", async(e)=>{
        try{

            const idStore = $("[c-id=modal-store]").find("[c-id=save-store]").attr("id");
            const key = $(e.currentTarget).attr("id");

            key && await savePolicy(idStore, key);

        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("[c-id=reset-policy]").on("click", async()=>{
        try{

            const idStore = $("[c-id=modal-store]").find("[c-id=save-store]").attr("id");
            const key = $("[c-id=save-policy]").attr("id");

            if(!key){
                return;
            }

            const ok = await confirmAction({
                title:"Restaurar padrão",
                message:"Descartar o texto próprio desta política e voltar ao padrão do país?",
                okText:"Restaurar"
            });

            ok && await savePolicy(idStore, key, true);

        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("[c-id=close-modal-policies]").on("click", ()=>{
        $("[c-id=modal-policies]").modal("hide");
        $("[c-id=save-policy]").removeAttr("id");
        $("[c-id=model-policy]").removeClass("active");
    });

    // logo e banners: arrastar e soltar (admin-media.js)
    AdminMedia.bindDropzone(document.querySelector("[c-id=dropzone-logo]"), async(files)=>{
        const [img] = await AdminMedia.filesToDataUrls(files);

        img && listLogo(img);
    });

    [1, 2, 3].forEach(n=> AdminMedia.bindDropzone(document.querySelector(`[c-id=dropzone-banner_${n}]`), async(files)=>{
        const [img] = await AdminMedia.filesToDataUrls(files);

        img && listBanner(img, `[c-id=banner-${n}]`);
    }));

    // gerar logo e banners com IA (Higgsfield)
    AdminMedia.bindAiBar(document.querySelector("[c-id=ai-bar-logo]"), (image)=> listLogo(image));
    [1, 2, 3].forEach(n=> AdminMedia.bindAiBar(document.querySelector(`[c-id=ai-bar-banner_${n}]`), (image)=> listBanner(image, `[c-id=banner-${n}]`)));

    // países: filtro por nome/código e contador
    $("[c-id=country-filter]").on("input", (e)=>{
        const term = $(e.target).val().trim().toLowerCase();

        $("[c-id=country] .form-check").each(function(){
            $(this).toggleClass("is-hidden", !!term && !$(this).text().toLowerCase().includes(term));
        });
    });

    $("[c-id=form]").on("change", "[c-id=country] input", updateCountryCount);

    $("[c-id=model-file]").on("click", async(e)=>{
        try{

            const idStore = $("[c-id=modal-store]").find("[c-id=save-store]").attr("id")
            const idFile = $(e.currentTarget).attr("id");

            $("[c-id=model-file]").removeClass("active");
            $(e.currentTarget).addClass("active");

            await getTemplate(idStore, idFile)

        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("[c-id=layout-file]").on("change", async()=>{
        try{

            const idStore = $("[c-id=modal-store]").find("[c-id=save-store]").attr("id");
            const idFile = $("[c-id=save-template]").attr("id");

            // recarrega o arquivo aberto no layout recém-selecionado
            idFile && await getTemplate(idStore, idFile);

        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("body").on("click", "[c-id=model-store]", async(e)=>{
        try{

            const id = $(e.currentTarget).attr("id");
            const target = $(e.target).closest("[c-id]").attr("c-id");

            if(target == 'status'){
                const checked = $(e.target).prop("checked");
                //return await changeStatusProduct(id, checked);
            }

            if(target == "btn-delete"){
                return await deleteStore(id, $(e.currentTarget).find("a").first().text());
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
            $("[c-id=modal-store]").find("[c-id=open-template]").removeClass("none");
            $("[c-id=modal-store]").find("[c-id=open-policies]").removeClass("none");
            
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
        cleanStoreFilds();

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

    $("[c-id=open-template]").on("click", ()=>{
        try{

        $("[c-id=modal-template]").modal("show");
        // o editor sempre abre no layout "first"
        $("[c-id=layout-file]").val("first");
        $("#edit-twig").html("");
        require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' }});
            require(['vs/editor/editor.main'], function () {
                edit_twig = monaco.editor.create(document.getElementById('edit-twig'), {
                value: '',
                language: 'html',
                theme: 'vs-dark',
                automaticLayout: true
            });
        });

        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("[c-id=close-modal-template]").on("click", ()=>{
        $("[c-id=modal-template]").modal("hide");
        $("[c-id=save-template]").removeAttr("id");
    });

    $("[c-id=save-template]").on("click", async(e)=>{
        try{

            const idStore = $("[c-id=modal-store]").find("[c-id=save-store]").attr("id")
            const idFile = $(e.currentTarget).attr("id");

            await saveTemplate(idStore, idFile)

        }catch(error){
            statusHandler.messageError(error);
        }
    })

});