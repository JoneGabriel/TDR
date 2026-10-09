let editor;
let edit_twig;

// ---------------------------------------------------------------- visual por layout (logo, posição, banners, CSS)
// A aba First edita os valores da raiz da loja; a aba Second edita layouts.second.* (vazio = herda do first).
const VISUAL_IMG = {logo:"[c-id=img-logo]", banner_1:"[c-id=banner-1]", banner_2:"[c-id=banner-2]", banner_3:"[c-id=banner-3]"};
const VISUAL_TEXT = {title:"[c-id=title]", message_top:"[c-id=message_top]"};
const VISUAL_COLOR = {
    color_message_top:"[c-id=color_message]", bk_message_top:"[c-id=bk_message]",
    color_btn_product:"[c-id=color_btn_product]", bk_btn_product:"[c-id=bk_btn_product]",
    color_btn_add_items:"[c-id=color_btn_add_items]", bk_btn_add_items:"[c-id=bk_btn_add_items]",
    color_btn_checkout:"[c-id=color_btn_checkout]", bk_btn_checkout:"[c-id=bk_btn_checkout]",
    color_footer:"[c-id=color_footer]", bk_footer:"[c-id=bk_footer]",
    color_icons:"[c-id=color_icons]", color_n_items_cart:"[c-id=color_n_items_cart]"
};
const VISUAL_KEYS = ["position_logo", "css", ...Object.keys(VISUAL_IMG), ...Object.keys(VISUAL_TEXT), ...Object.keys(VISUAL_COLOR)];
const TEXT_PLACEHOLDER = {title:"Nome da loja", message_top:"Frete grátis acima de 50€"};
let visual = {first:{}, second:{}};
let visualLayout = "first";

const pickVisual = (source = {})=> Object.fromEntries(VISUAL_KEYS.map(key=> [key, (source && source[key]) || ""]));

const showImage = (selector, src, inherited = false)=>{
    const $img = $(selector);
    const $preview = $img.closest(".image-picker-preview");

    $preview.closest(".image-picker").toggleClass("has-image", !!src);

    if(!src){
        $img.attr("src", "");
        $preview.addClass("none").removeClass("is-inherited");
        return;
    }

    $img.attr("src", src);
    $preview.removeClass("none").toggleClass("is-inherited", !!inherited);
};

// lê a tela para o layout aberto (imagem herdada não conta como valor próprio)
const readVisualFromDom = ()=>{
    const ctx = "[c-id=form]";
    let values = {};

    Object.entries(VISUAL_IMG).forEach(([key, selector])=>{
        const $img = $(ctx).find(selector);
        const inherited = $img.closest(".image-picker-preview").hasClass("is-inherited");

        values[key] = inherited ? "" : ($img.attr("src") || "");
    });

    values.position_logo = $(ctx).find("[c-id=position-logo] input:checked").val() || "";
    values.css = editor ? editor.getValue() : ((visual[visualLayout] && visual[visualLayout].css) || "");

    // textos: vazio no second = herda do first
    Object.entries(VISUAL_TEXT).forEach(([key, selector])=>{
        values[key] = $(ctx).find(selector).val() || "";
    });

    // cores: no second, a cor marcada como herdada não conta como valor próprio
    Object.entries(VISUAL_COLOR).forEach(([key, selector])=>{
        const $input = $(ctx).find(selector);

        values[key] = $input.hasClass("is-inherited") ? "" : ($input.val() || "");
    });

    return values;
};

