/*! pag-checkout v2 - PagAmerican cart-swap, adaptado para a vitrine do TDR.
 *
 * O script original intercepta o checkout de um tema Shopify, lê o carrinho em /cart.js e envia à plataforma.
 * Aqui o carrinho vive no localStorage e só o servidor conhece os ids de variante da Shopify, então:
 *   - o clique interceptado é o do botão de finalizar do template do carrinho ([c-id=btn-checkout]);
 *   - o carrinho no formato do /cart.js vem de POST /checkout/cart-json (cart.service.js), com ids de variante,
 *     ids de produto da Shopify e preços em centavos na moeda da visita;
 *   - "limpar o carrinho" (skipCart) é limpar o localStorage.
 * A captura de parâmetros de rastreamento (primeira visita, sessionStorage), a consulta de status e a chamada
 * POST {API}/v1/shopify/cart?<rastreamento> com {shop, internalDomain, cart} são as mesmas do original.
 *
 * Uso: no fim do template do carrinho (cart_template) da loja, no layout desejado, uma tag script com
 *   src="/scripts/pag-checkout.js" e os atributos data-pag-checkout, data-api-base="https://API-DA-PLATAFORMA"
 *   e data-shop="sualoja.myshopify.com".
 * Opcionais: data-button="<seletor>" (padrão [c-id=btn-checkout]);
 *            data-tdr-base="https://dominio-do-app" se a rota /checkout/cart-json não estiver no mesmo domínio da vitrine;
 *            data-fallback="native" para cair no checkout normal da Shopify quando a plataforma falhar
 *            (padrão: o comprador fica na página e um novo clique tenta de novo, como no original).
 * Inline (código colado dentro de uma tag script): os atributos vão na própria tag, ou defina antes
 *   window.PAG_CHECKOUT = {apiBase:"https://API", shop:"sualoja.myshopify.com", button:"...", fallback:"native"}.
 *   Atenção: este comentário não pode conter a sequência de fechamento da tag script, senão o navegador corta o
 *   código ali quando ele está inline.
 */
