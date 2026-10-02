// Tela de integrações: conexão OAuth com a Higgsfield, padrões de geração e teste

const fmtDate = (value)=> value ? new Date(value).toLocaleString("pt-BR") : "—";

const renderStatus = (status)=>{
    const chip = $("[c-id=hf-status]").removeClass("is-on is-off");

    status.connected ? chip.addClass("is-on").text("conectada") : chip.addClass("is-off").text("desconectada");

    $("[c-id=hf-url]").text(status.url);
    $("[c-id=hf-account]").text(status.account?.email || status.account?.name || (status.connected ? "conta Higgsfield" : "—"));
    $("[c-id=hf-connected-at]").text(fmtDate(status.connected_at));
    $("[c-id=hf-expires]").text(status.connected ? `${status.token_expires_at ? "expira " + fmtDate(status.token_expires_at) : "sem validade informada"}${status.has_refresh_token ? " · renova sozinho" : ""}` : "—");
    $("[c-id=hf-redirect]").text(status.redirect_uri || `${window.location.origin}/ai/oauth/callback`);
    $("[c-id=hf-disconnect], [c-id=hf-test]").prop("disabled", !status.connected);
    $("[c-id=hf-connect]").text(status.connected ? "Reconectar Higgsfield" : "Conectar Higgsfield");

    const fill = (selector, items, current, label = (item)=> item)=>{
        const $el = $(selector).html("");

        items.forEach(item=>{
            const value = typeof item == "string" ? item : item.id;

            $el.append(`<option value="${value}" ${value == current ? "selected" : ""}>${label(item)}</option>`);
        });
    };

    fill("[c-id=hf-model]", status.models, status.model, (item)=> item.name);
    fill("[c-id=hf-ratio]", status.aspect_ratios, status.aspect_ratio);
    fill("[c-id=hf-quality]", status.qualities, status.quality);
    $("[c-id=hf-unlim]").prop("checked", !!status.use_unlim);
};

const loadStatus = async()=>{
    try{

        const response = await request("GET", "/ai/settings");

        if(response.status != 200){
            throw(statusHandler.messageError(response.content || "Erro ao carregar integração", true));
        }

        renderStatus(response.content);

    }catch(error){
        statusHandler.messageError(error);
    }
};

$(document).ready(function(){

    loadStatus();

    // retorno do OAuth
    const params = new URLSearchParams(window.location.search);

    params.get("connected") && statusHandler.newMessage("Higgsfield conectada");
    params.get("error") && statusHandler.messageError(`Higgsfield: ${params.get("error")}`, true);
    (params.get("connected") || params.get("error")) && window.history.replaceState({}, "", window.location.pathname);

    $("[c-id=hf-connect]").on("click", async(e)=>{
        try{

            $(e.target).prop("disabled", true);
            $("[c-id=hf-message]").text("Registrando o painel na Higgsfield e abrindo a autorização...");

            const response = await request("POST", "/ai/connect");

            if(response.status != 200){
                throw(statusHandler.messageError(response.content || "Erro ao iniciar a conexão", true));
            }

            if(response.content.authorize_url){
                window.location.href = response.content.authorize_url;
                return;
            }

            statusHandler.newMessage("Higgsfield já conectada");
            await loadStatus();

        }catch(error){
            statusHandler.messageError(error);
        }finally{
            $(e.target).prop("disabled", false);
            $("[c-id=hf-message]").text("");
        }
    });

    $("[c-id=hf-test]").on("click", async(e)=>{
        try{

            $(e.target).prop("disabled", true);

            const response = await request("POST", "/ai/test");

            if(response.status != 200){
                throw(statusHandler.messageError(response.content || "Falha no teste", true));
            }

            const {tools, has_generate, has_wait, balance} = response.content;

            $("[c-id=hf-credits]").text(balance?.credits != null ? `${balance.credits} (${balance.subscription_plan_type || "plano"})` : "—");
            statusHandler.newMessage(`Conexão OK: ${tools} ferramentas${has_generate && has_wait ? ", geração disponível" : ""}`);

        }catch(error){
            statusHandler.messageError(error);
        }finally{
            $(e.target).prop("disabled", false);
        }
    });

    $("[c-id=hf-disconnect]").on("click", async()=>{
        try{

            const ok = await confirmAction({title:"Desconectar Higgsfield", message:"O painel deixará de gerar imagens até conectar de novo.", okText:"Desconectar"});

            if(!ok){
                return;
            }

            const response = await request("POST", "/ai/disconnect");

            response.status == 200 ? statusHandler.newMessage("Higgsfield desconectada") : statusHandler.messageError(response.content, true);
            await loadStatus();

        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("[c-id=hf-save]").on("click", async()=>{
        try{

            const body = {
                model:$("[c-id=hf-model]").val(),
                aspect_ratio:$("[c-id=hf-ratio]").val(),
                quality:$("[c-id=hf-quality]").val(),
                use_unlim:$("[c-id=hf-unlim]").prop("checked")
            };

            const response = await request("PUT", "/ai/settings", body);

            if(response.status != 200){
                throw(statusHandler.messageError(response.content || "Erro ao salvar", true));
            }

            renderStatus(response.content);
            statusHandler.newMessage("Padrões salvos");

        }catch(error){
            statusHandler.messageError(error);
        }
    });

    AdminMedia.bindAiBar(document.querySelector("[c-id=hf-ai-bar]"), (image)=>{
        $("[c-id=hf-preview]").html(`<div class="model-img"><img src="${image}" alt=""></div>`);
    });
});
