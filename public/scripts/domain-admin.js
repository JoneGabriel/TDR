




// ---------------------------------------------------------------- provisionamento (DNS + SSL)
// O servidor verifica DNS e certificado (GET /domain/:id/check) e devolve {state, label, message, checked_at}.
// Aqui só se desenha o estado na linha e se reverifica, em segundo plano, o que ainda não está pronto.
const STATE_ICON = {
    ready:"bi-check-circle-fill", dns_pending:"bi-hourglass-split", ssl_pending:"bi-shield-lock",
    dns_other:"bi-exclamation-triangle-fill", ssl_error:"bi-shield-exclamation", unreachable:"bi-wifi-off", other_app:"bi-question-circle",
    inactive:"bi-pause-circle", local:"bi-pc-display", checking:"bi-arrow-repeat"
};
const STATE_TONE = {
    ready:"is-ready", dns_pending:"is-pending", ssl_pending:"is-pending",
    dns_other:"is-error", ssl_error:"is-error", unreachable:"is-error", other_app:"is-error"
};
const PENDING_STATES = ["dns_pending", "ssl_pending", "dns_other", "ssl_error", "unreachable", "other_app"];
const RECHECK_MS = 60 * 1000;          // domínios pendentes, com a página aberta
const FRESH_MS = 30 * 60 * 1000;       // "pronto" verificado há menos que isso não é reverificado ao abrir
let serverInfo = {ip:null, sync_minutes:10};

const timeAgo = (iso)=>{
    const seconds = Math.round((Date.now() - new Date(iso)) / 1000);

    if(!(seconds >= 0)) return "";
    if(seconds < 60) return "agora";
    if(seconds < 3600) return `há ${Math.round(seconds / 60)} min`;
    if(seconds < 86400) return `há ${Math.round(seconds / 3600)} h`;

    return `há ${Math.round(seconds / 86400)} d`;
};

const renderState = (row, check)=>{
    const $state = $(row).find("[c-id=state]");
    const state = check?.state || "unknown";
    const when = check?.checked_at ? timeAgo(check.checked_at) : "";

    $state.attr("data-state", state)
        .removeClass("is-ready is-pending is-error is-muted is-checking")
        .addClass(STATE_TONE[state] || "is-muted")
        .toggleClass("is-checking", state == "checking");
    $state.find(".domain-state-badge i").attr("class", `bi ${STATE_ICON[state] || "bi-dash-circle"}`);
    $state.find("[c-id=state-label]").text(check?.label || (state == "checking" ? "Verificando…" : "Não verificado"));
    $state.find("[c-id=state-detail]").text(check?.message ? `${check.message}${when ? ` · verificado ${when}` : ""}` : (state == "checking" ? "Consultando DNS e HTTPS…" : "Clique em verificar para conferir DNS e SSL."));
    $state.find("[c-id=btn-check]").prop("disabled", state == "checking");
};

// verifica um domínio e redesenha a linha; devolve o resultado
const checkRow = async(id)=>{
    const row = document.getElementById(id);

    if(!row || row.dataset.checking){
        return null;
    }

    row.dataset.checking = "1";
    renderState(row, {state:"checking"});

    try{
        const response = await request("GET", `/domain/${id}/check`);
        const check = response?.status == 200 ? response.content : {state:"unreachable", label:"Erro", message:String(response?.content || "Falha ao verificar"), checked_at:new Date().toISOString()};

        renderState(row, check);

        return check;
    }finally{
        delete row.dataset.checking;
    }
};

// reverifica as linhas (3 por vez). `onlyPending`: só o que ainda não está pronto; senão também o "pronto" antigo
const refreshStatuses = async(onlyPending = false)=>{
    const rows = $("[c-id=all-domain] [c-id=model-domain]").toArray().filter(row=>{
        const state = $(row).find("[c-id=state]").attr("data-state");
        const checkedAt = $(row).data("checked-at");
        const stale = !checkedAt || Date.now() - new Date(checkedAt) > FRESH_MS;

        if(!row.id || row.dataset.checking || !$(row).find("[c-id=status]").prop("checked")) return false;
        if(PENDING_STATES.includes(state) || !state || state == "unknown") return true;

        return !onlyPending && stale;
    });

    const queue = rows.slice();
    const worker = async()=>{ while(queue.length){ await checkRow(queue.shift().id); } };

    await Promise.all([worker(), worker(), worker()]);
};