const writeVisualToDom = (name)=>{
    const own = visual[name] || {};
    const base = visual.first || {};

    Object.entries(VISUAL_IMG).forEach(([key, selector])=>{
        if(own[key]){
            showImage(selector, own[key], false);
        }else if(name == "second" && base[key]){
            showImage(selector, base[key], true);
        }else{
            showImage(selector, "", false);
        }
    });

    const position = own.position_logo || base.position_logo || "left";
    $("[c-id=position-logo] input").prop("checked", false);
    $(`[c-id=position-logo] [value=${position}]`).prop("checked", true);

    editor && editor.setValue(own.css || "");

    Object.entries(VISUAL_TEXT).forEach(([key, selector])=>{
        $(selector).val(own[key] || "").attr("placeholder", name == "second" && base[key] ? base[key] : TEXT_PLACEHOLDER[key]);
    });

    Object.entries(VISUAL_COLOR).forEach(([key, selector])=>{
        const $input = $(selector);

        if(own[key]){
            $input.val(own[key]).removeClass("is-inherited");
        }else if(name == "second" && base[key]){
            $input.val(base[key]).addClass("is-inherited");
        }else{
            $input.val(base[key] || "#000000").removeClass("is-inherited");
        }
    });

    $("[c-id=layout-tag]").text(name);
    $("[c-id=reset-colors]").toggleClass("none", name != "second");
    $("[c-id=colors-hint]").text(name == "second"
        ? "Layout second: cores esmaecidas são herdadas do first; mude uma cor para sobrescrever."
        : "Valores do layout first (o second herda o que não definir).");
    $("[c-id=visual-hint]").text(name == "second"
        ? "Layout second: vazio herda do first. Imagens e cores esmaecidas são herdadas; altere para sobrescrever. Nome, idioma, moeda, países e atendimento valem para a loja inteira."
        : "Layout first: valores padrão da loja (também usados pelo second quando ele não define os seus). Nome, idioma, moeda, países e atendimento valem para a loja inteira.");
};

const switchVisualLayout = (name)=>{
    visual[visualLayout] = readVisualFromDom();
    visualLayout = name;
    $(`[c-id=visual-layout] input[value=${name}]`).prop("checked", true);
    writeVisualToDom(name);
};

const resetVisual = ()=>{
    visual = {first:pickVisual(), second:pickVisual()};
    visualLayout = "first";
    writeVisualToDom("first");
    $("[c-id=visual-layout] input[value=first]").prop("checked", true);
};


