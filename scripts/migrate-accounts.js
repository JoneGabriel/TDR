// Migração para multiusuário: cria a "Conta principal" (ativa) e liga a ela tudo o que ainda não tem dono:
// lojas, lista branca e página branca do cloaker, configurações (Higgsfield) e usuários do painel (viram superadmin).
// Idempotente: pode rodar mais de uma vez. Uso: npm run migrate-accounts [-- --dry-run]
//   na VPS: docker compose exec app npm run migrate-accounts
require("dotenv").config();
const mongoose = require("mongoose");
const { dbUrl } = require("../src/query");

const dryRun = process.argv.includes("--dry-run");
const nowBrazil = ()=> new Date(Date.now() - 3 * 60 * 60 * 1000);

(async()=>{
    try{

        await mongoose.connect(dbUrl());

        const db = mongoose.connection.db;
        const accounts = db.collection("accounts");
        let main = await accounts.findOne({}, {sort:{createdAt:1}});

        if(!main){
            const doc = {name:"Conta principal", status:"active", createdAt:nowBrazil(), approved_at:nowBrazil(), approved_by:"migração"};

            if(dryRun){
                console.log("[dry-run] criaria a Conta principal");
                main = {_id:null, name:doc.name};
            }else{
                const r = await accounts.insertOne(doc);

                main = {_id:r.insertedId, name:doc.name};
                console.log(`Conta principal criada: ${main._id}`);
            }
        }else{
            console.log(`Conta principal existente: ${main.name} (${main._id})`);
        }

        const orphan = {$or:[{account:{$exists:false}}, {account:null}]};
        const plan = [
            ["stores", {$set:{account:main._id}}],
            ["white_lists", {$set:{account:main._id}}],
            ["white_pages", {$set:{account:main._id}}],
            ["settings", {$set:{account:main._id}}],
            ["admins", {$set:{account:main._id, role:"superadmin"}}]
        ];

        for(const [name, update] of plan){
            const count = await db.collection(name).countDocuments(orphan);

            if(dryRun){
                console.log(`[dry-run] ${name}: ${count} documento(s) sem conta`);
                continue;
            }

            if(count){
                await db.collection(name).updateMany(orphan, update);
            }

            console.log(`${name}: ${count} documento(s) ligados à Conta principal`);
        }

        // índice antigo único em settings.key impediria uma configuração por conta
        if(!dryRun){
            await db.collection("settings").dropIndex("key_1").then(()=> console.log("settings: índice único antigo removido")).catch(()=> {});
        }

        console.log(dryRun ? "dry-run concluído" : "migração concluída");
        process.exit(0);

    }catch(error){
        console.error(error.message || error);
        process.exit(1);
    }
})();
