// Página do pedido: rastreio ao vivo (17TRACK), chat de suporte inteligente (fatos reais do pedido) + formulário de problema.
// O servidor injeta window.TDR_ORDER (index.twig) com textos, assistente e ids; funciona com o template novo
// ([c-id=chat-root]) e com templates antigos (o chat é inserido antes do formulário).
const ORDER = window.TDR_ORDER || null;

const chatState = {built:false, loaded:false, busy:false};

const esc = (text)=> $("<span>").text(text == null ? "" : text).html();
const toHtml = (text)=> esc(text).replace(/\n/g, "<br>");

const orderIds = ()=>{
    const idOrder = ORDER?.idOrder || window.location.pathname.split("/").pop();
    const urlStore = ORDER?.urlStore || new URLSearchParams(window.location.search).get("urlStore") || "";

    return {idOrder, urlStore};
};

// onde o chat fica: [c-id=chat-root] no template novo; antes do formulário nos antigos
const chatRoot = ()=>{
    let root = $("[c-id=chat-root]");

    if(!root.length){
        root = $('<div c-id="chat-root"></div>');
        const form = $("[c-id=modal-problem-order] [c-id=form]");

        form.length ? root.insertBefore(form) : $("[c-id=modal-problem-order] .modal-body .container").append(root);
    }

    return root;
};

const buildChat = ()=>{
    if(chatState.built || !ORDER){
        return;
    }

    const i = ORDER.i18n;

    chatRoot().html(`
        <div class="chat-panel">
            <div class="chat-head">
                <div class="chat-avatar">${esc(ORDER.assistant.charAt(0))}</div>
                <div>
                    <div class="chat-name">${esc(ORDER.assistant)}</div>
                    <div class="chat-status"><span class="chat-dot"></span>${esc(i.online)}</div>
                </div>
            </div>
            <div c-id="chat-messages" class="chat-messages"></div>
            <div c-id="chat-typing" class="chat-typing none"><span></span><span></span><span></span><em>${esc(i.typing)}</em></div>
            <div c-id="chat-suggestions" class="chat-suggestions"></div>
            <form c-id="chat-form" class="chat-input">
                <input c-id="chat-text" type="text" maxlength="1000" placeholder="${esc(i.placeholder)}" autocomplete="off">
                <button type="submit" c-id="chat-send">${esc(i.send)}</button>
            </form>
        </div>`);

    // caixa de texto do fluxo antigo não é mais usada
    $("[c-id=box-info]").addClass("none");
    chatState.built = true;
};

const scrollChat = ()=>{
    const box = $("[c-id=chat-messages]")[0];

    box && (box.scrollTop = box.scrollHeight);
};

const addMessage = (role, content)=>{
    const who = role == "assistant" ? ORDER.assistant : ORDER.i18n.you;

    $("[c-id=chat-messages]").append(`
        <div class="chat-msg chat-msg-${role == "assistant" ? "assistant" : "user"}">
            <div class="chat-bubble">${toHtml(content)}</div>
            <div class="chat-meta">${esc(who)}</div>
        </div>`);
    scrollChat();
};

const setTyping = (on)=>{
    $("[c-id=chat-typing]").toggleClass("none", !on);
    $("[c-id=chat-send]").prop("disabled", on);
    on && scrollChat();
};

const showForm = ()=>{
    $("[c-id=modal-problem-order] [c-id=form]").removeClass("none")[0]?.scrollIntoView({behavior:"smooth", block:"start"});
};

const renderSuggestions = (suggestions = [])=>{
    const box = $("[c-id=chat-suggestions]").html("");
    const list = [...suggestions.slice(0, 3)];

    // a opção de reportar um problema (formulário) está sempre à mão
    $("[c-id=modal-problem-order] [c-id=form]").length && list.push({text:ORDER.i18n.report, form:true});

    list.forEach(item=>{
        const text = typeof item == "string" ? item : item.text;
        const chip = $(`<button type="button" class="chat-suggestion">${esc(text)}</button>`);

        chip.on("click", ()=> item.form ? showForm() : sendMessage(text));
        box.append(chip);
    });
};

const handleAction = (action)=>{
    if(action == "open_form"){
        return showForm();
    }

    if(action == "show_tracking"){
        $("[c-id=modal-problem-order]").modal("hide");
        ($("[c-id=tracking-root]")[0] || $(".order-tracking")[0])?.scrollIntoView({behavior:"smooth", block:"start"});
    }
};

// ---------------------------------------------------------------- rastreio ao vivo (17TRACK)
// Dados em window.TDR_ORDER.tracking (cache do servidor); o botão "Atualizar" consulta /order/tracking/:id?refresh=1.
// Painel em [c-id=tracking-root] (template novo) ou no fim da seção .order-tracking (templates antigos).
const trackState = {busy:false};

