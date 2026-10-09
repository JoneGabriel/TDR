// Contas (multiusuário): escopo dos dados do painel. Cada Store tem `account`; domínios, produtos, coleções,
// bundles, variantes e Shopifys pertencem à conta pela loja. `scope` é o id da conta em uso (null = superadmin
// vendo tudo). As guardas devolvem o documento quando ele está no escopo e respondem 404 quando não está,
// sem revelar que o registro existe em outra conta.
const statusHandler = require("../helpers/helpers.statusHandler");
const { findAll, findOne, findById, save, updateById, countDocuments } = require("../query");
const mongoose = require("mongoose");

// id malformado nas guardas vale como inexistente (404), em vez de erro de conversão
const byId = (Model, id)=> mongoose.isValidObjectId(id) ? findById(Model, id) : null;
const { Account, ACCOUNT_STATUS } = require("./account.schema");
const { Admin } = require("../auth/auth.schema");
const { Store } = require("../store/store.schema");
const { Domain } = require("../domain/domain.schema");
const { Product, Collection, Bundle, OtherVariants } = require("../product/product.schema");
const { Shopify } = require("../shopify/shopify.schema");
const { WhiteList } = require("../cloacker/cloacker.schema");

const nowBrazil = ()=> new Date(Date.now() - 3 * 60 * 60 * 1000);
const notFound = (what)=> statusHandler.newResponse(404, `${what} não encontrado(a)`);
const same = (a, b)=> String(a || "") == String(b || "");

// ---------------------------------------------------------------- escopo
// ids das lojas da conta; null = sem restrição (superadmin)
const storeIdsOf = async(scope)=>{
    if(!scope) return null;

    const stores = await findAll(Store, {account:scope}, {_id:1});

    return stores.map(store=> String(store._id));
};

// filtro de consulta para coleções que apontam para a loja (campo `store` por padrão)
const storeFilter = async(scope, field = "store")=>{
    const ids = await storeIdsOf(scope);

    return ids ? {[field]:{$in:ids}} : {};
};

// nomes dos domínios da conta (métricas); null = todos
const domainNamesOf = async(scope)=>{
    const filter = await storeFilter(scope);

    if(!Object.keys(filter).length) return null;

    const domains = await findAll(Domain, filter, {domain:1});

    return domains.map(d=> d.domain);
};

const storeInScope = async(scope, storeId)=>{
    if(!scope) return true;
    if(!storeId) return false;

    const store = await findOne(Store, {_id:storeId, account:scope});

    return !!store;
};

// ---------------------------------------------------------------- guardas (documento no escopo ou 404)
const assertStore = async(scope, id)=>{
    const store = id ? await byId(Store, id) : null;

    if(!store || (scope && !same(store.account, scope))) throw(notFound("Loja"));

    return store;
};

const assertDomain = async(scope, id)=>{
    const domain = id ? await byId(Domain, id) : null;

    if(!domain || !(await storeInScope(scope, domain.store))) throw(notFound("Domínio"));

    return domain;
};

const assertCollection = async(scope, id)=>{
    const collection = id ? await byId(Collection, id) : null;

    if(!collection || !(await storeInScope(scope, collection.store))) throw(notFound("Coleção"));

    return collection;
};

const assertProduct = async(scope, id)=>{
    const product = id ? await byId(Product, id) : null;

    if(!product || !(await storeInScope(scope, product.store))) throw(notFound("Produto"));

    return product;
};

const assertShopify = async(scope, id)=>{
    const shopify = id ? await byId(Shopify, id) : null;

    if(!shopify || !(await storeInScope(scope, shopify.store))) throw(notFound("Shopify"));

    return shopify;
};

const assertBundle = async(scope, id)=>{
    const bundle = id ? await byId(Bundle, id) : null;

    if(!bundle) throw(notFound("Bundle"));

    await assertProduct(scope, bundle.product);

    return bundle;
};

// variante Shopify ligada a um produto (OtherVariants.product)
const assertOtherVariant = async(scope, id)=>{
    const variant = id ? await byId(OtherVariants, id) : null;

    if(!variant) throw(notFound("Variante"));

    await assertProduct(scope, variant.product);

    return variant;
};

const assertIp = async(scope, id)=>{
    const ip = id ? await byId(WhiteList, id) : null;

    if(!ip || (scope && !same(ip.account, scope))) throw(notFound("IP"));

    return ip;
};

// ---------------------------------------------------------------- contas (superadmin)
const getAccount = async(id)=> id ? await byId(Account, id) : null;

const listAccounts = async()=>{
    try{

        const accounts = await findAll(Account, {});
        let rows = [];

        for(const account of accounts){
            const stores = await findAll(Store, {account:account._id}, {_id:1});
            const ids = stores.map(s=> s._id);
            const owner = await findOne(Admin, {account:account._id, role:"owner"});

            rows.push({
                _id:account._id,
                name:account.name,
                email:account.email,
                status:account.status,
                createdAt:account.createdAt,
                approved_at:account.approved_at,
                owner:owner ? owner.username : "",
                users:await countDocuments(Admin, {account:account._id}),
                stores:ids.length,
                domains:ids.length ? await countDocuments(Domain, {store:{$in:ids}}) : 0,
                products:ids.length ? await countDocuments(Product, {store:{$in:ids}}) : 0
            });
        }

        rows.sort((a, b)=> (a.status == "pending" ? 0 : 1) - (b.status == "pending" ? 0 : 1) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        return statusHandler.newResponse(200, rows);

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

const setAccountStatus = async(id, status, by = "")=>{
    try{

        if(!ACCOUNT_STATUS.includes(status)){
            throw(statusHandler.newResponse(400, `Status inválido: ${status}`));
        }

        const account = await getAccount(id);

        if(!account){
            throw(notFound("Conta"));
        }

        let update = {status};

        status == "active" && (update.approved_at = nowBrazil(), update.approved_by = by);

        await updateById(Account, id, update);

        return statusHandler.newResponse(200, {status});

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// cria a conta principal (operador) se ainda não existir nenhuma; usada pela migração e pelo create-admin
const ensureMainAccount = async()=>{
    const existing = await findOne(Account, {});

    if(existing) return existing;

    return await save(Account, {name:"Conta principal", status:"active", createdAt:nowBrazil(), approved_at:nowBrazil(), approved_by:"sistema"});
};

module.exports = {
    storeIdsOf,
    storeFilter,
    domainNamesOf,
    storeInScope,
    assertStore,
    assertDomain,
    assertCollection,
    assertProduct,
    assertShopify,
    assertBundle,
    assertOtherVariant,
    assertIp,
    getAccount,
    listAccounts,
    setAccountStatus,
    ensureMainAccount
};
