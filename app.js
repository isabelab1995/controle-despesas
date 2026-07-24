/* ============================================================
   Controle de Despesas — app.js
   CRUD de lançamentos sincronizado com Firebase Firestore.
   ============================================================ */

const CATEGORIAS = [
  "Academia", "Advogada", "Alimentação", "Aluguel", "Baby/Creche",
  "Celular/Plano celular", "Condomínio", "Congresso Jovens/Mobiliza",
  "Cursos/pós-graduação", "Dízimo", "Energia", "Estética e Afins",
  "FIES", "Férias/13º Salário", "Gasolina/transporte", "IPTU",
  "IPVA/Licenciamento", "Imposto de Renda", "Internet",
  "Lanchonetes/Restaurantes", "Lazer - Esportes", "Limpeza Casa/Apto",
  "Manutenções Casa/Apto", "Manutenções carro", "Mercado",
  "Médico/Farmácia", "Móveis Casa Nova", "PLR", "Parcela apartamento",
  "Pet shop/Veterinário", "Presentes", "Recebimento Aluguel",
  "Salário Bela", "Salário Thomas", "Seguro Residencial",
  "Seguro carro", "Streaming/Cloud", "Taxa Coleta de Lixo",
  "Transf. entre Contas", "Vestuário/Sapatos", "Viagem", "Água",
  "Outros"
];

const ORIGENS = ["Bela", "Thomas", "Bela/Thomas"];

const state = {
  db: null,
  docs: [],           // todos os lançamentos carregados {id, data, tipo, origem, categoria, valor, pago}
  currentMonth: null, // "YYYY-MM"
  filters: { tipo: "", origem: "", categoria: "", busca: "" },
  page: 1,
  pageSize: 40,
  charts: {},
  editingId: null,
};

const fmtMoney = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const fmtMonthLabel = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  return s.replace(".", "").replace(/^\w/, (c) => c.toUpperCase());
};

const monthOf = (dateStr) => dateStr.slice(0, 7);

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2600);
}

/* ---------------- Firebase setup ---------------- */

function getStoredConfig() {
  try {
    const raw = localStorage.getItem("fb_config");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function parseFirebaseConfig(raw) {
  // Aceita tanto JSON estrito quanto o objeto JS colado direto do console do Firebase
  // (chaves sem aspas, "const firebaseConfig = {...};" etc.)
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  const objText = raw.slice(start, end + 1);
  try {
    return JSON.parse(objText);
  } catch (_) {
    // segue para o modo tolerante
  }
  try {
    // eslint-disable-next-line no-new-func
    const cfg = new Function("return (" + objText + ");")();
    if (cfg && typeof cfg === "object" && cfg.apiKey && cfg.projectId) return cfg;
    return null;
  } catch (_) {
    return null;
  }
}

function boot() {
  const cfg = getStoredConfig();
  if (!cfg) {
    showSetupScreen();
    return;
  }
  startApp(cfg);
}

function showSetupScreen(errorMsg) {
  document.getElementById("setup-screen").hidden = false;
  document.getElementById("app-root").hidden = true;
  document.getElementById("loading-screen").hidden = true;
  const err = document.getElementById("setup-error");
  if (errorMsg) {
    err.textContent = errorMsg;
    err.hidden = false;
  } else {
    err.hidden = true;
  }
}

function startApp(cfg) {
  document.getElementById("setup-screen").hidden = true;
  document.getElementById("loading-screen").hidden = false;
  document.getElementById("app-root").hidden = true;

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(cfg);
    }
    state.db = firebase.firestore();
  } catch (e) {
    showSetupScreen("Não foi possível conectar: " + e.message);
    return;
  }

  attachRealtimeListener();
}

