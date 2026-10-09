// Limite de taxa em memória, por IP e por nome de rota (um processo por container; `req.ip` depende de TRUST_PROXY).
// Uso: router.post("/x", rateLimit({name:"x", windowMs, max}), handler). Resposta padrão 429 em JSON; `onLimit` troca.
const statusHandler = require("./helpers.statusHandler");

const buckets = new Map();
const PRUNE_MS = 60 * 1000;
let lastPrune = Date.now();

const prune = (now)=>{
    if(now - lastPrune < PRUNE_MS){
        return;
    }

    lastPrune = now;

    for(const [key, bucket] of buckets){
        bucket.reset <= now && buckets.delete(key);
    }
};

const rateLimit = ({name = "default", windowMs = 60 * 1000, max = 60, methods = null, key = (req)=> req.ip, message = "Muitas requisições. Tente de novo em instantes.", onLimit = null} = {})=> (req, res, next)=>{
    if(methods && !methods.includes(req.method)){
        return next();
    }

    const now = Date.now();

    prune(now);

    const id = `${name}|${key(req)}`;
    let bucket = buckets.get(id);

    if(!bucket || bucket.reset <= now){
        bucket = {count:0, reset:now + windowMs};
        buckets.set(id, bucket);
    }

    bucket.count++;
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - bucket.count));

    if(bucket.count > max){
        const retry = Math.ceil((bucket.reset - now) / 1000);

        res.setHeader("Retry-After", retry);

        return onLimit ? onLimit(req, res, retry) : res.status(429).send(statusHandler.newResponse(429, message));
    }

    return next();
};

// só para testes
const resetRateLimits = ()=> buckets.clear();

module.exports = { rateLimit, resetRateLimits };
