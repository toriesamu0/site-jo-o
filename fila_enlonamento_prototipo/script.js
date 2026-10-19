const STORAGE_KEY = "filaEnlonamento_v1";
let trucks = loadTrucks();
let currentDriverId = null;
let toastTimer;

function loadTrucks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trucks));
  renderAll();
}
function uid() { return `${Date.now()}-${Math.random().toString(16).slice(2,8)}`; }
function normalizePlate(value) { return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,7); }
function formatPlate(value) {
  const p = value.replace(/[^A-Z0-9]/g, "").toUpperCase();
  return p.length === 7 ? p : p;
}
function fmtTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit"});
}
function fmtDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
}
function duration(from, to = Date.now()) {
  if (!from) return "—";
  const minutes = Math.max(0, Math.floor((to - from) / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes/60)}h ${String(minutes%60).padStart(2,"0")}m`;
}
function statusLabel(status) {
  return ({waiting:"Aguardando",called:"Chamado",done:"Finalizado",absent:"Ausente"})[status] || status;
}
function ticketNumber(n) { return `E-${String(n).padStart(3,"0")}`; }
function nextNumber() {
  return trucks.reduce((max,t) => Math.max(max, t.number || 0), 0) + 1;
}
function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}
function switchView(view) {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === `view-${view}`));
  if (view === "tv") renderTV();
}
document.querySelectorAll(".tab").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));

document.getElementById("plate").addEventListener("input", e => {
  const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,"");
  e.target.value = raw.slice(0,8);
});

document.getElementById("join-form").addEventListener("submit", e => {
  e.preventDefault();
  const plate = formatPlate(document.getElementById("plate").value);
  const message = document.getElementById("join-message");
  message.hidden = true;
  if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate) && !/^[A-Z]{3}-?[0-9]{4}$/.test(plate)) {
    message.textContent = "Confira a placa. Use o padrão Mercosul (ABC1D23) ou antigo (ABC1234).";
    message.hidden = false;
    return;
  }
  const duplicate = trucks.find(t => t.plate === plate && ["waiting","called"].includes(t.status));
  if (duplicate) {
    currentDriverId = duplicate.id;
    renderDriverTicket();
    toast("Esta placa já está registrada na fila.");
    document.getElementById("driver-ticket").scrollIntoView({behavior:"smooth",block:"center"});
    return;
  }
  const truck = {
    id: uid(), number: nextNumber(), plate, status:"waiting",
    arrivalAt: Date.now(), calledAt:null, finishedAt:null, calls:0, absentAt:null
  };
  trucks.push(truck);
  currentDriverId = truck.id;
  save();
  document.getElementById("plate").value = "";
  document.getElementById("driver-ticket").hidden = false;
  document.getElementById("driver-ticket").scrollIntoView({behavior:"smooth",block:"center"});
  toast(`Senha ${ticketNumber(truck.number)} gerada com sucesso.`);
});

document.getElementById("clear-ticket").addEventListener("click", () => {
  document.getElementById("driver-ticket").hidden = true;
  currentDriverId = null;
});
document.getElementById("call-next").addEventListener("click", () => {
  const next = trucks.filter(t => t.status === "waiting").sort((a,b) => a.arrivalAt-b.arrivalAt)[0];
  if (!next) { toast("Não há caminhões aguardando."); return; }
  callTruck(next.id);
});
function callTruck(id) {
  const truck = trucks.find(t => t.id === id);
  if (!truck || ["done","absent"].includes(truck.status)) return;
  truck.status = "called";
  truck.calledAt = truck.calledAt || Date.now();
  truck.lastCallAt = Date.now();
  truck.calls = (truck.calls || 0) + 1;
  save();
  toast(`${ticketNumber(truck.number)} chamada.`);
}
function finishTruck(id) {
  const truck = trucks.find(t => t.id === id);
  if (!truck) return;
  truck.status = "done";
  truck.finishedAt = Date.now();
  save();
  toast(`${ticketNumber(truck.number)} finalizada.`);
}
function markAbsent(id) {
  const truck = trucks.find(t => t.id === id);
  if (!truck) return;
  truck.status = "absent";
  truck.absentAt = Date.now();
  save();
  toast(`${ticketNumber(truck.number)} registrada como ausente.`);
}
function renderQueue() {
  const body = document.getElementById("queue-body");
  const search = (document.getElementById("queue-search").value || "").toUpperCase();
  const visible = [...trucks].sort((a,b) => {
    const rank = {called:0,waiting:1,done:2,absent:3};
    return rank[a.status]-rank[b.status] || a.arrivalAt-b.arrivalAt;
  }).filter(t => `${ticketNumber(t.number)} ${t.plate}`.includes(search));
  body.innerHTML = visible.map(t => {
    let actions = "";
    if (t.status === "waiting") actions = `<button class="mini-btn call" data-action="call" data-id="${t.id}">Chamar</button><button class="mini-btn danger" data-action="absent" data-id="${t.id}">Ausente</button>`;
    else if (t.status === "called") actions = `<button class="mini-btn" data-action="call" data-id="${t.id}">Repetir chamada (${t.calls || 1})</button><button class="mini-btn call" data-action="finish" data-id="${t.id}">Finalizar</button><button class="mini-btn danger" data-action="absent" data-id="${t.id}">Ausente</button>`;
    else actions = `<span class="muted">—</span>`;
    return `<tr><td><strong>${ticketNumber(t.number)}</strong><span class="subline">${t.plate}</span></td><td>${fmtDateTime(t.arrivalAt)}</td><td>${duration(t.arrivalAt, t.calledAt || (t.status==="waiting" ? Date.now() : t.finishedAt || t.absentAt || Date.now()))}</td><td><span class="status ${t.status}">${statusLabel(t.status)}</span></td><td><div class="row-actions">${actions}</div></td></tr>`;
  }).join("");
  document.getElementById("empty-queue").hidden = visible.length > 0;
  document.getElementById("queue-subtitle").textContent = `${trucks.length} registro${trucks.length===1?"":"s"}`;
}
document.getElementById("queue-body").addEventListener("click", e => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const {action,id} = btn.dataset;
  if (action === "call") callTruck(id);
  if (action === "finish") finishTruck(id);
  if (action === "absent") markAbsent(id);
});
document.getElementById("queue-search").addEventListener("input", renderQueue);

function renderDriverTicket() {
  const panel = document.getElementById("driver-ticket");
  const truck = trucks.find(t => t.id === currentDriverId);
  if (!truck) { panel.hidden = true; return; }
  panel.hidden = false;
  document.getElementById("ticket-number").textContent = ticketNumber(truck.number);
  document.getElementById("ticket-plate").textContent = truck.plate;
  document.getElementById("ticket-arrival").textContent = `Chegada às ${fmtTime(truck.arrivalAt)}`;
  const waiting = trucks.filter(t => t.status === "waiting").sort((a,b) => a.arrivalAt-b.arrivalAt);
  const pos = waiting.findIndex(t => t.id === truck.id);
  document.getElementById("ticket-position").textContent = truck.status === "waiting" ? `${pos+1}º` : truck.status === "called" ? "Sua vez" : "—";
  document.getElementById("ticket-wait").textContent = duration(truck.arrivalAt, truck.calledAt || Date.now());
  const chip = document.getElementById("ticket-status");
  chip.textContent = statusLabel(truck.status).toUpperCase();
  chip.className = `status-chip ${truck.status}`;
  const instruction = document.getElementById("ticket-instruction");
  if (truck.status === "called") instruction.textContent = "É sua vez! Dirija-se ao setor de enlonamento e siga as orientações da equipe.";
  else if (truck.status === "done") instruction.textContent = "Atendimento finalizado. Obrigado por utilizar o sistema.";
  else if (truck.status === "absent") instruction.textContent = "Seu registro foi marcado como ausente. Procure o operador para orientação.";
  else instruction.textContent = "Aguarde. Mantenha esta página aberta para acompanhar a atualização da sua posição.";
}
function renderMetrics() {
  const waiting = trucks.filter(t=>t.status==="waiting").length;
  const called = trucks.filter(t=>t.status==="called").length;
  const done = trucks.filter(t=>t.status==="done" && new Date(t.finishedAt).toDateString()===new Date().toDateString()).length;
  const completedWaits = trucks.filter(t=>t.calledAt).map(t=>Math.max(0,t.calledAt-t.arrivalAt));
  const avg = completedWaits.length ? Math.round(completedWaits.reduce((a,b)=>a+b,0)/completedWaits.length/60000) : null;
  document.getElementById("metric-waiting").textContent = waiting;
  document.getElementById("metric-called").textContent = called;
  document.getElementById("metric-done").textContent = done;
  document.getElementById("metric-average").textContent = avg === null ? "—" : `${avg} min`;
  document.getElementById("driver-waiting-count").textContent = waiting;
  document.getElementById("last-ticket").textContent = trucks.length ? ticketNumber(Math.max(...trucks.map(t=>t.number))) : "—";
  document.getElementById("today-date").textContent = new Date().toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"});
}
function renderTV() {
  const active = trucks.filter(t=>t.status==="called").sort((a,b)=>(b.lastCallAt||b.calledAt)-(a.lastCallAt||a.calledAt))[0];
  document.getElementById("tv-ticket").textContent = active ? ticketNumber(active.number) : "---";
  document.getElementById("tv-plate").textContent = active ? active.plate : "Aguardando chamada";
  document.getElementById("tv-status").textContent = active ? "Por favor, dirija-se ao setor de enlonamento." : "Nenhum caminhão chamado no momento";
  const recent = [...trucks].filter(t=>t.calledAt).sort((a,b)=>(b.lastCallAt||b.calledAt)-(a.lastCallAt||a.calledAt)).slice(0,3);
  document.getElementById("tv-recent-list").innerHTML = recent.length ? recent.map(t=>`<div class="tv-recent-item"><strong>${ticketNumber(t.number)}</strong><span>${t.plate}</span><small>${fmtTime(t.lastCallAt||t.calledAt)}</small></div>`).join("") : `<div class="tv-empty">As chamadas aparecerão aqui.</div>`;
}
function renderHistory() {
  const body = document.getElementById("history-body");
  const search = (document.getElementById("history-search").value || "").toUpperCase();
  const list = [...trucks].sort((a,b)=>b.arrivalAt-a.arrivalAt).filter(t=>`${ticketNumber(t.number)} ${t.plate}`.includes(search));
  body.innerHTML = list.map(t=>`<tr><td><strong>${ticketNumber(t.number)}</strong></td><td>${t.plate}</td><td>${fmtDateTime(t.arrivalAt)}</td><td>${fmtDateTime(t.calledAt)}</td><td>${fmtDateTime(t.finishedAt)}</td><td><span class="status ${t.status}">${statusLabel(t.status)}</span></td></tr>`).join("");
  document.getElementById("empty-history").hidden = list.length > 0;
  document.getElementById("history-count").textContent = `${list.length} registro${list.length===1?"":"s"}`;
}
document.getElementById("history-search").addEventListener("input", renderHistory);
document.getElementById("export-csv").addEventListener("click", () => {
  if (!trucks.length) { toast("Não há registros para exportar."); return; }
  const rows = [["Senha","Placa","Status","Chegada","Chamado","Finalizado","Chamadas"]];
  [...trucks].sort((a,b)=>a.arrivalAt-b.arrivalAt).forEach(t=>rows.push([
    ticketNumber(t.number),t.plate,statusLabel(t.status),
    t.arrivalAt?new Date(t.arrivalAt).toLocaleString("pt-BR"):"",
    t.calledAt?new Date(t.calledAt).toLocaleString("pt-BR"):"",
    t.finishedAt?new Date(t.finishedAt).toLocaleString("pt-BR"):"",
    t.calls||0
  ]));
  const csv = "\uFEFF" + rows.map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
  const a = document.createElement("a"); a.href=url; a.download="historico-enlonamento.csv"; a.click(); URL.revokeObjectURL(url);
  toast("Arquivo CSV exportado.");
});
function renderAll() {
  renderQueue(); renderMetrics(); renderDriverTicket(); renderTV(); renderHistory();
}
function clock() {
  document.getElementById("tv-clock").textContent = new Date().toLocaleTimeString("pt-BR");
}
document.getElementById("today-date").textContent = new Date().toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"});
renderAll(); clock(); setInterval(() => { clock(); renderAll(); }, 15000);

// Keep separate tabs in the same browser synchronized when localStorage changes.
window.addEventListener("storage", e => {
  if (e.key === STORAGE_KEY) { trucks = loadTrucks(); renderAll(); }
});
