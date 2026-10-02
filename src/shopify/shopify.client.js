const axios = require('axios');
const statusHandler = require("../helpers/helpers.statusHandler");
const { request, isEmpty } = require("../helpers/helpers.global");
const { updateById } = require("../query");
const { Shopify } = require("./shopify.schema");

// Versão estável da API (trimestral). Atualize aqui ou via .env.
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-10";

// Tokens do client credentials grant (valem 24h), por domínio + client_id
const adminTokens = {};

const normalizeDomain = (url)=> String(url || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

const hasClientCredentials = (shopify)=> !isEmpty(shopify.client_id) && !isEmpty(shopify.client_secret);

// Apps do Dev Dashboard: troca client_id/client_secret por um token Admin.
// Apps legados criados no admin: usa o token_admin fixo.
const getAdminToken = async(shopify)=>{
    try{

        const domain = normalizeDomain(shopify.url);

        if(hasClientCredentials(shopify)){

            const cacheKey = `${domain}:${shopify.client_id}`;
            const cached = adminTokens[cacheKey];

            if(cached && cached.expiresAt > Date.now()){
                return cached.token;
            }

            const response = await axios.post(
                `https://${domain}/admin/oauth/access_token`,
                new URLSearchParams({
                    grant_type:"client_credentials",
                    client_id:shopify.client_id,
                    client_secret:shopify.client_secret
                }),
                { headers:{ "Content-Type":"application/x-www-form-urlencoded" } }
            );

            const {access_token, expires_in} = response.data;

            // renova 5 minutos antes de expirar
            adminTokens[cacheKey] = {
                token:access_token,
                expiresAt:Date.now() + (expires_in - 300) * 1000
            };

            return access_token;
        }

        if(!isEmpty(shopify.token_admin)){
            return shopify.token_admin;
        }

        throw(statusHandler.newResponse(400, `Shopify ${domain} sem credenciais Admin`));

    }catch(error){

        if(error.response){
            console.warn('\x1b[33m%s\x1b[0m', error.response.data);
            throw(statusHandler.newResponse(401, "Erro ao autenticar na Shopify"));
        }

        throw(statusHandler.serviceError(error));
    }
};

// Sem token Storefront cadastrado, cria um pela Admin API e salva no banco.
// O app precisa ter os escopos unauthenticated_* liberados.
const getStorefrontToken = async(shopify)=>{
    try{

        if(!isEmpty(shopify.token_storefront)){
            return shopify.token_storefront;
        }

        const query = `
            mutation StorefrontAccessTokenCreate($input: StorefrontAccessTokenInput!) {
                storefrontAccessTokenCreate(input: $input) {
                    storefrontAccessToken { accessToken }
                    userErrors { field message }
                }
            }
        `;

        const data = await shopifyGraphql(shopify, "admin", query, { input:{ title:"basic-ecomm" } });
        const {storefrontAccessToken, userErrors} = data.storefrontAccessTokenCreate;

        if(!storefrontAccessToken){
            throw(statusHandler.newResponse(400, userErrors));
        }

        await updateById(Shopify, shopify._id, { token_storefront:storefrontAccessToken.accessToken });
        shopify.token_storefront = storefrontAccessToken.accessToken;

        return storefrontAccessToken.accessToken;

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

// api: "admin" | "storefront". Retorna `data` da resposta GraphQL.
const shopifyGraphql = async(shopify, api, query, variables = {}, retry = true)=>{
    try{

        const domain = normalizeDomain(shopify.url);
        const isAdmin = api === "admin";

        const url = isAdmin
            ? `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`
            : `https://${domain}/api/${SHOPIFY_API_VERSION}/graphql.json`;

        const headers = isAdmin
            ? { "X-Shopify-Access-Token": await getAdminToken(shopify) }
            : { "X-Shopify-Storefront-Access-Token": await getStorefrontToken(shopify) };

        const raw = await request("POST", url, { query, variables }, headers);
        const response = typeof raw === "string" ? JSON.parse(raw) : raw;

        if(isEmpty(response?.data)){

            // token do client credentials revogado/expirado antes do previsto
            if(isAdmin && retry && hasClientCredentials(shopify)){
                delete adminTokens[`${domain}:${shopify.client_id}`];
                return await shopifyGraphql(shopify, api, query, variables, false);
            }

            throw(statusHandler.newResponse(502, response?.errors || "Erro na Shopify"));
        }

        if(response.errors){
            console.warn('\x1b[33m%s\x1b[0m', JSON.stringify(response.errors));
        }

        return response.data;

    }catch(error){
        throw(statusHandler.serviceError(error));
    }
};

module.exports = {
    SHOPIFY_API_VERSION,
    shopifyGraphql
};