(function () {
  // Parâmetros de anúncio/tracker reconhecidos: tornam a query digna de captura sozinha e são os únicos que podem
  // sobrescrever um primeiro toque já guardado. Não é um filtro: capturada, a query inteira é guardada.
  var TRACKING_KEYS = {
    fbclid: 1, gclid: 1, wbraid: 1, gbraid: 1, ttclid: 1, msclkid: 1, twclid: 1, epik: 1, irclickid: 1, li_fat_id: 1,
    // vocabulário dos trackers que ficam na frente destas lojas (RedTrack e afins)
    clickid: 1, click_id: 1, rtkcid: 1, cmpid: 1, sck: 1, xcod: 1
  };

  // Navegação da própria vitrine: nunca vira atribuição.
  var NAVIGATION_KEYS = {
    variant: 1, page: 1, q: 1, sort_by: 1, view: 1, section_id: 1, pb: 1, key: 1, constraint: 1,
    currency: 1, country: 1, layout: 1, preview_theme_id: 1, preview_key: 1, shpxid: 1,
    _pos: 1, _sid: 1, _ss: 1, _fd: 1, _psq: 1, _v: 1
  };

  // Antes de tudo, para a visita ser capturada mesmo quando o script desiste logo abaixo.
  captureTrackingParams();

  var scriptEl = document.currentScript || document.querySelector("script[data-pag-checkout]");
  var globalConfig = (typeof window !== "undefined" && window.PAG_CHECKOUT) || {};
  var attr = function (name, key) {
    var value = scriptEl ? scriptEl.getAttribute(name) : null;
    return value || globalConfig[key] || null;
  };
  var API_BASE = attr("data-api-base", "apiBase");
  var SHOP = attr("data-shop", "shop");
  var BUTTON_SELECTOR = attr("data-button", "button") || "[c-id=btn-checkout]";
  var FALLBACK_NATIVE = attr("data-fallback", "fallback") === "native";
  // Servidor do TDR que monta o carrinho (rota /checkout/cart-json). Padrão: o próprio domínio da loja, que é onde
  // essa rota existe. Só mude (data-tdr-base) se a vitrine e o app estiverem em domínios diferentes.
  var TDR_BASE = (attr("data-tdr-base", "tdrBase") || "").replace(/\/+$/, "");

  if (!API_BASE || !SHOP) {
    console.warn("[pag-checkout] faltam data-api-base e/ou data-shop na tag do script (ou window.PAG_CHECKOUT): checkout externo desligado");
    return;
  }

  API_BASE = API_BASE.replace(/\/+$/, "");

  var submitting = false;

  function paramKey(part) {
    var eq = part.indexOf("=");
    return (eq === -1 ? part : part.slice(0, eq)).toLowerCase();
  }

  function isTrackingKey(key) {
    return key.indexOf("utm_") === 0 || /^sub\d+$/.test(key) || TRACKING_KEYS[key] === 1;
  }

  function isNavigationKey(key) {
    return NAVIGATION_KEYS[key] === 1 || key.indexOf("filter.") === 0;
  }

  function anyParam(parts, predicate) {
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] && predicate(paramKey(parts[i]))) {
        return true;
      }
    }
    return false;
  }

  function storedTrackingParams() {
    try {
      return sessionStorage.getItem("pag-tracking-params");
    } catch (err) {
      return null;
    }
  }

  function captureTrackingParams() {
    // Primeiro toque: os parâmetros com que o comprador chegou, guardados pela sessão inteira mesmo depois de
    // navegar para páginas sem query. sessionStorage pode lançar (modo privado, armazenamento bloqueado).
    try {
      var search = window.location.search;
      if (!search || search.length <= 1) {
        return;
      }
      var parts = search.slice(1).split("&");
      if (!anyParam(parts, isTrackingKey)) {
        // Sem chave conhecida ainda pode ser atribuição de um tracker não listado: entra só como primeiro toque,
        // nunca por cima de um já guardado, e só se tiver algo que não seja navegação da vitrine.
        if (storedTrackingParams()) {
          return;
        }
        var meaningful = anyParam(parts, function (key) {
          return !isNavigationKey(key);
        });
        if (!meaningful) {
          return;
        }
      }
      var kept = [];
      var length = 0;
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i];
        if (!part) {
          continue;
        }
        var nextLength = length + (kept.length > 0 ? 1 : 0) + part.length;
        // Teto no cliente, antes do limite de URL de um WAF: parâmetros inteiros são descartados, nunca cortados.
        if (nextLength > 1500) {
          break;
        }
        kept.push(part);
        length = nextLength;
      }
      if (kept.length > 0) {
        sessionStorage.setItem("pag-tracking-params", kept.join("&"));
      }
    } catch (err) {
      // sem armazenamento: nada a capturar
    }
  }

  function trackingQuery() {
    var stored = storedTrackingParams();
    if (stored) {
      return stored;
    }
    return window.location.search.slice(1);
  }

  function statusUrl() {
    return API_BASE + "/v1/shopify/status?shop=" + encodeURIComponent(SHOP);
  }

  // ---------------------------------------------------------------- carrinho do TDR
  function readLocalCart() {
    try {
      var raw = localStorage.getItem("cart");
      var cart = raw ? JSON.parse(raw) : [];
      return Array.isArray(cart) ? cart : [];
    } catch (err) {
      return [];
    }
  }

  function clearLocalCart() {
    try {
      localStorage.removeItem("cart");
    } catch (err) {
      // sem armazenamento: nada a limpar
    }
  }

  function buyerCountry() {
    return (document.body && document.body.getAttribute("data-country")) || "";
  }

  function postJson(url, body, what) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) {
      var type = (r.headers && r.headers.get("content-type")) || "";
      if (type.indexOf("json") === -1) {
        // o app responde HTML (redireciona para "/") quando a rota não existe: servidor sem o deploy desta versão
        throw new Error(what === "tdr"
          ? "O servidor da loja ainda não tem a rota /checkout/cart-json: faça o deploy da versão atual"
          : "Resposta inesperada da plataforma de checkout (HTTP " + r.status + ")");
      }
      return r.json();
    });
  }

  // Métrica do funil do painel (o mesmo evento que o cart.js envia), com keepalive porque a página vai navegar.
  function initCheckoutEvent() {
    try {
      if (typeof saveInitCheckout === "function") {
        return Promise.resolve(saveInitCheckout()).catch(function () {});
      }
      var path = window.location.pathname;
      return fetch("/init-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          domain: window.location.host,
          path: path,
          product: path.indexOf("/products/") === 0 ? path.split("/").pop() : undefined
        })
      }).catch(function () {});
    } catch (err) {
      return Promise.resolve();
    }
  }

  function notify(message) {
    try {
      if (window.statusHandler && typeof window.statusHandler.messageError === "function") {
        window.statusHandler.messageError(message, true);
      } else {
        console.warn("[pag-checkout] " + message);
      }
    } catch (err) {
      // sem helper de mensagem: segue em silêncio
    }
  }

  function setBusy(button, busy) {
    if (!button) {
      return;
    }
    button.disabled = !!busy;
    button.setAttribute("aria-busy", busy ? "true" : "false");
  }

  function nativeCheckout() {
    // cart.js define checkout(): carrinho da Shopify (cartCreate) e redirecionamento
    if (typeof checkout === "function") {
      return checkout();
    }
  }

  function ancestorPath(target) {
    var chain = [];
    for (var el = target; el; el = el.parentElement) {
      chain.push(el);
    }
    return chain;
  }

  function findCheckoutTrigger(e) {
    // Caminho composto do evento, não closest(): o clique costuma cair num <span>/<i> dentro do botão.
    var path = typeof e.composedPath === "function" ? e.composedPath() : ancestorPath(e.target);
    for (var i = 0; i < path.length; i++) {
      var el = path[i];
      if (el && el.nodeType === 1 && typeof el.matches === "function") {
        try {
          if (el.matches(BUTTON_SELECTOR)) {
            return el;
          }
        } catch (err) {
          // seletor rejeitado pelo navegador: continua subindo
        }
      }
    }
    return null;
  }

  function submitCart(button) {
    if (submitting) {
      return;
    }
    var cart = readLocalCart();
    if (!cart.length) {
      return;
    }
    submitting = true;
    setBusy(button, true);

    var qs = trackingQuery();

    postJson(TDR_BASE + "/checkout/cart-json?country=" + encodeURIComponent(buyerCountry()), cart, "tdr")
      .then(function (res) {
        if (!res || res.status !== 200 || !res.content || !res.content.cart) {
          throw new Error(res && typeof res.content === "string" ? res.content : "Não foi possível montar o carrinho");
        }
        if (res.content.shop && res.content.shop !== SHOP) {
          console.warn("[pag-checkout] data-shop (" + SHOP + ") difere da Shopify dos produtos (" + res.content.shop + ")");
        }
        return postJson(API_BASE + "/v1/shopify/cart" + (qs ? "?" + qs : ""), {
          shop: SHOP,
          internalDomain: SHOP,
          cart: res.content.cart
        }, "pag");
      })
      .then(function (res) {
        // Plataforma inativa ou sem URL de checkout: o clique já foi cancelado, então não navega para lugar nenhum.
        if (!res || !res.active || !res.checkoutDirectUrl) {
          throw new Error("inactive");
        }
        var redirect = function () {
          if (res.skipCart) {
            clearLocalCart();
          }
          window.location.assign(res.checkoutDirectUrl);
        };
        return Promise.resolve(initCheckoutEvent()).then(redirect, redirect);
      })
      .catch(function (err) {
        // Falha de rede, da plataforma ou do carrinho: solta a trava para um novo clique tentar de novo.
        submitting = false;
        setBusy(button, false);
        if (FALLBACK_NATIVE) {
          return nativeCheckout();
        }
        if (err && err.message && err.message !== "inactive") {
          notify(err.message);
        }
      });
  }

  function interceptCheckout() {
    // Captura no document: roda antes do handler do cart.js no botão e o impede (stopImmediatePropagation).
    document.addEventListener(
      "click",
      function (e) {
        var trigger = findCheckoutTrigger(e);
        if (trigger) {
          e.preventDefault();
          e.stopImmediatePropagation();
          submitCart(trigger);
        }
      },
      true
    );
  }

  function init() {
    fetch(statusUrl(), { headers: { Accept: "application/json" } })
      .then(function (r) {
        return r.json();
      })
      .then(function (res) {
        if (res && res.active) {
          interceptCheckout();
        }
      })
      .catch(function () {
        // status indisponível: o checkout normal continua
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
