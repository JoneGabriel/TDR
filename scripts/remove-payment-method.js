// Remove a linha "Pago com <gateway>" (paymentGatewayNames) dos templates de pedido já salvos nas lojas.
// O padrão em store.schema.js não a tem mais; este script atualiza as lojas existentes (layouts first/second e legado).
// Uso: node scripts/remove-payment-method.js [--dry-run]   (na VPS: docker compose exec app node scripts/remove-payment-method.js)
require("dotenv").config();
const mongoose = require("mongoose");
const { dbUrl } = require("../src/query");

const BLOCK = /[ \t]*\{%\s*if\s+order\.paymentGatewayNames\|length\s*>\s*0\s*%\}[\s\S]*?\{%\s*endif\s*%\}[ \t]*\r?\n?/g;
const FIELDS = ["layouts.first.order_template", "layouts.second.order_template", "order_template"];
const dryRun = process.argv.includes("--dry-run");

const get = (obj, path)=> path.split(".").reduce((o, k)=> (o == null ? undefined : o[k]), obj);

(async()=>{
    try{

        await mongoose.connect(dbUrl());

        const stores = mongoose.connection.db.collection("stores");
        const rows = await stores.find({}, {projection:{name:1, order_template:1, "layouts.first.order_template":1, "layouts.second.order_template":1}}).toArray();
        let changed = 0;

        for(const store of rows){
            let update = {};

            FIELDS.forEach(field=>{
                const value = get(store, field);

                if(typeof value == "string" && BLOCK.test(value)){
                    update[field] = value.replace(BLOCK, "");
                }

                BLOCK.lastIndex = 0;
            });

            if(!Object.keys(update).length){
                continue;
            }

            changed++;
            console.log(`${dryRun ? "[dry-run] " : ""}${store.name}: ${Object.keys(update).join(", ")}`);
            dryRun || await stores.updateOne({_id:store._id}, {$set:update});
        }

        console.log(`${changed} loja(s) ${dryRun ? "seriam atualizadas" : "atualizadas"} de ${rows.length}`);
        process.exit(0);

    }catch(error){
        console.error(error.message || error);
        process.exit(1);
    }
})();
