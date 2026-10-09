// Cria um usuário do painel admin (senha guardada com bcrypt).
// Uso: npm run create-admin -- <usuario> <senha> [superadmin|owner|staff] [idDaConta]
//   sem papel: superadmin (operador do sistema, vê todas as contas; não precisa de conta)
//   owner/staff: exige o id da conta (ver /admin/accounts)
// Usa URL_DB do .env (ou MONGO_HOST/MONGO_USER/MONGO_PASSWORD no docker-compose; ver dbUrl em src/query.js).
require("dotenv").config();
const { createAdmin } = require("../src/auth/auth.service");
const { ensureMainAccount } = require("../src/account/account.service");

const [username, password, role = "superadmin", account = null] = process.argv.slice(2);

(async()=>{
    try{

        if(!username || !password){
            console.error("Uso: npm run create-admin -- <usuario> <senha> [superadmin|owner|staff] [idDaConta]");
            process.exit(1);
        }

        // garante a conta principal (dona do que já existe no banco)
        await ensureMainAccount();

        const response = await createAdmin({username, password, role, account});

        console.log(`${response.content.message}: ${response.content.username} (${response.content.role})`);
        process.exit(0);

    }catch(error){
        console.error(error.content || error.message || error);
        process.exit(1);
    }
})();