function attachRealtimeListener() {
  state.db.collection("lancamentos").onSnapshot(
    async (snap) => {
      state.docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      document.getElementById("loading-screen").hidden = true;

      if (state.docs.length === 0 && window.DADOS_INICIAIS && window.DADOS_INICIAIS.length) {
        showImportPrompt();
        return;
      }

      document.getElementById("app-root").hidden = false;
      onDataReady();
    },
    (err) => {
      document.getElementById("loading-screen").hidden = true;
      showSetupScreen(
        "Erro ao conectar no Firestore: " + err.message +
        " — confira a configuração e as regras de segurança."
      );
    }
  );
}

function showImportPrompt() {
  document.getElementById("app-root").hidden = true;
  document.getElementById("import-screen").hidden = false;
}

async function runImport() {
  const btn = document.getElementById("btn-import");
  btn.disabled = true;
  btn.textContent = "Importando...";

  const records = window.DADOS_INICIAIS;
  const chunkSize = 400;
  try {
    for (let i = 0; i < records.length; i += chunkSize) {
      const batch = state.db.batch();
      const slice = records.slice(i, i + chunkSize);
      slice.forEach((r) => {
        const ref = state.db.collection("lancamentos").doc();
        batch.set(ref, r);
      });
      await batch.commit();
      btn.textContent = `Importando... ${Math.min(i + chunkSize, records.length)}/${records.length}`;
    }
    toast("Histórico importado com sucesso.");
    document.getElementById("import-screen").hidden = true;
  } catch (e) {
    alert("Erro ao importar: " + e.message);
    btn.disabled = false;
    btn.textContent = "Tentar novamente";
  }
}

function skipImport() {
  document.getElementById("import-screen").hidden = true;
  document.getElementById("app-root").hidden = false;
  onDataReady();
}

/* ---------------- dados / cálculos ---------------- */

function allMonths() {
  const set = new Set(state.docs.map((d) => monthOf(d.data)));
  const now = new Date();
  const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  set.add(cur);
  return Array.from(set).sort();
}

function docsOfMonth(ym) {
  return state.docs.filter((d) => monthOf(d.data) === ym);
}

function monthStats(ym) {
  const ds = docsOfMonth(ym);
  let entradas = 0, saidas = 0;
  ds.forEach((d) => {
    if (d.tipo === "Entrada") entradas += Number(d.valor) || 0;
    else saidas += Number(d.valor) || 0;
  });
  return { entradas, saidas, saldo: entradas - saidas };
}

function saldoAcumuladoSeries() {
  const months = allMonths().filter((m) => docsOfMonth(m).length > 0);
  let acc = 0;
  return months.map((m) => {
    const { saldo } = monthStats(m);
    acc += saldo;
    return { mes: m, acumulado: acc };
  });
}

/* ---------------- render: abas de mês ---------------- */

function onDataReady() {
  const months = allMonths();
  if (!state.currentMonth || !months.includes(state.currentMonth)) {
    const withData = months.filter((m) => docsOfMonth(m).length > 0);
    state.currentMonth = withData.length ? withData[withData.length - 1] : months[months.length - 1];
  }
  renderMonthTabs(months);
  renderDashboard();
  renderCharts();
  populateFilterOptions();
  renderTable();
}

function renderMonthTabs(months) {
  const wrap = document.getElementById("month-tabs");
  wrap.innerHTML = "";
  months.forEach((m) => {
    const btn = document.createElement("button");
    btn.className = "month-tab" + (m === state.currentMonth ? " active" : "");
    btn.textContent = fmtMonthLabel(m);
    btn.addEventListener("click", () => {
      state.currentMonth = m;
      state.page = 1;
      renderMonthTabs(months);
      renderDashboard();
      renderCharts();
      renderTable();
    });
    wrap.appendChild(btn);
  });
  const active = wrap.querySelector(".active");
  if (active) active.scrollIntoView({ inline: "center", block: "nearest" });
}

/* ---------------- render: cards ---------------- */

