// Área do próprio usuário (/admin/profile): dados, e-mail e troca de senha. API em auth.controller.js (/admin/me).
const ROLE_LABEL = {superadmin:"Superadmin", owner:"Dono da conta", staff:"Usuário"};
const ACCOUNT_STATUS_LABEL = {pending:"pendente", active:"ativa", blocked:"bloqueada"};

// datas gravadas já deslocadas para o horário de Brasília: formata como UTC para não deslocar de novo
const fmtDateTime = (value)=> value ? new Date(value).toLocaleString("pt-BR", {timeZone:"UTC", dateStyle:"short", timeStyle:"short"}) : "—";

const busy = (spinner, button, on)=>{
    $(spinner).toggleClass("none", !on);
    $(button).prop("disabled", on);
};

const loadProfile = async()=>{
    try{

        const response = await request("GET", "/admin/me");

        if(response?.status != 200){
            throw(statusHandler.messageError(response?.content || "Não foi possível carregar seus dados", true));
        }

        const {username, email, role, createdAt, password_changed_at, account} = response.content;

        $("[c-id=username]").text(username);
        $("[c-id=role]").text(ROLE_LABEL[role] || role).toggleClass("is-active", role == "superadmin");
        $("[c-id=account]").text(account ? account.name : (role == "superadmin" ? "Todas (operador do sistema)" : "—"));
        $("[c-id=account-status]")
            .toggleClass("none", !account)
            .removeClass("is-pending is-active is-blocked")
            .addClass(account ? `is-${account.status}` : "")
            .text(account ? (ACCOUNT_STATUS_LABEL[account.status] || account.status) : "");
        $("[c-id=created]").text(fmtDateTime(createdAt));
        $("[c-id=password-changed]").text(password_changed_at ? fmtDateTime(password_changed_at) : "nunca (senha inicial)");
        $("[c-id=email]").val(email || "");

    }catch(error){
        statusHandler.messageError(error);
    }
};

const saveProfile = async()=>{
    try{

        busy("[c-id=loading-profile]", "[c-id=save-profile]", true);

        const response = await request("PUT", "/admin/me", {email:$("[c-id=email]").val().trim()});

        if(response?.status != 200){
            throw(statusHandler.messageError(response?.content || "Erro ao salvar", true));
        }

        statusHandler.newMessage(response.content);
        await loadProfile();

    }catch(error){
        statusHandler.messageError(error);
    }finally{
        busy("[c-id=loading-profile]", "[c-id=save-profile]", false);
    }
};

const savePassword = async()=>{
    try{

        const body = {
            current_password:$("[c-id=current_password]").val(),
            password:$("[c-id=password]").val(),
            password_confirm:$("[c-id=password_confirm]").val()
        };

        // as mesmas regras do servidor, para responder sem ida ao servidor
        if(!body.current_password || !body.password){
            throw(statusHandler.messageError("Informe a senha atual e a nova senha", true));
        }

        if(body.password.length < 8){
            throw(statusHandler.messageError("A nova senha precisa ter no mínimo 8 caracteres", true));
        }

        if(body.password !== body.password_confirm){
            throw(statusHandler.messageError("A confirmação não confere com a nova senha", true));
        }

        busy("[c-id=loading-password]", "[c-id=save-password]", true);

        const response = await request("PUT", "/admin/me/password", body);

        if(response?.status != 200){
            throw(statusHandler.messageError(response?.content || "Erro ao alterar a senha", true));
        }

        statusHandler.newMessage(response.content);
        $("[c-id=password-form]")[0].reset();
        await loadProfile();

    }catch(error){
        statusHandler.messageError(error);
    }finally{
        busy("[c-id=loading-password]", "[c-id=save-password]", false);
    }
};

$(document).ready(function(){

    loadProfile();

    $("[c-id=save-profile]").on("click", saveProfile);

    $("[c-id=password-form]").on("submit", (e)=>{
        e.preventDefault();
        savePassword();
    });

    // mostrar/ocultar a senha do campo ao lado
    $("body").on("click", "[c-id=toggle-password]", (e)=>{
        const input = $(e.currentTarget).siblings("input");
        const show = input.attr("type") == "password";

        input.attr("type", show ? "text" : "password");
        $(e.currentTarget).find("i").attr("class", show ? "bi bi-eye-slash" : "bi bi-eye");
    });
});