const trackRoot = ()=>{
    let root = $("[c-id=tracking-root]");

    if(!root.length){
        root = $('<div c-id="tracking-root"></div>');
        const section = $(".order-tracking");

        section.length ? section.append(root) : $("[c-id=copy-tracking]").first().closest(".tracking-card").after(root);
    }

    return root;
};

const trackClass = (item)=> item.problem ? "problem" : (item.stage || "unknown");

const trackEventHtml = (e)=> `
    <li class="track-event">
        <span class="track-event-time">${esc(e.date || "")}</span>
        <span class="track-event-text">${esc(e.description || "")}${e.location ? `<small>${esc(e.location)}</small>` : ""}</span>
    </li>`;

const renderTracking = (data)=>{
    const items = data?.items || [];

    if(!items.length){
        return;
    }

    const L = data.labels || {};

    trackRoot().html(`<h3 class="track-title">${esc(L.title || "")}</h3>` + items.map(item=>{
        const events = item.events || [];
        const visible = events.slice(0, 4);
        const hidden = events.slice(4);
        // modo dropshipping: nunca há link para o 17TRACK nem para transportadoras de origem; só a última milha
        const link = item.url || item.carrier_url;

        return `
        <div class="track-card track-${trackClass(item)}">
            <div class="track-head">
                <div>
                    <div class="track-number">${esc(item.number)}${item.carrier_name ? `<span class="track-carrier">${esc(L.carrier || "")}: ${esc(item.carrier_name)}</span>` : ""}</div>
                    <span class="track-badge" ${item.problem ? `title="${esc(L.problem || "")}"` : ""}>${esc(item.status_label || item.status || "")}</span>
                </div>
                <button type="button" class="track-refresh" c-id="tracking-refresh">${esc(L.refresh || "Refresh")}</button>
            </div>
            ${item.estimated_fmt ? `<p class="track-eta">${esc(L.eta || "")}: <b>${esc(item.estimated_fmt)}</b></p>` : ""}
            ${item.latest_event
                ? `<p class="track-latest"><span class="track-event-time">${esc(item.latest_event.date || "")}${item.latest_event.location ? ` · ${esc(item.latest_event.location)}` : ""}</span>${esc(item.latest_event.description || "")}</p>`
                : `<p class="track-empty">${esc(item.international ? (L.international || L.no_info || "") : (L.no_info || ""))}</p>`}
            ${events.length ? `
            <details class="track-events"${events.length <= 4 ? " open" : ""}>
                <summary>${esc(L.events || "")} (${events.length})</summary>
                <ul class="track-list">${visible.map(trackEventHtml).join("")}</ul>
                ${hidden.length ? `<ul class="track-list track-more none">${hidden.map(trackEventHtml).join("")}</ul>
                <button type="button" class="track-toggle" c-id="tracking-more" data-more="${esc(L.show_all || "")}" data-less="${esc(L.hide || "")}">${esc(L.show_all || "")}</button>` : ""}
            </details>` : ""}
            <div class="track-foot">
                <span>${item.days_in_transit != null ? `${esc(item.days_in_transit)} ${esc(L.transit_days || "")} · ` : ""}${esc(L.updated || "")}: ${esc(item.fetched_fmt || "")}</span>
                ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(item.carrier_name || L.carrier || "")} ↗</a>` : ""}
            </div>
        </div>`;
    }).join(""));
};

const refreshTracking = async(button)=>{
    if(trackState.busy){
        return;
    }

    trackState.busy = true;
    $(button).prop("disabled", true);

    try{

        const {idOrder, urlStore} = orderIds();
        const response = await request("GET", `/order/tracking/${idOrder}?urlStore=${encodeURIComponent(urlStore)}&refresh=1`);

        response.status == 200 && renderTracking(response.content);

    }catch(error){
    }finally{
        trackState.busy = false;
        $(button).prop("disabled", false);
    }
};

const loadChat = async()=>{
    try{

        if(chatState.loaded || !ORDER){
            return;
        }

        chatState.loaded = true;

        // pré-visualização sem servidor (usada em screenshots)
        if(ORDER.preview_messages){
            ORDER.preview_messages.forEach(m=> addMessage(m.role, m.content));
            renderSuggestions(ORDER.i18n.suggestions);
            return;
        }

        setTyping(true);

        const {idOrder, urlStore} = orderIds();
        const response = await request("GET", `/order/chat/${idOrder}?urlStore=${encodeURIComponent(urlStore)}`);

        setTyping(false);

        if(response.status != 200){
            addMessage("assistant", ORDER.i18n.offline);
            renderSuggestions([]);
            return showForm();
        }

        response.content.messages.forEach(m=> addMessage(m.role, m.content));
        renderSuggestions(response.content.suggestions);

    }catch(error){
        setTyping(false);
        addMessage("assistant", ORDER.i18n.offline);
        renderSuggestions([]);
    }
};

const sendMessage = async(text)=>{
    try{

        text = String(text || "").trim();

        if(!text || chatState.busy){
            return;
        }

        chatState.busy = true;
        $("[c-id=chat-text]").val("");
        $("[c-id=chat-suggestions]").html("");
        addMessage("user", text);
        setTyping(true);

        const {idOrder, urlStore} = orderIds();
        const response = await request("POST", `/order/chat/${idOrder}`, {urlStore, message:text});

        setTyping(false);

        if(response.status != 200){
            addMessage("assistant", response.status == 429 ? ORDER.i18n.offline : ORDER.i18n.error);
            renderSuggestions([]);
            response.status == 429 && showForm();
            return;
        }

        addMessage("assistant", response.content.reply);
        renderSuggestions(response.content.suggestions);
        handleAction(response.content.action);

    }catch(error){
        setTyping(false);
        addMessage("assistant", ORDER?.i18n?.error || "Error");
    }finally{
        chatState.busy = false;
    }
};

// ---------------------------------------------------------------- formulário de problema (contestação)
const getImages = async()=>{
    try{

        const file = $("[c-id=form]").find("[c-id=images]").prop("files");
        let imgs = [];

        for(const item of Array.from(file || [])){
            item.size && imgs.push(await convertFileToBase64(item));
        }

        return imgs;
    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const saveForm = async()=>{
    try{

        const {idOrder} = orderIds();
        const ctx = "[c-id=form]";
        const email = $(ctx).find("[c-id=email]").val();
        const justification = $(ctx).find("[c-id=justification]").val();
        const images = await getImages();

        if(!email || !justification || !images.length){
            return statusHandler.messageError(ORDER?.i18n?.form_required || "Please fill in all fields and add at least one image.", true);
        }

        $(ctx).find("[c-id=save-form]").prop("disabled", true);

        const response = await request("POST", "/order/charge", {email, justification, images, idOrder});

        if(response.status == 200){
            $(ctx).html(`<p>${window.default_message || esc(ORDER?.i18n?.sent || "Sent.")}</p>`);
            await delay(4000);
            window.location.href = `/order/${idOrder}`;
            return;
        }

        $(ctx).find("[c-id=save-form]").prop("disabled", false);
        statusHandler.messageError(response.content || "Error", true);

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

// ---------------------------------------------------------------- eventos
$(document).ready(function(){

    // painel de rastreio ao vivo com o cache que veio do servidor
    ORDER?.tracking?.items?.length && renderTracking(ORDER.tracking);

    $("body").on("click", "[c-id=tracking-refresh]", (e)=> refreshTracking(e.currentTarget));

    $("body").on("click", "[c-id=tracking-more]", (e)=>{
        const more = $(e.currentTarget).siblings(".track-more").toggleClass("none");

        $(e.currentTarget).text($(e.currentTarget).attr(more.hasClass("none") ? "data-more" : "data-less"));
    });

    $("[c-id=btn-problem-order]").on("click", ()=>{
        $("[c-id=modal-problem-order]").modal("show");
        buildChat();
        loadChat();
    });

    $("[c-id=close-modal]").on("click", ()=> $("[c-id=modal-problem-order]").modal("hide"));

    $("[c-id=modal-problem-order]").on("submit", "[c-id=chat-form]", (e)=>{
        e.preventDefault();
        sendMessage($("[c-id=chat-text]").val());
    });

    // template antigo: o select de problemas vira a primeira mensagem do chat (4 e 5 abrem o formulário)
    $("[c-id=check]").on("click", (e)=>{
        const option = $("[c-id=option-problem]").val();
        const text = $("[c-id=option-problem] option:selected").text();

        $(e.target).addClass("none");
        buildChat();

        if(option == 4 || option == 5){
            return showForm();
        }

        ORDER ? sendMessage(text) : showForm();
    });

    $("[c-id=save-form]").on("click", async()=>{
        try{
            await saveForm();
        }catch(error){
            statusHandler.messageError(error);
        }
    });

    // copiar código de rastreio
    $("body").on("click", "[c-id=copy-tracking]", async(e)=>{
        try{
            const code = $(e.currentTarget).attr("data-code");

            await navigator.clipboard.writeText(code);
            $(e.currentTarget).text($(e.currentTarget).attr("data-copied") || "OK");
        }catch(error){}
    });
});
