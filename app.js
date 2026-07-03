// app.js - P.S.O REFORMAS - Soluções Criativas

// URL do PocketBase (vazio para usar a URL relativa do host)
const PB_URL = '';

// Estado Global
let state = {
  activeTab: 'orcamentos', // orcamentos, clientes, backups, obras
  clientes: [],
  orcamentos: [],
  obras: [],
  online: navigator.onLine,
  currentBudgetPhotos: [], // Array de base64 strings para o formulário
  fastAddingClient: false, // Flag para selecionar cliente recém cadastrado
  currentPaymentReceipt: null, // base64 string para o formulário de pagamento
};

// Carregar Lucide Icons
function loadIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Inicializar Aplicativo
document.addEventListener('DOMContentLoaded', async () => {
  // Inicializa o banco de dados IndexedDB
  await initDB();
  
  // Carrega os dados locais
  await loadLocalData();
  
  // Registra Service Worker (PWA)
  registerServiceWorker();
  
  // Configura Event Listeners de Interface
  setupEventListeners();
  
  // Detecta Rede
  updateOnlineStatus();
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  // Renderiza telas
  renderClientesList();
  renderOrcamentosList();
  renderObrasList();
  renderClientesDropdown();
  updateSyncCounters();
  
  loadIcons();
});

// Registrar Service Worker
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('PWA: Service Worker registrado com sucesso:', reg.scope))
      .catch((err) => console.error('PWA: Falha ao registrar Service Worker:', err));
  }
}

// Atualizar status de conexão
function updateOnlineStatus() {
  state.online = navigator.onLine;
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  
  if (state.online) {
    dot.className = 'status-dot online';
    text.textContent = 'Servidor Conectável';
    // Opcional: Tenta sincronizar em segundo plano se configurado
  } else {
    dot.className = 'status-dot offline';
    text.textContent = 'Modo Offline';
  }
}

// Carregar dados locais do IndexedDB para a memória do App
async function loadLocalData() {
  try {
    state.clientes = await dbClientes.getAll();
    state.orcamentos = await dbOrcamentos.getAll();
    state.obras = await dbObras.getAll();
    
    // Ordena orçamentos pelo código descrescente
    state.orcamentos.sort((a, b) => b.codigo.localeCompare(a.codigo));
    // Ordena clientes por nome
    state.clientes.sort((a, b) => a.nome.localeCompare(b.nome));
    // Ordena obras pela data de atualização decrecente
    state.obras.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch (err) {
    console.error('Erro ao carregar dados locais:', err);
  }
}

// === CONTROLE DE ABAS ===
function switchTab(tabId) {
  state.activeTab = tabId;
  
  // Atualiza botões
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  
  // Atualiza views
  document.querySelectorAll('.view-section').forEach(section => {
    section.classList.toggle('active', section.id === `view-${tabId}`);
  });
  
  if (tabId === 'backups') {
    updateSyncCounters();
  }
  
  loadIcons();
}

// === EVENT LISTENERS ===
function addListenerIfExists(id, event, callback) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener(event, callback);
  }
}

function setupEventListeners() {
  // Cliques nas Abas
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // --- CLIENTES ---
  addListenerIfExists('btn-novo-cliente', 'click', () => {
    state.fastAddingClient = false;
    openClienteModal();
  });
  
  addListenerIfExists('form-cliente', 'submit', handleSaveCliente);

  // Cadastro rápido de cliente dentro do orçamento
  addListenerIfExists('btn-add-client-fast', 'click', () => {
    state.fastAddingClient = true;
    openClienteModal();
  });

  // --- ORÇAMENTOS ---
  addListenerIfExists('btn-novo-orcamento', 'click', () => {
    openOrcamentoModal();
  });

  addListenerIfExists('form-orcamento', 'submit', handleSaveOrcamento);

  // Upload de fotos
  const photoUploader = document.getElementById('photo-uploader');
  const photosInput = document.getElementById('budget-photos-input');
  if (photoUploader && photosInput) {
    photoUploader.addEventListener('click', () => photosInput.click());
    photosInput.addEventListener('change', handlePhotoSelection);
  }

  // --- BACKUPS & SINCRONIZAÇÃO ---
  addListenerIfExists('btn-backup-topo', 'click', exportGeralBackup);
  addListenerIfExists('btn-export-geral', 'click', exportGeralBackup);
  
  addListenerIfExists('btn-import-geral', 'click', () => {
    const fileInput = document.getElementById('input-file-geral');
    if (fileInput) fileInput.click();
  });

  addListenerIfExists('input-file-geral', 'change', handleImportGeralFile);

  addListenerIfExists('btn-sync-pocketbase', 'click', handlePocketBaseSync);

  // --- OBRAS EM ANDAMENTO ---
  addListenerIfExists('form-iniciar-obra', 'submit', handleSaveObra);
  addListenerIfExists('form-pagamento', 'submit', handleSavePagamento);
  
  const pagUploader = document.getElementById('pagamento-uploader');
  const pagFileInput = document.getElementById('pagamento-comprovante-input');
  if (pagUploader && pagFileInput) {
    pagUploader.addEventListener('click', () => pagFileInput.click());
    pagFileInput.addEventListener('change', handlePagamentoComprovanteSelection);
  }
}

// === MODAIS CUSTOMIZADOS ===
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('active');
}