function renderDashboard() {
  const { entradas, saidas, saldo } = monthStats(state.currentMonth);
  document.getElementById("card-saldo-label").textContent = "Saldo — " + fmtMonthLabel(state.currentMonth);
  const saldoEl = document.getElementById("card-saldo");
  saldoEl.textContent = fmtMoney(saldo);
  saldoEl.className = "value " + (saldo < 0 ? "neg" : "pos");
  document.getElementById("card-entradas").textContent = fmtMoney(entradas);
  document.getElementById("card-saidas").textContent = fmtMoney(saidas);
}

/* ---------------- render: gráficos ---------------- */

function renderCharts() {
  renderCategoryChart();
  renderTrendChart();
}

function renderCategoryChart() {
  const ctx = document.getElementById("chart-categorias");
  const ds = docsOfMonth(state.currentMonth).filter((d) => d.tipo === "Saída");
  const byCat = {};
  ds.forEach((d) => { byCat[d.categoria] = (byCat[d.categoria] || 0) + Number(d.valor); });
  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 8);

  if (state.charts.cat) state.charts.cat.destroy();

  if (!entries.length) {
    ctx.getContext("2d").clearRect(0, 0, ctx.width, ctx.height);
    return;
  }

  const palette = ["#a2432b", "#c08a28", "#2f5d50", "#4d5975", "#8a5a3b", "#6b7a99", "#b96b4f", "#9a8748"];

  state.charts.cat = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: entries.map((e) => e[0]),
      datasets: [{ data: entries.map((e) => e[1]), backgroundColor: palette, borderColor: "#fffdf7", borderWidth: 2 }],
    },
    options: {
      plugins: {
        legend: { position: "right", labels: { boxWidth: 12, font: { family: "Inter", size: 11 } } },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtMoney(c.raw)}` } },
      },
      maintainAspectRatio: false,
    },
  });
}

function renderTrendChart() {
  const ctx = document.getElementById("chart-tendencia");
  const series = saldoAcumuladoSeries();

  if (state.charts.trend) state.charts.trend.destroy();

  state.charts.trend = new Chart(ctx, {
    type: "line",
    data: {
      labels: series.map((s) => fmtMonthLabel(s.mes)),
      datasets: [{
        label: "Saldo acumulado",
        data: series.map((s) => s.acumulado),
        borderColor: "#202b45",
        backgroundColor: "rgba(192,138,40,0.15)",
        fill: true,
        tension: 0.25,
        pointRadius: 2,
      }],
    },
    options: {
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmtMoney(c.raw) } } },
      scales: {
        y: { ticks: { callback: (v) => fmtMoney(v), font: { size: 10 } } },
        x: { ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
      },
      maintainAspectRatio: false,
    },
  });
}

/* ---------------- render: filtros e tabela ---------------- */

function populateFilterOptions() {
  const catSel = document.getElementById("f-categoria");
  if (catSel.options.length <= 1) {
    CATEGORIAS.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c; opt.textContent = c;
      catSel.appendChild(opt);
    });
  }
}

function filteredDocs() {
  let ds = docsOfMonth(state.currentMonth);
  const { tipo, origem, categoria, busca } = state.filters;
  if (tipo) ds = ds.filter((d) => d.tipo === tipo);
  if (origem) ds = ds.filter((d) => d.origem === origem);
  if (categoria) ds = ds.filter((d) => d.categoria === categoria);
  if (busca) {
    const q = busca.toLowerCase();
    ds = ds.filter((d) => (d.categoria || "").toLowerCase().includes(q) || (d.origem || "").toLowerCase().includes(q));
  }
  return ds.sort((a, b) => (a.data < b.data ? 1 : -1));
}

function renderTable() {
  const ds = filteredDocs();
  const tbody = document.getElementById("ledger-body");
  tbody.innerHTML = "";

  const totalPages = Math.max(1, Math.ceil(ds.length / state.pageSize));
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * state.pageSize;
  const pageDocs = ds.slice(start, start + state.pageSize);

  if (!pageDocs.length) {
    const tr = document.createElement("tr");
    tr.className = "empty-row";
    tr.innerHTML = `<td colspan="7">Nenhum lançamento encontrado para este mês/filtro.</td>`;
    tbody.appendChild(tr);
  }

  pageDocs.forEach((d) => {
    const tr = document.createElement("tr");
    const dt = new Date(d.data + "T00:00:00").toLocaleDateString("pt-BR");
    const isEntrada = d.tipo === "Entrada";
    tr.innerHTML = `
      <td>${dt}</td>
      <td><span class="tag">${d.categoria || "—"}</span></td>
      <td>${d.origem || "—"}</td>
      <td>${isEntrada ? "Entrada" : "Saída"}</td>
      <td><span class="stamp ${d.pago === "Sim" ? "pago" : "pendente"}">${d.pago === "Sim" ? "Pago" : "Pendente"}</span></td>
      <td class="valor ${isEntrada ? "entrada" : "saida"}">${isEntrada ? "+" : "−"} ${fmtMoney(Math.abs(d.valor))}</td>
      <td>
        <div class="row-actions">
          <button data-act="edit" title="Editar">✎</button>
          <button data-act="del" title="Excluir" class="btn-danger">✕</button>
        </div>
      </td>`;
    tr.querySelector('[data-act="edit"]').addEventListener("click", () => openModal(d));
    tr.querySelector('[data-act="del"]').addEventListener("click", () => confirmDelete(d));
    tbody.appendChild(tr);
  });

  document.getElementById("page-info").textContent = `Página ${state.page} de ${totalPages} · ${ds.length} lançamentos`;
  document.getElementById("btn-prev").disabled = state.page <= 1;
  document.getElementById("btn-next").disabled = state.page >= totalPages;
}

/* ---------------- modal add/edit ---------------- */

function openModal(doc) {
  state.editingId = doc ? doc.id : null;
  document.getElementById("modal-title").textContent = doc ? "Editar lançamento" : "Novo lançamento";
  document.getElementById("f-data").value = doc ? doc.data : state.currentMonth + "-01" >= todayStr() ? state.currentMonth + "-01" : todayStr();
  document.getElementById("f-valor").value = doc ? doc.valor : "";
  document.getElementById("f-origem").value = doc ? doc.origem : "Bela";
  document.getElementById("f-pago").value = doc ? (doc.pago || "Sim") : "Sim";
  setCategoriaField(doc ? doc.categoria : "");
  setTipo(doc ? doc.tipo : "Saída");
  document.getElementById("btn-delete-modal").hidden = !doc;
  document.getElementById("modal-overlay").hidden = false;
  document.getElementById("f-valor").focus();
}

function setCategoriaField(value) {
  const sel = document.getElementById("f-categoria-select");
  const known = CATEGORIAS.includes(value);
  sel.value = known ? value : (value ? "__outra__" : "Alimentação");
  document.getElementById("f-categoria-outra").hidden = known || !value;
  document.getElementById("f-categoria-outra").value = known ? "" : value;
  toggleOutraCategoria();
}

function toggleOutraCategoria() {
  const sel = document.getElementById("f-categoria-select");
  document.getElementById("f-categoria-outra").hidden = sel.value !== "__outra__";
}

function setTipo(tipo) {
  document.getElementById("btn-tipo-entrada").setAttribute("aria-pressed", tipo === "Entrada");
  document.getElementById("btn-tipo-saida").setAttribute("aria-pressed", tipo === "Saída");
  document.getElementById("f-tipo").value = tipo;
}

function closeModal() {
  document.getElementById("modal-overlay").hidden = true;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function submitModal(ev) {
  ev.preventDefault();
  const data = document.getElementById("f-data").value;
  const tipo = document.getElementById("f-tipo").value;
  const origem = document.getElementById("f-origem").value;
  const catSel = document.getElementById("f-categoria-select").value;
  const categoria = catSel === "__outra__" ? document.getElementById("f-categoria-outra").value.trim() : catSel;
  const valor = parseFloat(document.getElementById("f-valor").value);
  const pago = document.getElementById("f-pago").value;

  if (!data || !categoria || isNaN(valor) || valor <= 0) {
    alert("Preencha data, categoria e um valor válido.");
    return;
  }

  const payload = { data, tipo, origem, categoria, valor, pago };
  const btn = document.getElementById("btn-save-modal");
  btn.disabled = true;
  try {
    if (state.editingId) {
      await state.db.collection("lancamentos").doc(state.editingId).update(payload);
      toast("Lançamento atualizado.");
    } else {
      await state.db.collection("lancamentos").add(payload);
      toast("Lançamento adicionado.");
    }
    closeModal();
  } catch (e) {
    alert("Erro ao salvar: " + e.message);
  } finally {
    btn.disabled = false;
  }
}

async function confirmDelete(doc) {
  if (!confirm(`Excluir o lançamento "${doc.categoria}" de ${fmtMoney(doc.valor)}?`)) return;
  try {
    await state.db.collection("lancamentos").doc(doc.id).delete();
    toast("Lançamento excluído.");
  } catch (e) {
    alert("Erro ao excluir: " + e.message);
  }
}

function deleteFromModal() {
  if (!state.editingId) return;
  const doc = state.docs.find((d) => d.id === state.editingId);
  closeModal();
  if (doc) confirmDelete(doc);
}

/* ---------------- exportar CSV ---------------- */

function exportCSV() {
  const ds = filteredDocs();
  const header = "Data;Tipo;Origem;Categoria;Pago;Valor\n";
  const rows = ds.map((d) =>
    [d.data, d.tipo, d.origem, d.categoria, d.pago, String(d.valor).replace(".", ",")].join(";")
  );
  const csv = header + rows.join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lancamentos_${state.currentMonth}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------------- listeners globais ---------------- */

function initListeners() {
  document.getElementById("setup-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const raw = document.getElementById("setup-config").value.trim();
    const cfg = parseFirebaseConfig(raw);
    if (!cfg) {
      showSetupScreen("Configuração inválida — cole o objeto firebaseConfig copiado do Firebase.");
      return;
    }
    localStorage.setItem("fb_config", JSON.stringify(cfg));
    startApp(cfg);
  });

  document.getElementById("btn-import").addEventListener("click", runImport);
  document.getElementById("btn-skip-import").addEventListener("click", skipImport);

  document.getElementById("fab-add").addEventListener("click", () => openModal(null));
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") closeModal();
  });
  document.getElementById("modal-form").addEventListener("submit", submitModal);
  document.getElementById("btn-delete-modal").addEventListener("click", deleteFromModal);

  document.getElementById("btn-tipo-entrada").addEventListener("click", () => setTipo("Entrada"));
  document.getElementById("btn-tipo-saida").addEventListener("click", () => setTipo("Saída"));
  document.getElementById("f-categoria-select").addEventListener("change", toggleOutraCategoria);

  document.getElementById("f-tipo-filter").addEventListener("change", (e) => {
    state.filters.tipo = e.target.value; state.page = 1; renderTable();
  });
  document.getElementById("f-origem-filter").addEventListener("change", (e) => {
    state.filters.origem = e.target.value; state.page = 1; renderTable();
  });
  document.getElementById("f-categoria").addEventListener("change", (e) => {
    state.filters.categoria = e.target.value; state.page = 1; renderTable();
  });
  document.getElementById("f-busca").addEventListener("input", (e) => {
    state.filters.busca = e.target.value; state.page = 1; renderTable();
  });
  document.getElementById("btn-export").addEventListener("click", exportCSV);

  document.getElementById("btn-prev").addEventListener("click", () => { state.page--; renderTable(); });
  document.getElementById("btn-next").addEventListener("click", () => { state.page++; renderTable(); });

  document.getElementById("btn-logout").addEventListener("click", () => {
    if (confirm("Desconectar deste banco de dados neste navegador? (os dados continuam salvos no Firebase)")) {
      localStorage.removeItem("fb_config");
      location.reload();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initListeners();
  boot();
});