const cleanStoreFilds = ()=>{
    try{

       $("[c-id=form]").find("input,select,textarea").each(function(){
            if($(this).attr("data-keep")) return;

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
        resetVisual();

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

// dispositivos atendidos (filtro de visitantes): padrão celular + tablet, igual às lojas antigas sem o campo
const DEFAULT_DEVICES = ["mobile", "tablet"];
const updateDeviceCount = ()=> $("[c-id=device-count]").text($("[c-id=form]").find("[c-id=devices] input:checked").length);
const getDevices = ()=> $("[c-id=form]").find("[c-id=devices] input:checked").toArray().map(input=> input.value);
const setDevices = (devices)=>{
    const list = Array.isArray(devices) && devices.length ? devices : DEFAULT_DEVICES;

    $("[c-id=form]").find("[c-id=devices] input").each(function(){
        $(this).prop("checked", list.includes(this.value));
    });
    updateDeviceCount();
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
        body["devices"] = getDevices();

        if(!body["devices"].length){
            throw(statusHandler.messageError("Marque ao menos um dispositivo atendido (celular, tablet ou desktop)", true));
        }

        // visuais por layout: first vai para a raiz da loja; second vai para layouts.second.* (vazio = herda do first)
        visual[visualLayout] = readVisualFromDom();
        const first = visual.first;
        const second = visual.second;

        if(first.logo){
            body["logo"] = first.logo;
        }

        body["position_logo"] = first.position_logo || "left";
        VISUAL_KEYS.filter(key=> key != "logo" && key != "position_logo").forEach(key=>{
            body[key] = first[key] || "";
        });

        let secondOwn = {};
        VISUAL_KEYS.forEach(key=> secondOwn[key] = second[key] || "");
        secondOwn.position_logo = second.position_logo && second.position_logo != body["position_logo"] ? second.position_logo : "";
        body["layouts"] = {second:secondOwn};
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

            // id da loja (a criada vem em content._id) para o modal seguir aberto em modo de edição
            return id || response.content?._id;
        }

        throw(statusHandler.messageError(response.content || "Erro ao salvar loja", true));

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
        
        let {name, _id, idioma, moeda, country} = store;

        const ctx = "[c-id=form]";

        $(ctx).find("[c-id=name-store]").text(name);
        $(ctx).find("[c-id=name]").val(name);
        $(ctx).find("[c-id=idioma]").val(idioma);
        $(ctx).find("[c-id=moeda]").val(moeda);

        $(ctx).find("[c-id=support_assistant]").val(store.support?.assistant_name || "");
        $(ctx).find("[c-id=support_loyalty]").val(store.support?.loyalty_code || "");
        $(ctx).find("[c-id=support_instructions]").val(store.support?.instructions || "");

        // first = raiz da loja; second = layouts.second (só o que foi sobrescrito)
        visual = {first:pickVisual(store), second:pickVisual(store.layouts && store.layouts.second)};
        visualLayout = "first";
        $("[c-id=visual-layout] input[value=first]").prop("checked", true);
        writeVisualToDom("first");

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
        setDevices(store.devices);

        return visual.first.css;

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
        $("[c-id=img-logo]").closest("div").removeClass("none is-inherited");

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const listBanner = (img, banner)=>{
    try{

        $(banner).attr("src", img);
        $(banner).closest("div").removeClass("none is-inherited");

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

// diálogos do TinyMCE (código-fonte) ficam fora do modal: sem isto o focus trap do Bootstrap bloqueia a digitação neles
document.addEventListener('focusin', (e)=>{
    if(e.target.closest('.tox-tinymce-aux') !== null){
        e.stopImmediatePropagation();
    }
});

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
    // a área de soltar é o card inteiro (zona vazia ou imagem já carregada, para trocar arrastando)
    AdminMedia.bindDropzone(document.querySelector("[c-id=dropzone-logo]")?.closest(".image-picker"), async(files)=>{
        const [img] = await AdminMedia.filesToDataUrls(files);

        img && listLogo(img);
    });

    [1, 2, 3].forEach(n=> AdminMedia.bindDropzone(document.querySelector(`[c-id=dropzone-banner_${n}]`)?.closest(".image-picker"), async(files)=>{
        const [img] = await AdminMedia.filesToDataUrls(files);

        img && listBanner(img, `[c-id=banner-${n}]`);
    }));


    // países: filtro por nome/código e contador
    $("[c-id=country-filter]").on("input", (e)=>{
        const term = $(e.target).val().trim().toLowerCase();

        $("[c-id=country] .form-check").each(function(){
            $(this).toggleClass("is-hidden", !!term && !$(this).text().toLowerCase().includes(term));
        });
    });

    $("[c-id=form]").on("change", "[c-id=country] input", updateCountryCount);
    $("[c-id=form]").on("change", "[c-id=devices] input", updateDeviceCount);

    // alterna o layout editado pelos campos visuais (título, mensagem, cores, logo, posição, banners, CSS)
    $("[c-id=visual-layout]").on("change", "input", (e)=> switchVisualLayout(e.target.value));

    // cor alterada no second deixa de ser herdada do first
    $("[c-id=form]").on("input change", "input[type=color]", (e)=> $(e.target).removeClass("is-inherited"));

    // second: volta a herdar mensagem do topo e cores do first
    $("[c-id=reset-colors]").on("click", ()=>{
        if(visualLayout != "second") return;

        visual.second = readVisualFromDom();
        Object.keys(VISUAL_COLOR).forEach(key=> visual.second[key] = "");
        visual.second.message_top = "";
        writeVisualToDom("second");
    });

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

            const savedId = await saveStore(id);

            $(e.target).removeClass("none");

            // o modal continua aberto: loja nova passa a ser editada (id no botão, título e botões de template/políticas)
            if(savedId){
                $(e.target).attr("id", savedId);
                $("[c-id=form]").find("[c-id=name-store]").text($("[c-id=form]").find("[c-id=name]").val());
                $("[c-id=modal-store]").find("[c-id=open-template], [c-id=open-policies]").removeClass("none");
            }

            await listStores();

        }catch(error){
            statusHandler.messageError(error);
            $(e.target).removeClass("none");
        }
    });

    $("[c-id=new-store]").on("click", ()=>{
        $("[c-id=modal-store]").modal("show");
        cleanStoreFilds();
        setDevices(DEFAULT_DEVICES);

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
        
        $(e.currentTarget).closest(".image-picker").removeClass("has-image");
        $(e.currentTarget).closest(".image-picker-preview")
        .addClass("none")
        .removeClass("is-inherited")
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