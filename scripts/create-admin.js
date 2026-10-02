// Cria um usuário do painel admin (senha guardada com bcrypt).
// Uso: npm run create-admin -- <usuario> <senha>   (ou node scripts/create-admin.js <usuario> <senha>)
// Usa URL_DB do .env.
require("dotenv").config();
const { createAdmin } = require("../src/auth/auth.service");

const [username, password] = process.argv.slice(2);

(async()=>{
    try{

        if(!username || !password){
            console.error("Uso: npm run create-admin -- <usuario> <senha>");
            process.exit(1);
        }

        const response = await createAdmin({username, password});

        console.log(`${response.content}: ${username.trim().toLowerCase()}`);
        process.exit(0);

    }catch(error){
        console.error(error.content || error.message || error);
        process.exit(1);
    }
})();