// Modal personalizado de alerta/confirmação
function showCustomAlert(title, message, isSuccess = true) {
  const overlay = document.getElementById('modal-alert-overlay');
  const icon = document.getElementById('alert-modal-icon');
  const titleEl = document.getElementById('alert-modal-title');
  const messageEl = document.getElementById('alert-modal-message');
  
  titleEl.textContent = title;
  messageEl.textContent = message;
  
  if (isSuccess) {
    icon.className = 'alert-icon success';
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0F3A5F" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-circle-2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`;
  } else {
    icon.className = 'alert-icon success'; // mantém estilo
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#E74C3C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alert-triangle"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  }
  
  overlay.classList.add('active');
  
  // Listener de fechar
  const closeBtn = document.getElementById('btn-close-alert');
  const handleClose = () => {
    overlay.classList.remove('active');
    closeBtn.removeEventListener('click', handleClose);
  };
  closeBtn.addEventListener('click', handleClose);
}

// === CONTROLES DO CLIENTE ===
function openClienteModal(cliente = null) {
  const isEdit = !!cliente;
  document.getElementById('cliente-modal-title').textContent = isEdit ? 'Editar Cliente' : 'Novo Cliente';
  
  document.getElementById('cliente-id').value = isEdit ? cliente.id : '';
  document.getElementById('cliente-nome').value = isEdit ? cliente.nome : '';
  document.getElementById('cliente-cpf').value = isEdit ? (cliente.cpf || '') : '';
  document.getElementById('cliente-cnpj').value = isEdit ? (cliente.cnpj || '') : '';
  document.getElementById('cliente-telefone').value = isEdit ? (cliente.telefone || '') : '';
  document.getElementById('cliente-email').value = isEdit ? (cliente.email || '') : '';
  document.getElementById('cliente-endereco').value = isEdit ? (cliente.endereco || '') : '';
  document.getElementById('cliente-numero').value = isEdit ? (cliente.numero || '') : '';
  document.getElementById('cliente-complemento').value = isEdit ? (cliente.complemento || '') : '';
  document.getElementById('cliente-bairro').value = isEdit ? (cliente.bairro || '') : '';
  document.getElementById('cliente-cidade').value = isEdit ? (cliente.cidade || '') : '';
  
  openModal('modal-cliente-overlay');
}

async function handleSaveCliente(e) {
  e.preventDefault();
  
  const id = document.getElementById('cliente-id').value || 'cli_' + Date.now();
  const nome = document.getElementById('cliente-nome').value.trim();
  const cpf = document.getElementById('cliente-cpf').value.trim();
  const cnpj = document.getElementById('cliente-cnpj').value.trim();
  const telefone = document.getElementById('cliente-telefone').value.trim();
  const email = document.getElementById('cliente-email').value.trim();
  const endereco = document.getElementById('cliente-endereco').value.trim();
  const numero = document.getElementById('cliente-numero').value.trim();
  const complemento = document.getElementById('cliente-complemento').value.trim();
  const bairro = document.getElementById('cliente-bairro').value.trim();
  const cidade = document.getElementById('cliente-cidade').value.trim();

  if (!nome) return;

  const cliente = {
    id,
    nome,
    cpf,
    cnpj,
    telefone,
    email,
    endereco,
    numero,
    complemento,
    bairro,
    cidade,
    synced: false,
    updatedAt: new Date().toISOString()
  };

  try {
    await dbClientes.save(cliente);
    closeModal('modal-cliente-overlay');
    showCustomAlert('Cliente Salvo', `O cliente "${nome}" foi cadastrado localmente com sucesso!`);
    
    await loadLocalData();
    renderClientesList();
    renderClientesDropdown();
    updateSyncCounters();

    // Se veio do cadastro rápido no orçamento, auto-seleciona
    if (state.fastAddingClient) {
      document.getElementById('budget-cliente').value = id;
      state.fastAddingClient = false;
    }
  } catch (err) {
    console.error(err);
    showCustomAlert('Erro', 'Não foi possível salvar o cliente.', false);
  }
}

async function deleteCliente(id, nome) {
  // Confirmador customizado simples
  if (confirm(`Deseja realmente excluir o cliente "${nome}"?\n(Esta ação apaga apenas os dados locais do dispositivo)`)) {
    try {
      await dbClientes.delete(id);
      showCustomAlert('Excluído', `Cliente "${nome}" removido localmente.`);
      await loadLocalData();
      renderClientesList();
      renderClientesDropdown();
      updateSyncCounters();
    } catch (err) {
      console.error(err);
    }
  }
}

function renderClientesList() {
  const list = document.getElementById('clientes-list');
  list.innerHTML = '';
  
  if (state.clientes.length === 0) {
    list.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">
        <p>Nenhum cliente cadastrado ainda.</p>
        <p style="font-size: 0.85rem; margin-top: 0.5rem;">Clique em "+ Novo Cliente" para começar.</p>
      </div>
    `;
    return;
  }
  
  state.clientes.forEach(cli => {
    const card = document.createElement('div');
    card.className = `card ${cli.synced ? 'synced' : ''}`;
    
    let docIdentidade = '';
    if (cli.cpf) docIdentidade += `CPF: ${cli.cpf} `;
    if (cli.cnpj) docIdentidade += `CNPJ: ${cli.cnpj}`;
    if (!docIdentidade) docIdentidade = 'Não informado';

    card.innerHTML = `
      <h3 class="card-title">${cli.nome}</h3>
      <div class="card-field">
        <span class="card-label">Contato:</span>
        <span>${cli.telefone || 'Sem telefone'}</span>
      </div>
      <div class="card-field">
        <span class="card-label">Doc:</span>
        <span>${docIdentidade}</span>
      </div>
      <div class="card-field">
        <span class="card-label">Cidade:</span>
        <span>${cli.cidade || 'Não informada'}</span>
      </div>
      <div class="card-actions">
        <button class="btn btn-secondary btn-sm" onclick="editClienteCard('${cli.id}')">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCliente('${cli.id}', '${cli.nome}')">Excluir</button>
      </div>
    `;
    list.appendChild(card);
  });
}

// Atalho do card
window.editClienteCard = (id) => {
  const cli = state.clientes.find(c => c.id === id);
  if (cli) openClienteModal(cli);
};


// === CONTROLES DO ORÇAMENTO ===

// Auxiliares para linhas dinâmicas de Serviços e Materiais
function addServiceRow(val = '') {
  const container = document.getElementById('services-rows');
  const row = document.createElement('div');
  row.className = 'dynamic-row';
  row.innerHTML = `
    <input type="text" class="form-input service-desc" placeholder="Ex: Pintura externa da mureta cinza" value="${val}" required>
    <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()" style="padding: 0.75rem;">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
    </button>
  `;
  container.appendChild(row);
}

function addMaterialRow(mat = '', desc = '') {
  const container = document.getElementById('materials-rows');
  const row = document.createElement('div');
  row.className = 'dynamic-row';
  row.innerHTML = `
    <input type="text" class="form-input material-name" placeholder="Ex: 1 lata de 18 lt tinta acrílica" value="${mat}" required style="flex: 2;">
    <input type="text" class="form-input material-desc" placeholder="Observações (opcional)" value="${desc}" style="flex: 1;">
    <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()" style="padding: 0.75rem;">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
    </button>
  `;
  container.appendChild(row);
}

// Configura botões de adicionar nas linhas
document.getElementById('btn-add-service-row').addEventListener('click', () => addServiceRow());
document.getElementById('btn-add-material-row').addEventListener('click', () => addMaterialRow());

// Renderiza a lista de clientes no formulário
function renderClientesDropdown() {
  const select = document.getElementById('budget-cliente');
  select.innerHTML = '<option value="">-- Selecione o Cliente --</option>';
  
  state.clientes.forEach(cli => {
    const opt = document.createElement('option');
    opt.value = cli.id;
    opt.textContent = cli.nome;
    select.appendChild(opt);
  });
}

// Gera código incremental ex: ORC-2026-0001
function generateNextBudgetCode() {
  const year = new Date().getFullYear();
  const prefix = `ORC-${year}-`;
  
  // Filtra orçamentos do ano atual
  const currentYearBudgets = state.orcamentos.filter(o => o.codigo.startsWith(prefix));
  
  if (currentYearBudgets.length === 0) {
    return `${prefix}0001`;
  }
  
  // Extrai o número do maior código
  const codes = currentYearBudgets.map(o => {
    const numPart = o.codigo.split('-')[2];
    return parseInt(numPart, 10);
  });
  
  const maxNum = Math.max(...codes);
  const nextNum = maxNum + 1;
  
  // Formata com zeros à esquerda
  const paddedNum = String(nextNum).padStart(4, '0');
  return `${prefix}${paddedNum}`;
}

// Abre modal de Orçamento
function openOrcamentoModal(orcamento = null) {
  const isEdit = !!orcamento;
  document.getElementById('orcamento-modal-title').textContent = isEdit ? 'Editar Orçamento' : 'Novo Orçamento';
  
  document.getElementById('orcamento-id').value = isEdit ? orcamento.id : '';
  
  // Código (gerado ou travado se for edição)
  const codeInput = document.getElementById('orcamento-codigo');
  codeInput.value = isEdit ? orcamento.codigo : generateNextBudgetCode();
  
  // Data (hoje por padrão)
  document.getElementById('orcamento-data').value = isEdit ? orcamento.data : new Date().toISOString().slice(0, 10);
  
  // Cliente
  document.getElementById('budget-cliente').value = isEdit ? orcamento.clienteId : '';
  
  // Observações
  document.getElementById('orcamento-obs').value = isEdit ? (orcamento.observacoes || '') : '50% no início da obra e o restante no final do serviço';
  
  // Valor Total
  document.getElementById('orcamento-total').value = isEdit ? orcamento.valorTotal : '';

  // Limpa e recria linhas dinâmicas
  document.getElementById('services-rows').innerHTML = '';
  document.getElementById('materials-rows').innerHTML = '';
  
  if (isEdit) {
    if (Array.isArray(orcamento.servicos)) {
      orcamento.servicos.forEach(s => addServiceRow(s));
    }
    if (Array.isArray(orcamento.materiais)) {
      orcamento.materiais.forEach(m => addMaterialRow(m.material, m.descricao));
    }
    state.currentBudgetPhotos = [...(orcamento.fotos || [])];
  } else {
    // Adiciona linhas padrão em branco para começar
    addServiceRow();
    addMaterialRow();
    state.currentBudgetPhotos = [];
  }

  renderPhotoPreviews();
  openModal('modal-orcamento-overlay');
}

// Tratamento de fotos carregadas
function handlePhotoSelection(e) {
  const files = e.target.files;
  if (!files.length) return;

  const maxFiles = 30;
  if (state.currentBudgetPhotos.length + files.length > maxFiles) {
    alert(`Limite máximo de ${maxFiles} fotos por orçamento excedido.`);
    return;
  }

  // Mostra indicador de processando
  const container = document.getElementById('photo-uploader');
  const originalHtml = container.innerHTML;
  container.innerHTML = `<span style="color: var(--primary-color); font-weight: bold;">Processando fotos, aguarde...</span>`;

  let processedCount = 0;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const reader = new FileReader();
    
    reader.onload = (event) => {
      // Otimizar a imagem no navegador se for grande (opcional)
      // No momento, apenas salvamos em base64. O IndexedDB suporta perfeitamente.
      state.currentBudgetPhotos.push(event.target.result);
      processedCount++;
      
      if (processedCount === files.length) {
        container.innerHTML = originalHtml;
        renderPhotoPreviews();
      }
    };
    
    reader.readAsDataURL(file);
  }
}

// Renderiza visualizações das fotos no formulário
function renderPhotoPreviews() {
  const container = document.getElementById('photo-grid-preview');
  container.innerHTML = '';
  
  state.currentBudgetPhotos.forEach((base64, index) => {
    const item = document.createElement('div');
    item.className = 'photo-preview-item';
    item.innerHTML = `
      <img src="${base64}" alt="Foto ${index + 1}">
      <button type="button" class="photo-delete-btn" onclick="removeBudgetPhoto(${index})">&times;</button>
    `;
    container.appendChild(item);
  });
}

window.removeBudgetPhoto = (index) => {
  state.currentBudgetPhotos.splice(index, 1);
  renderPhotoPreviews();
};

// Gravar Orçamento
async function handleSaveOrcamento(e) {
  e.preventDefault();
  
  const id = document.getElementById('orcamento-id').value || 'orc_' + Date.now();
  const codigo = document.getElementById('orcamento-codigo').value.trim();
  const data = document.getElementById('orcamento-data').value;
  const clienteId = document.getElementById('budget-cliente').value;
  const observacoes = document.getElementById('orcamento-obs').value.trim();
  const valorTotalVal = document.getElementById('orcamento-total').value;
  const valorTotal = parseFloat(valorTotalVal) || 0;

  if (!codigo || !clienteId) {
    alert('Preencha os campos obrigatórios (Cliente e Código).');
    return;
  }

  // Nome do cliente
  const cli = state.clientes.find(c => c.id === clienteId);
  const clienteNome = cli ? cli.nome : 'Cliente não encontrado';

  // Coleta Serviços
  const servicos = [];
  document.querySelectorAll('.service-desc').forEach(input => {
    const val = input.value.trim();
    if (val) servicos.push(val);
  });

  // Coleta Materiais
  const materiais = [];
  const matNames = document.querySelectorAll('.material-name');
  const matDescs = document.querySelectorAll('.material-desc');
  for (let i = 0; i < matNames.length; i++) {
    const name = matNames[i].value.trim();
    const desc = matDescs[i].value.trim();
    if (name) {
      materiais.push({ material: name, descricao: desc });
    }
  }

  const orcamento = {
    id,
    codigo,
    data,
    clienteId,
    clienteNome,
    servicos,
    materiais,
    observacoes,
    fotos: state.currentBudgetPhotos, // base64 array
    valorTotal,
    synced: false,
    updatedAt: new Date().toISOString()
  };

  try {
    // 1. Salva localmente no IndexedDB
    await dbOrcamentos.save(orcamento);
    closeModal('modal-orcamento-overlay');
    
    // 2. Mostra alerta customizado avisando do salvamento
    showCustomAlert(
      'Orçamento Salvo!', 
      `O orçamento "${codigo}" foi registrado localmente com sucesso!`
    );
    
    await loadLocalData();
    renderOrcamentosList();
    updateSyncCounters();
  } catch (err) {
    console.error(err);
    showCustomAlert('Erro', 'Não foi possível salvar o orçamento.', false);
  }
}

async function deleteOrcamento(id, codigo) {
  if (confirm(`Deseja realmente apagar o orçamento "${codigo}" localmente?`)) {
    try {
      await dbOrcamentos.delete(id);
      showCustomAlert('Excluído', `Orçamento "${codigo}" apagado localmente.`);
      await loadLocalData();
      renderOrcamentosList();
      updateSyncCounters();
    } catch (err) {
      console.error(err);
    }
  }
}

// Renderiza a lista de Orçamentos cadastrados
function renderOrcamentosList() {
  const list = document.getElementById('orcamentos-list');
  list.innerHTML = '';
  
  if (state.orcamentos.length === 0) {
    list.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">
        <p>Nenhum orçamento gerado ainda.</p>
        <p style="font-size: 0.85rem; margin-top: 0.5rem;">Clique em "+ Novo Orçamento" para começar.</p>
      </div>
    `;
    return;
  }
  
  state.orcamentos.forEach(orc => {
    const card = document.createElement('div');
    card.className = `card ${orc.synced ? 'synced' : ''}`;
    
    const formattedVal = orc.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formattedDate = orc.data.split('-').reverse().join('/');
    const photoCount = orc.fotos ? orc.fotos.length : 0;

    const obraExistente = state.obras.find(o => o.orcamentoId === orc.id);
    const actionButtonHtml = obraExistente 
      ? `<button class="btn btn-secondary btn-sm" disabled style="opacity: 0.65; cursor: not-allowed; border: 1px dashed var(--border-color);">Obra em Andamento</button>`
      : `<button class="btn btn-primary btn-sm" onclick="iniciarObraFromOrcamento('${orc.id}')">Iniciar Obra</button>`;

    card.innerHTML = `
      <h3 class="card-title">${orc.codigo}</h3>
      <div class="card-field">
        <span class="card-label">Cliente:</span>
        <span style="font-weight:600;">${orc.clienteNome}</span>
      </div>
      <div class="card-field">
        <span class="card-label">Data:</span>
        <span>${formattedDate}</span>
      </div>
      <div class="card-field">
        <span class="card-label">Fotos Anexas:</span>
        <span>${photoCount} fotos</span>
      </div>
      <div class="card-field" style="margin-top: 0.5rem; font-size: 1.05rem; font-weight: 700; color: var(--primary-color);">
        <span class="card-label">Valor Total:</span>
        <span>${formattedVal}</span>
      </div>
      <div class="card-actions" style="flex-wrap: wrap;">
        <button class="btn btn-accent btn-sm" onclick="compileAndPrint('${orc.id}')">Gerar PDF</button>
        <button class="btn btn-secondary btn-sm" onclick="editOrcamentoCard('${orc.id}')">Editar</button>
        ${actionButtonHtml}
        <button class="btn btn-danger btn-sm" onclick="deleteOrcamento('${orc.id}', '${orc.codigo}')">Excluir</button>
      </div>
    `;
    list.appendChild(card);
  });
}

window.editOrcamentoCard = (id) => {
  const orc = state.orcamentos.find(o => o.id === id);
  if (orc) openOrcamentoModal(orc);
};




// === GERAÇÃO E COMPILAÇÃO DE PDF DO ORÇAMENTO ===
async function compileAndPrint(id) {
  const orc = state.orcamentos.find(o => o.id === id);
  if (!orc) return;

  // Busca detalhes do cliente para ter todos os campos
  const cliente = await dbClientes.getById(orc.clienteId);
  const cliDetails = cliente || {
    nome: orc.clienteNome,
    telefone: '—',
    cpf: '',
    cnpj: '',
    email: '—',
    endereco: '—',
    cidade: '—'
  };

  const formattedDate = orc.data.split('-').reverse().join('/');
  const formattedTotal = orc.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Pega o container de layout de impressão
  const printLayout = document.getElementById('print-layout');
  printLayout.innerHTML = ''; // Limpa anterior

  // Determinar número de páginas
  const photos = orc.fotos || [];
  const photosPerPage = 9;
  const totalPagesOfPhotos = Math.ceil(photos.length / photosPerPage);
  const totalPages = 1 + totalPagesOfPhotos;
  
  // === CONSTRUÇÃO DA PÁGINA 1 ===
  const page1 = document.createElement('div');
  page1.className = 'pdf-page';
  
  // Header com fundo azul escuro sangrado
  const headerHtml = `
    <div class="pdf-header">
      <div class="pdf-logo-box">
        <img class="pdf-logo-img" src="./logo.png" alt="P.S.O REFORMAS">
      </div>
      <div class="pdf-company-info">
        <div class="pdf-company-title">P.S.O REFORMAS</div>
        <div class="pdf-company-subtitle">CNPJ 39.589.383/0001-10  &bull;  (51) 99398-4535  &bull;  paulodasiladeoliveira5@gmail.com</div>
        <div class="pdf-company-budget">Orçamento ${orc.codigo}  &bull;  ${formattedDate}</div>
      </div>
    </div>
  `;

  let docIdentidade = '';
  if (cliDetails.cpf) docIdentidade += `CPF: ${cliDetails.cpf}`;
  if (cliDetails.cnpj) {
    if (docIdentidade) docIdentidade += ' / ';
    docIdentidade += `CNPJ: ${cliDetails.cnpj}`;
  }
  if (!docIdentidade) docIdentidade = '—';

  let cliAddress = cliDetails.endereco || '—';
  if (cliDetails.numero) cliAddress += `, Nº ${cliDetails.numero}`;
  if (cliDetails.complemento) cliAddress += ` (${cliDetails.complemento})`;
  if (cliDetails.bairro) cliAddress += `, Bairro ${cliDetails.bairro}`;
  if (cliDetails.cidade) {
    if (cliAddress !== '—') cliAddress += ` - ${cliDetails.cidade}`;
    else cliAddress = cliDetails.cidade;
  }

  const clientHtml = `
    <div class="pdf-section-title">Dados do Cliente</div>
    <div class="pdf-client-grid">
      <div class="pdf-client-label">Nome</div>
      <div class="pdf-client-value">${cliDetails.nome}</div>
      
      <div class="pdf-client-label">Documento</div>
      <div class="pdf-client-value">${docIdentidade}</div>
      
      <div class="pdf-client-label">Telefone</div>
      <div class="pdf-client-value">${cliDetails.telefone || '—'}</div>
      
      <div class="pdf-client-label">E-mail</div>
      <div class="pdf-client-value">${cliDetails.email || '—'}</div>
      
      <div class="pdf-client-label">Endereço</div>
      <div class="pdf-client-value">${cliAddress}</div>
    </div>
  `;

  // Serviços a Executar
  let servicesRowsHtml = '';
  if (orc.servicos && orc.servicos.length > 0) {
    orc.servicos.forEach((s, idx) => {
      servicesRowsHtml += `
        <tr>
          <td class="col-num">${idx + 1}</td>
          <td>- ${s}</td>
        </tr>
      `;
    });
  } else {
    servicesRowsHtml = '<tr><td colspan="2">Nenhum serviço registrado.</td></tr>';
  }

  const servicesHtml = `
    <div class="pdf-section-title">Serviços a Executar</div>
    <table class="pdf-table">
      <thead>
        <tr>
          <th class="col-num">#</th>
          <th class="col-desc">Serviço / Descrição</th>
        </tr>
      </thead>
      <tbody>
        ${servicesRowsHtml}
      </tbody>
    </table>
  `;

  // Materiais
  let materialsRowsHtml = '';
  if (orc.materiais && orc.materiais.length > 0) {
    orc.materiais.forEach((m, idx) => {
      materialsRowsHtml += `
        <tr>
          <td class="col-num">${idx + 1}</td>
          <td style="font-weight: 600;">- ${m.material}</td>
          <td>${m.descricao || ''}</td>
        </tr>
      `;
    });
  } else {
    materialsRowsHtml = '<tr><td colspan="3">Nenhum material registrado.</td></tr>';
  }

  const materialsHtml = `
    <div class="pdf-section-title">Materiais</div>
    <table class="pdf-table">
      <thead>
        <tr>
          <th class="col-num">#</th>
          <th>Material</th>
          <th>Descrição</th>
        </tr>
      </thead>
      <tbody>
        ${materialsRowsHtml}
      </tbody>
    </table>
  `;

  // Observações
  const obsHtml = `
    <div class="pdf-section-title">Observações</div>
    <div class="pdf-obs-box">
      ${orc.observacoes.replace(/\n/g, '<br>')}
    </div>
  `;

  // Renderiza Página 1
  page1.innerHTML = `
    ${headerHtml}
    <div class="pdf-content">
      ${clientHtml}
      ${servicesHtml}
      ${materialsHtml}
      ${obsHtml}
    </div>
    <div class="pdf-footer">
      <span>P.S.O REFORMAS &bull; CNPJ 39.589.383/0001-10 &bull; (51) 99398-4535</span>
      <span class="pdf-page-number">Pág. 1/${totalPages}</span>
    </div>
  `;
  
  printLayout.appendChild(page1);

  // === CONSTRUÇÃO DA PÁGINA 2 (FOTOS E ASSINATURAS) ===
  if (photos.length > 0) {
    for (let pageIdx = 0; pageIdx < totalPagesOfPhotos; pageIdx++) {
      const pageNum = 2 + pageIdx;
      
      const pageN = document.createElement('div');
      pageN.className = 'pdf-page';
      
      // Filtra fotos para esta página
      const startIdx = pageIdx * photosPerPage;
      const endIdx = startIdx + photosPerPage;
      const pagePhotos = photos.slice(startIdx, endIdx);
      
      let photoGridHtml = '<div class="pdf-photo-grid">';
      pagePhotos.forEach(p => {
        photoGridHtml += `
          <div class="pdf-photo-item">
            <img src="${p}" alt="Foto do registro">
          </div>
        `;
      });
      photoGridHtml += '</div>';

      const isLastPage = (pageIdx === totalPagesOfPhotos - 1);
      let bottomContent = '';
      
      // Se for a última página de fotos, adiciona o total e assinaturas
      if (isLastPage) {
        bottomContent = `
          <div class="pdf-total-bar" style="margin-top: auto;">
            <span>Valor Total do Orçamento</span>
            <span class="pdf-total-value">${formattedTotal}</span>
          </div>
          
          <div class="pdf-signatures">
            <div class="pdf-sig-line">Cliente</div>
            <div class="pdf-sig-line">Responsável — P.S.O REFORMAS</div>
          </div>
        `;
      }
      
      pageN.innerHTML = `
        ${headerHtml}
        <div class="pdf-content">
          <div class="pdf-section-title">Registro Fotográfico</div>
          ${photoGridHtml}
          ${bottomContent}
        </div>
        <div class="pdf-footer">
          <span>P.S.O REFORMAS &bull; CNPJ 39.589.383/0001-10 &bull; (51) 99398-4535</span>
          <span class="pdf-page-number">Pág. ${pageNum}/${totalPages}</span>
        </div>
      `;
      printLayout.appendChild(pageN);
    }
  } else {
    // Se não tiver fotos, adiciona o total e assinaturas no final do .pdf-content da página 1
    const pdfContent = page1.querySelector('.pdf-content');
    const sigContainer = document.createElement('div');
    sigContainer.style.marginTop = 'auto'; // empurra para o fundo
    sigContainer.style.paddingTop = '10px';
    sigContainer.innerHTML = `
      <div class="pdf-total-bar">
        <span>Valor Total do Orçamento</span>
        <span class="pdf-total-value">${formattedTotal}</span>
      </div>
      
      <div class="pdf-signatures">
        <div class="pdf-sig-line">Cliente</div>
        <div class="pdf-sig-line">Responsável — P.S.O REFORMAS</div>
      </div>
    `;
    pdfContent.appendChild(sigContainer);
  }

  // Executa impressão nativa
  // Isso abrirá o diálogo nativo do sistema operacional (iOS, Android, Windows)
  // O usuário escolhe "Salvar como PDF"
  setTimeout(() => {
    window.print();
  }, 300);
}


// === PROCESSAMENTO DE ARQUIVOS DE BACKUP (IMPORTAÇÃO) ===
function handleImportGeralFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    const content = event.target.result;
    const res = await importGeralBackup(content);

    if (res.success) {
      const obrasMsg = res.obrasCount !== undefined ? `, ${res.obrasCount} obras` : '';
      showCustomAlert(
        'Importação Concluída', 
        `Backup importado com sucesso! ${res.clientesCount} clientes, ${res.orcamentosCount} orçamentos${obrasMsg} foram carregados localmente.`
      );
      await loadLocalData();
      renderClientesList();
      renderClientesDropdown();
      renderOrcamentosList();
      renderObrasList();
      updateSyncCounters();
    } else {
      showCustomAlert('Falha na Importação', `Erro: ${res.error}`, false);
    }
  };
  reader.readAsText(file);
  e.target.value = ''; // Limpa input
}


