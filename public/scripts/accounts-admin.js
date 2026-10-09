// Contas (superadmin): lista com filtros, aprovar/bloquear/reativar e "entrar como" (cookie admin_as).
let accountsCache = [];

const fmtDate = (value)=>{
    if(!value) return "";

    const date = new Date(value);

    return isNaN(date) ? "" : date.toLocaleDateString("pt-BR");
};

const STATUS_LABEL = {pending:"Pendente", active:"Ativa", blocked:"Bloqueada"};

const renderAccounts = ()=>{
    const status = $("[c-id=filter-status]").val();
    const text = ($("[c-id=filter-text]").val() || "").trim().toLowerCase();
    const ctx = $("[c-id=all-accounts]").html("");
    let shown = 0;

    accountsCache.forEach(account=>{
        if(status && account.status != status) return;
        if(text && !`${account.name} ${account.email} ${account.owner}`.toLowerCase().includes(text)) return;

        const model = $("[c-id=model-account]").clone()[0];

        $(model).attr("id", account._id).removeClass("none");
        $(model).find("[c-id=name]").text(account.name);
        $(model).find("[c-id=email]").text(account.email || "");
        $(model).find("[c-id=created]").text(account.createdAt ? `cadastro em ${fmtDate(account.createdAt)}` : "");
        $(model).find("[c-id=owner]").text(account.owner || "—");
        $(model).find("[c-id=users]").text(account.users > 1 ? `+${account.users - 1} usuário(s)` : "");
        $(model).find("[c-id=status]").text(STATUS_LABEL[account.status] || account.status).addClass(`is-${account.status}`);
        $(model).find("[c-id=counts]").text(`${account.stores} · ${account.domains} · ${account.products}`);
        $(model).find("[c-id=btn-approve]").toggleClass("none", account.status == "active").text(account.status == "blocked" ? "Reativar" : "Aprovar");
        $(model).find("[c-id=btn-block]").toggleClass("none", account.status == "blocked");
        ctx.append(model);
        shown++;
    });

    $("[c-id=empty]").toggleClass("none", shown > 0);
};

const loadAccounts = async()=>{
    try{

        const response = await request("GET", "/accounts");

        if(response.status != 200){
            return statusHandler.messageError(response.content || "Erro ao listar contas", true);
        }

        accountsCache = response.content;
        renderAccounts();

    }catch(error){
        statusHandler.messageError(error);
    }
};

const setStatus = async(id, status)=>{
    const response = await request("PUT", `/accounts/${id}/status`, {status});

    if(response.status != 200){
        return statusHandler.messageError(response.content || "Erro", true);
    }

    statusHandler.newMessage(`Conta ${STATUS_LABEL[status].toLowerCase()}`);
    await loadAccounts();
};

$(document).ready(function(){

    loadAccounts();

    $("[c-id=filter-status]").on("change", renderAccounts);
    $("[c-id=filter-text]").on("input", renderAccounts);

    $("body").on("click", "[c-id=model-account] button", async(e)=>{
        try{

            const row = $(e.currentTarget).closest("[c-id=model-account]");
            const id = row.attr("id");
            const name = row.find("[c-id=name]").text();
            const action = $(e.currentTarget).attr("c-id");

            if(action == "btn-approve"){
                return await setStatus(id, "active");
            }

            if(action == "btn-block"){
                const ok = await confirmAction({title:"Bloquear conta", message:`Os usuários de "${name}" perdem o acesso ao painel até a conta ser reativada. As lojas continuam no ar.`, okText:"Bloquear"});

                ok && await setStatus(id, "blocked");
                return;
            }

            if(action == "btn-enter"){
                const response = await request("POST", `/accounts/${id}/impersonate`);

                if(response.status == 200){
                    window.location.href = "/admin/home";
                    return;
                }

                statusHandler.messageError(response.content || "Erro", true);
            }

        }catch(error){
            statusHandler.messageError(error);
        }
    });
});