const loadServerInfo = async()=>{
    const response = await request("GET", "/domain/server-ip");

    if(response?.status == 200){
        serverInfo = response.content;
    }

    $("[c-id=modal-ip]").text(serverInfo.ip || "o IP desta VPS");
    $("[c-id=modal-sync], [c-id=help-sync]").text(serverInfo.sync_minutes || 10);
};

// instruções de apontamento logo após cadastrar
const showDnsHelp = (host, ip, syncMinutes)=>{
    $("[c-id=help-domain], [c-id=help-host]").text(host);
    $("[c-id=help-ip]").text(ip || "o IP desta VPS (veja no provedor)");
    $("[c-id=help-sync]").text(syncMinutes || 10);
    $("[c-id=dns-help]").removeClass("none")[0].scrollIntoView({block:"nearest", behavior:"smooth"});
};

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
                    const {domain, _id, status, store, check} = info;
                    const model = $("[c-id=model-domain]").clone()[0];

                    $(model).find("[c-id=domain]").text(domain);
                    $(model).find("[c-id=name-store]").text(store?.name || "");

                    $(model).find("[c-id=status]").prop('checked', status);
                    $(model).attr("id", _id);
                    $(model).data("checked-at", check?.checked_at || "");
                    renderState(model, status ? check : {state:"inactive", label:"Desativado", message:"Domínio desativado no painel."});
                    
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
            await listAllDomains();

            // o modal continua aberto. Domínio novo: passa a ser editado (recarrega o formulário com o id),
            // mostra o que falta (registro A, prazos) e já começa a acompanhar o status
            if(!id && response.content?._id){
                await getDomainById(response.content._id);
                showDnsHelp(response.content.domain, response.content.server_ip || serverInfo.ip, response.content.sync_minutes);
                checkRow(response.content._id);
            }else if(id){
                checkRow(id);
            }
            
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

// Exclusão definitiva (não é desativação): pede confirmação antes
const deleteDomain = async(id, nome)=>{
    try{

        const ok = await confirmAction({
            title:"Excluir domínio",
            message:`Excluir "${nome}" definitivamente? Essa ação não pode ser desfeita.`
        });

        if(!ok){
            return;
        }

        const response = await request("DELETE", `/domain/${id}`);

        if(response.status != 200){
            throw(statusHandler.messageError(response.content || "Erro ao excluir", true));
        }

        statusHandler.newMessage("Domínio excluído(a)");
        await listAllDomains();

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
    loadServerInfo();

    // último status conhecido na hora; depois reverifica o que não está pronto (e o "pronto" antigo), e repete por minuto
    listAllDomains().then(()=> refreshStatuses(false));
    setInterval(()=> document.visibilityState == "visible" && refreshStatuses(true), RECHECK_MS);

    $("[c-id=close-help]").on("click", ()=> $("[c-id=dns-help]").addClass("none"));
    $("[c-id=copy-ip]").on("click", async()=>{
        try{
            await navigator.clipboard.writeText($("[c-id=help-ip]").text().trim());
            statusHandler.newMessage("IP copiado");
        }catch(error){
            statusHandler.messageError("Não foi possível copiar; selecione o IP manualmente", true);
        }
    });

    $("body").on("click", "[c-id=model-domain]", async(e)=>{
        try{

            const id = $(e.currentTarget).attr("id");
            const target = $(e.target).closest("[c-id]").attr("c-id");

            if(target == 'status'){
                const checked = $(e.target).prop("checked");
                return await changeStatusDomain(id, checked);
            }

            if(target == "btn-delete"){
                return await deleteDomain(id, $(e.currentTarget).find("a").first().text());
            }

            if(target == "btn-check"){
                return await checkRow(id);
            }

            if(["state", "state-label", "state-detail"].includes(target)){
                return;
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