// === SINCRONIZAÇÃO POCKETBASE ===
function updateSyncCounters() {
  const pendingCli = state.clientes.filter(c => !c.synced).length;
  const pendingOrc = state.orcamentos.filter(o => !o.synced).length;

  document.getElementById('pending-clientes-count').textContent = pendingCli;
  document.getElementById('pending-orcamentos-count').textContent = pendingOrc;

  const syncBtn = document.getElementById('btn-sync-pocketbase');
  if (pendingCli === 0 && pendingOrc === 0) {
    syncBtn.disabled = true;
    syncBtn.textContent = 'Tudo Sincronizado';
    syncBtn.classList.remove('btn-accent');
    syncBtn.classList.add('btn-secondary');
  } else {
    syncBtn.disabled = false;
    syncBtn.textContent = 'Sincronizar com PocketBase';
    syncBtn.classList.add('btn-accent');
    syncBtn.classList.remove('btn-secondary');
  }
}

// Helper para converter base64 em Blob (File) para enviar no PocketBase
function base64ToBlob(base64, mimeType = 'image/jpeg') {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  
  return new Blob([ab], { type: mimeType });
}

async function handlePocketBaseSync() {
  const syncBtn = document.getElementById('btn-sync-pocketbase');
  const originalText = syncBtn.textContent;
  
  syncBtn.disabled = true;
  syncBtn.textContent = 'Sincronizando dados...';

  // 1. Sincroniza Clientes pendentes
  const pendingClientes = state.clientes.filter(c => !c.synced);
  let syncedCliCount = 0;

  for (const cli of pendingClientes) {
    try {
      // Monta dados do cliente para o PocketBase
      const payload = {
        id: cli.id, // podemos tentar forçar o mesmo id se o PocketBase permitir ou usar o id local
        nome: cli.nome,
        cpf: cli.cpf,
        cnpj: cli.cnpj,
        telefone: cli.telefone,
        email: cli.email,
        endereco: cli.endereco,
        numero: cli.numero,
        complemento: cli.complemento,
        bairro: cli.bairro,
        cidade: cli.cidade
      };

      // Tenta criar ou atualizar (PocketBase upsert simulado via POST / PATCH)
      // Como o ID local é do tipo cli_timestamp (que não é o padrão de 15 chars do PocketBase),
      // o PocketBase gerará um id próprio. Vamos tentar cadastrar com POST.
      // Dica: Para evitar duplicados, pesquisamos pelo cpf/cnpj ou nome se existirem, ou criamos.
      
      // Busca se cliente com mesmo nome já existe no PocketBase
      const checkRes = await fetch(`${PB_URL}/api/collections/clientes/records?filter=(nome='${encodeURIComponent(cli.nome)}')`);
      const checkData = await checkRes.json();
      
      let res;
      if (checkData.items && checkData.items.length > 0) {
        // Atualiza cliente existente no PocketBase
        const pbId = checkData.items[0].id;
        res = await fetch(`${PB_URL}/api/collections/clientes/records/${pbId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        // Cria novo cliente no PocketBase
        res = await fetch(`${PB_URL}/api/collections/clientes/records`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        const pbRecord = await res.json();
        cli.synced = true;
        cli.pbId = pbRecord.id; // guarda id retornado do PocketBase
        await dbClientes.save(cli);
        syncedCliCount++;
      }
    } catch (err) {
      console.warn('Erro ao sincronizar cliente:', cli.nome, err);
    }
  }

  // Recarrega dados para obter os IDs sincronizados para mapear os orçamentos
  await loadLocalData();

  // 2. Sincroniza Orçamentos pendentes
  const pendingOrcamentos = state.orcamentos.filter(o => !o.synced);
  let syncedOrcCount = 0;

  for (const orc of pendingOrcamentos) {
    try {
      // Mapeia clienteId local para o clienteId do PocketBase
      const localCli = state.clientes.find(c => c.id === orc.clienteId);
      const pbClienteId = localCli && localCli.pbId ? localCli.pbId : '';

      // Usamos FormData para suportar envio de fotos binárias ao PocketBase
      const formData = new FormData();
      formData.append('codigo', orc.codigo);
      formData.append('data', orc.data);
      formData.append('cliente_id', pbClienteId);
      formData.append('servicos', JSON.stringify(orc.servicos));
      formData.append('materiais', JSON.stringify(orc.materiais));
      formData.append('observacoes', orc.observacoes);
      formData.append('valor_total', orc.valorTotal);

      // Adiciona as fotos convertendo base64 em blobs binários
      if (orc.fotos && orc.fotos.length > 0) {
        orc.fotos.forEach((b64, idx) => {
          // Extrai o tipo mime
          const mime = b64.match(/data:(.*?);/)[1];
          const blob = base64ToBlob(b64, mime);
          const ext = mime.split('/')[1];
          formData.append('fotos', blob, `foto_${idx}_${orc.codigo}.${ext}`);
        });
      }

      // Verifica se orçamento com mesmo código já existe
      const checkRes = await fetch(`${PB_URL}/api/collections/orcamentos/records?filter=(codigo='${orc.codigo}')`);
      const checkData = await checkRes.json();
      
      let res;
      if (checkData.items && checkData.items.length > 0) {
        const pbId = checkData.items[0].id;
        res = await fetch(`${PB_URL}/api/collections/orcamentos/records/${pbId}`, {
          method: 'PATCH',
          body: formData
        });
      } else {
        res = await fetch(`${PB_URL}/api/collections/orcamentos/records`, {
          method: 'POST',
          body: formData
        });
      }

      if (res.ok) {
        orc.synced = true;
        await dbOrcamentos.save(orc);
        syncedOrcCount++;
      }
    } catch (err) {
      console.warn('Erro ao sincronizar orçamento:', orc.codigo, err);
    }
  }

  // Finalização da Sincronização
  await loadLocalData();
  renderClientesList();
  renderOrcamentosList();
  updateSyncCounters();
  
  if (syncedCliCount > 0 || syncedOrcCount > 0) {
    showCustomAlert(
      'Sincronização Concluída', 
      `Foram enviados ao PocketBase: ${syncedCliCount} clientes e ${syncedOrcCount} orçamentos com sucesso!`
    );
  } else {
    showCustomAlert(
      'Sem Conexão ou Servidor Indisponível', 
      'Não foi possível sincronizar os registros. Verifique se o servidor PocketBase está rodando na porta 8070 e tente novamente.', 
      false
    );
  }

  syncBtn.textContent = originalText;
  syncBtn.disabled = false;
}

// === CONTROLES DE OBRAS ===

// Inicia obra a partir do orçamento
window.iniciarObraFromOrcamento = async (orcamentoId) => {
  const orc = state.orcamentos.find(o => o.id === orcamentoId);
  if (!orc) return;

  document.getElementById('iniciar-obra-orcamento-id').value = orc.id;
  document.getElementById('iniciar-obra-cliente-id').value = orc.clienteId;
  document.getElementById('iniciar-obra-cliente-nome').value = orc.clienteNome;
  document.getElementById('iniciar-obra-codigo-orcamento').value = orc.codigo;

  document.getElementById('iniciar-obra-orcamento-cod').value = orc.codigo;
  document.getElementById('iniciar-obra-cliente-display').value = orc.clienteNome;

  // Preenche datas padrão (Data de hoje para início, e daqui 30 dias para término)
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('iniciar-obra-data-inicio').value = today;
  
  const future = new Date();
  future.setDate(future.getDate() + 30);
  document.getElementById('iniciar-obra-data-termino').value = future.toISOString().slice(0, 10);

  // Valor combinado livre para digitação conforme solicitado
  document.getElementById('iniciar-obra-valor-combinado').value = '';
  document.getElementById('iniciar-obra-valor-entrada').value = '';
  document.getElementById('iniciar-obra-forma-entrada').value = '';

  openModal('modal-iniciar-obra-overlay');
};

async function handleSaveObra(e) {
  e.preventDefault();

  const orcamentoId = document.getElementById('iniciar-obra-orcamento-id').value;
  const clienteId = document.getElementById('iniciar-obra-cliente-id').value;
  const clienteNome = document.getElementById('iniciar-obra-cliente-nome').value;
  const codigoOrcamento = document.getElementById('iniciar-obra-codigo-orcamento').value;

  const dataInicio = document.getElementById('iniciar-obra-data-inicio').value;
  const previsaoTermino = document.getElementById('iniciar-obra-data-termino').value;
  const valorCombinado = parseFloat(document.getElementById('iniciar-obra-valor-combinado').value);
  const valorEntrada = parseFloat(document.getElementById('iniciar-obra-valor-entrada').value || 0);
  const formaEntrada = document.getElementById('iniciar-obra-forma-entrada').value.trim();

  if (isNaN(valorCombinado) || valorCombinado <= 0) {
    alert('Por favor, insira um valor combinado válido.');
    return;
  }

  const id = 'obra_' + Date.now();
  const obra = {
    id,
    orcamentoId,
    clienteId,
    clienteNome,
    codigoOrcamento,
    dataInicio,
    previsaoTermino,
    valorCombinado,
    valorEntrada,
    formaEntrada,
    pagamentos: [],
    synced: false,
    updatedAt: new Date().toISOString()
  };

  try {
    await dbObras.save(obra);
    closeModal('modal-iniciar-obra-overlay');
    showCustomAlert('Obra Iniciada!', `A obra associada ao orçamento "${codigoOrcamento}" foi criada com sucesso.`);
    
    await loadLocalData();
    renderObrasList();
    renderOrcamentosList(); // Atualiza botão no card do orçamento
    switchTab('obras');
  } catch (err) {
    console.error(err);
    showCustomAlert('Erro', 'Não foi possível salvar a obra.', false);
  }
}

// Registrar pagamento em uma obra
window.abrirModalPagamento = (obraId) => {
  document.getElementById('pagamento-obra-id').value = obraId;
  document.getElementById('pagamento-valor').value = '';
  document.getElementById('pagamento-data').value = new Date().toISOString().slice(0, 10);
  
  // Limpa upload do comprovante
  state.currentPaymentReceipt = null;
  document.getElementById('pagamento-comprovante-input').value = '';
  document.getElementById('pagamento-comprovante-preview').style.display = 'none';
  document.getElementById('img-comprovante-preview').src = '';

  openModal('modal-pagamento-overlay');
};

async function handleSavePagamento(e) {
  e.preventDefault();

  const obraId = document.getElementById('pagamento-obra-id').value;
  const valor = parseFloat(document.getElementById('pagamento-valor').value);
  const data = document.getElementById('pagamento-data').value;
  const comprovante = state.currentPaymentReceipt;

  if (isNaN(valor) || valor <= 0) {
    alert('Por favor, insira um valor válido para o pagamento.');
    return;
  }

  try {
    const obra = await dbObras.getById(obraId);
    if (!obra) {
      alert('Obra não encontrada.');
      return;
    }

    if (!obra.pagamentos) {
      obra.pagamentos = [];
    }

    obra.pagamentos.push({
      id: 'pag_' + Date.now(),
      valor,
      data,
      comprovante
    });

    obra.updatedAt = new Date().toISOString();
    obra.synced = false;

    await dbObras.save(obra);
    closeModal('modal-pagamento-overlay');
    showCustomAlert('Pagamento Registrado!', 'O pagamento foi adicionado com sucesso.');

    await loadLocalData();
    renderObrasList();
  } catch (err) {
    console.error(err);
    showCustomAlert('Erro', 'Não foi possível registrar o pagamento.', false);
  }
}

function handlePagamentoComprovanteSelection(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    state.currentPaymentReceipt = event.target.result;
    
    const previewDiv = document.getElementById('pagamento-comprovante-preview');
    const previewImg = document.getElementById('img-comprovante-preview');
    
    previewImg.src = event.target.result;
    previewDiv.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

// Visualizar comprovante
window.visualizarComprovante = (comprovanteBase64) => {
  if (!comprovanteBase64) return;
  const imgFull = document.getElementById('img-comprovante-full');
  imgFull.src = comprovanteBase64;
  openModal('modal-comprovante-overlay');
};

// Excluir/Encerrar obra
window.deleteObraCard = async (id, codigo) => {
  if (confirm(`Deseja realmente apagar/encerrar a obra do orçamento "${codigo}"?\n(Esta ação apaga apenas os dados locais do dispositivo)`)) {
    try {
      await dbObras.delete(id);
      showCustomAlert('Excluída', 'A obra foi removida localmente.');
      await loadLocalData();
      renderObrasList();
      renderOrcamentosList(); // Atualiza botão no card de orçamentos
    } catch (err) {
      console.error(err);
    }
  }
};

// Renderiza a lista de Obras em andamento
function renderObrasList() {
  const list = document.getElementById('obras-list');
  list.innerHTML = '';

  if (state.obras.length === 0) {
    list.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">
        <p>Nenhuma obra em andamento no momento.</p>
        <p style="font-size: 0.85rem; margin-top: 0.5rem;">Vá para a aba Orçamentos e clique em "Iniciar Obra" em um orçamento aprovado.</p>
      </div>
    `;
    return;
  }

  state.obras.forEach(obra => {
    // Busca os dados completos do cliente para os links rápidos
    const cliente = state.clientes.find(c => c.id === obra.clienteId);
    
    // Cálculo financeiro
    const totalCombinado = obra.valorCombinado;
    const entrada = obra.valorEntrada;
    const somaPagamentos = (obra.pagamentos || []).reduce((acc, curr) => acc + curr.valor, 0);
    const totalPago = entrada + somaPagamentos;
    const valorRestante = totalCombinado - totalPago;

    // Formatação de valores
    const fCombinado = totalCombinado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const fEntrada = entrada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const fRestante = valorRestante.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const fTotalPago = totalPago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const dataInicioFmt = obra.dataInicio.split('-').reverse().join('/');
    const dataTerminoFmt = obra.previsaoTermino.split('-').reverse().join('/');

    // Geração dos botões de contato
    let contactButtonsHtml = '';
    if (cliente) {
      const cleanPhone = (cliente.telefone || '').replace(/\D/g, '');
      const whatsappUrl = cleanPhone 
        ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(`Olá ${cliente.nome}, tudo bem? Aqui é a equipe da P.S.O Reformas sobre o andamento da sua obra.`)}` 
        : '#';
      
      const phoneUrl = cliente.telefone ? `tel:${cliente.telefone}` : '#';
      
      const emailSubject = encodeURIComponent(`Status da Obra — P.S.O REFORMAS (${obra.codigoOrcamento})`);
      const emailBody = encodeURIComponent(
`Olá ${cliente.nome},

Estamos entrando em contato para informar os últimos andamentos de sua obra.

---
Atenciosamente,

P.S.O REFORMAS — Soluções Criativas
CNPJ: 39.589.383/0001-10
Telefone: (51) 99398-4535
E-mail: psoreformas@gmail.com
`
      );
      const emailUrl = cliente.email ? `mailto:${cliente.email}?subject=${emailSubject}&body=${emailBody}` : '#';

      contactButtonsHtml = `
        <div class="client-actions">
          ${cliente.telefone ? `<a href="${phoneUrl}" class="btn-contact phone" title="Ligar para o cliente"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> Ligar</a>` : ''}
          ${cleanPhone ? `<a href="${whatsappUrl}" target="_blank" class="btn-contact whatsapp" title="Enviar WhatsApp"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> WhatsApp</a>` : ''}
          ${cliente.email ? `<a href="${emailUrl}" class="btn-contact email" title="Enviar e-mail"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> E-mail</a>` : ''}
        </div>
      `;
    } else {
      contactButtonsHtml = `<div style="font-size:0.8rem; color:var(--text-muted); font-style:italic; margin-top:0.5rem;">Cliente não cadastrado ou excluído</div>`;
    }

    // Renderiza a lista de pagamentos adicionais
    let paymentsListHtml = '';
    if (obra.pagamentos && obra.pagamentos.length > 0) {
      obra.pagamentos.forEach(pag => {
        const fPagValor = pag.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const fPagData = pag.data.split('-').reverse().join('/');
        
        let thumbHtml = `<span class="payment-no-receipt">—</span>`;
        if (pag.comprovante) {
          thumbHtml = `<img class="payment-receipt-thumb" src="${pag.comprovante}" onclick="visualizarComprovante('${pag.comprovante}')" title="Clique para ampliar o comprovante">`;
        }

        paymentsListHtml += `
          <div class="payment-item">
            <span>${fPagData} - <strong>${fPagValor}</strong></span>
            ${thumbHtml}
          </div>
        `;
      });
    } else {
      paymentsListHtml = `<div style="font-size:0.8rem; color:var(--text-muted); font-style:italic; text-align:center; padding: 0.3rem;">Sem pagamentos adicionais</div>`;
    }

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3 class="card-title">${obra.codigoOrcamento}</h3>
      <div class="card-field">
        <span class="card-label">Cliente:</span>
        <span style="font-weight:600;">${obra.clienteNome}</span>
      </div>
      ${contactButtonsHtml}
      
      <div class="card-field" style="margin-top:0.8rem;">
        <span class="card-label">Data de Início:</span>
        <span>${dataInicioFmt}</span>
      </div>
      <div class="card-field">
        <span class="card-label">Previsão Término:</span>
        <span>${dataTerminoFmt}</span>
      </div>

      <div style="margin-top:0.8rem; border-top:1px dashed var(--border-color); padding-top:0.6rem;">
        <div class="card-field">
          <span class="card-label">Valor Combinado:</span>
          <span style="font-weight:600; color:var(--primary-color);">${fCombinado}</span>
        </div>
        <div class="card-field">
          <span class="card-label">Entrada:</span>
          <span>${fEntrada} (${obra.formaEntrada || 'Não informada'})</span>
        </div>
        <div class="card-field">
          <span class="card-label">Total Pago:</span>
          <span style="font-weight:600; color:var(--success-color);">${fTotalPago}</span>
        </div>
        <div class="card-field" style="font-size: 1.05rem; font-weight: 700; color: var(--danger-color);">
          <span class="card-label">Valor Restante:</span>
          <span>${fRestante}</span>
        </div>
      </div>

      <!-- Histórico de Pagamentos -->
      <div class="payments-container">
        <div class="payment-history-title">Pagamentos Parciais/Totais</div>
        <div class="payments-list">
          ${paymentsListHtml}
        </div>
        <button class="btn btn-secondary btn-sm" onclick="abrirModalPagamento('${obra.id}')" style="width:100%; margin-top:0.4rem;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Adicionar Pagamento
        </button>
      </div>

      <div class="card-actions" style="margin-top: 1rem;">
        <button class="btn btn-danger btn-sm" onclick="deleteObraCard('${obra.id}', '${obra.codigoOrcamento}')" style="width: 100%;">Encerrar/Excluir Obra</button>
      </div>
    `;
    list.appendChild(card);
  });
}
