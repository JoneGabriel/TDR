// Painel de métricas: /metrics/summary (período) + /metrics/realtime (usuários agora, a cada 10s)

let chartReady = false;

// cores das séries validadas para o fundo escuro (sessões, carrinho, checkout)
const SERIES_COLORS = ["#13a7bc", "#b8309a", "#c2860c"];
const REALTIME_EVERY_MS = 10000;

const num = (value)=> (value || 0).toLocaleString("pt-BR");
const esc = (text)=> $("<span>").text(text == null ? "" : text).html();

const getFilters = ()=>{
    let start = $("[c-id=start]").val();
    let end = $("[c-id=end]").val();

    if(start && end && start > end){
        [start, end] = [end, start];
        $("[c-id=start]").val(start);
        $("[c-id=end]").val(end);
    }

    return {start, end, domain:$("[c-id=domain]").val()};
};

const toQuery = (params)=> Object.entries(params)
    .filter(([, value])=> value)
    .map(([key, value])=> `${key}=${encodeURIComponent(value)}`)
    .join("&");

const drawChart = (series, granularity)=>{
    try{

        if(!chartReady){
            return;
        }

        let data = new google.visualization.DataTable();
        data.addColumn('string', granularity == 'hour' ? 'Hora' : 'Dia');
        data.addColumn('number', 'Sessões');
        data.addColumn('number', 'Carrinho');
        data.addColumn('number', 'Checkout');
        data.addRows(series.map(row=> [row.label, row.sessions, row.added_cart, row.init_checkout]));

        const axisText = { color: '#8290ad', fontName: 'Share Tech Mono', fontSize: 11 };
        const options = {
            backgroundColor: 'transparent',
            colors: SERIES_COLORS,
            legend: { position: 'top', alignment: 'end', textStyle: { color: '#e6f1ff', fontName: 'Rajdhani', fontSize: 13 } },
            chartArea: { left: 44, top: 36, right: 12, bottom: 32 },
            bar: { groupWidth: '62%' },
            hAxis: { textStyle: axisText, gridlines: { color: 'transparent' }, baselineColor: 'rgba(0,240,255,0.35)', showTextEvery: granularity == 'hour' ? 2 : 1 },
            vAxis: { textStyle: axisText, gridlines: { color: 'rgba(0,240,255,0.08)' }, minorGridlines: { color: 'transparent' }, baselineColor: 'rgba(0,240,255,0.35)', minValue: 0, format: '#' },
            tooltip: { textStyle: { fontName: 'Rajdhani', fontSize: 13 } },
            focusTarget: 'category'
        };

        new google.visualization.ColumnChart(document.getElementById('chart_div')).draw(data, options);

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const renderRows = (ctx, rows, labelKey, valueKey, emptyText)=>{
    const $ctx = $(ctx).html("");

    if(!rows.length){
        return $ctx.append(`<div class="metric-empty">${emptyText}</div>`);
    }

    const max = Math.max(...rows.map(row=> row[valueKey]));

    rows.forEach(row=>{
        $ctx.append(`
            <div class="metric-row">
                <span class="metric-row-label" title="${esc(row[labelKey])}">${esc(row[labelKey])}</span>
                <span class="metric-row-bar"><span style="width:${max ? Math.round(row[valueKey] / max * 100) : 0}%"></span></span>
                <span class="metric-row-value">${num(row[valueKey])}</span>
            </div>`);
    });
};

const renderSummary = (summary)=>{
    try{

        const {sessions, pageviews, passed, filtered, mobile, bots, added_cart, init_checkout, rates, series, range} = summary;

        $("[c-id=kpi-sessions]").text(num(sessions));
        $("[c-id=kpi-pageviews]").text(num(pageviews));
        $("[c-id=kpi-ppv]").text(rates.pages_per_session);
        $("[c-id=kpi-cart]").text(num(added_cart));
        $("[c-id=kpi-cart-rate]").text(rates.cart);
        $("[c-id=kpi-checkout]").text(num(init_checkout));
        $("[c-id=kpi-checkout-rate]").text(rates.checkout);
        $("[c-id=kpi-checkout-cart-rate]").text(rates.checkout_from_cart);
        $("[c-id=kpi-bounce]").text(rates.bounce);
        $("[c-id=kpi-passed]").text(num(passed));
        $("[c-id=kpi-filtered]").text(num(filtered));
        $("[c-id=kpi-mobile]").text(rates.mobile);
        $("[c-id=kpi-mobile-n]").text(num(mobile));
        $("[c-id=kpi-bots]").text(num(bots));

        const fmt = (ymd)=> `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
        $("[c-id=kpi-range]").text(range.start == range.end ? fmt(range.start) : `${fmt(range.start)} – ${fmt(range.end)}`);
        $("[c-id=kpi-range-sub]").text(`${range.granularity == 'hour' ? 'por hora' : 'por dia'}${range.domain ? ' · ' + range.domain : ' · todos os domínios'}`);
        $("[c-id=series-granularity]").text(range.granularity == 'hour' ? 'por hora' : 'por dia');

        // funil: largura relativa às sessões
        const width = (value)=> `${sessions ? Math.max(Math.round(value / sessions * 100), value ? 2 : 0) : 0}%`;
        $("[c-id=funnel-sessions]").css("width", sessions ? "100%" : "0%");
        $("[c-id=funnel-cart]").css("width", width(added_cart));
        $("[c-id=funnel-checkout]").css("width", width(init_checkout));
        $("[c-id=funnel-sessions-value]").text(num(sessions));
        $("[c-id=funnel-cart-value]").text(`${num(added_cart)} · ${rates.cart}%`);
        $("[c-id=funnel-checkout-value]").text(`${num(init_checkout)} · ${rates.checkout}%`);

        renderRows("[c-id=top-pages]", summary.pages, "path", "views", "Sem páginas no período");
        renderRows("[c-id=top-countries]", summary.countries.map(row=> ({...row, country:row.country == "?" ? "desconhecido" : row.country})), "country", "sessions", "Sem sessões no período");
        renderRows("[c-id=devices]", summary.devices, "device", "sessions", "Sem sessões no período");

        drawChart(series, range.granularity);

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const loadSummary = async()=>{
    try{

        const response = await request("GET", `/metrics/summary?${toQuery(getFilters())}`);

        if(response.status != 200){
            throw(statusHandler.messageError("Erro ao buscar métricas", true));
        }

        renderSummary(response.content);

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const renderRealtime = (realtime)=>{
    try{

        $("[c-id=rt-active]").text(num(realtime.active));
        $("[c-id=rt-mobile]").text(num(realtime.mobile));
        $("[c-id=rt-passed]").text(num(realtime.passed));
        $("[c-id=rt-filtered]").text(num(realtime.filtered));
        $("[c-id=rt-cart]").text(num(realtime.added_cart));

        const pages = $("[c-id=rt-pages]").html("");
        realtime.pages.forEach(row=>{
            pages.append(`<div class="mini-row"><span title="${esc(row.path)}">${esc(row.path)}</span><b>${num(row.users)}</b></div>`);
        });

        const domains = $("[c-id=rt-domains]").html("");
        if(!$("[c-id=domain]").val() && realtime.domains.length > 1){
            realtime.domains.forEach(row=>{
                domains.append(`<div class="mini-row mini-row-domain"><span title="${esc(row.domain)}">${esc(row.domain)}</span><b>${num(row.users)}</b></div>`);
            });
        }

    }catch(error){
        throw(statusHandler.messageError(error));
    }
};

const loadRealtime = async()=>{
    try{

        const response = await request("GET", `/metrics/realtime?${toQuery({domain:$("[c-id=domain]").val()})}`);

        if(response.status == 200){
            renderRealtime(response.content);
        }

    }catch(error){
        statusHandler.messageError(error);
    }
};

$(document).ready(function(){

    google.charts.load('current', {'packages':['corechart']});
    google.charts.setOnLoadCallback(()=>{
        chartReady = true;
        loadSummary();
    });

    loadRealtime();
    setInterval(loadRealtime, REALTIME_EVERY_MS);

    $("[c-id=filter]").on("click", async()=>{
        try{

            await loadSummary();
            await loadRealtime();

        }catch(error){
            statusHandler.messageError(error);
        }
    });

    $("[c-id=domain]").on("change", loadRealtime);

    // redesenha o gráfico ao redimensionar (o Google Charts não é responsivo sozinho)
    let resizeTimer;
    $(window).on("resize", ()=>{
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(loadSummary, 300);
    });
});
