// db.js - Gerenciador de Banco de Dados Local (IndexedDB) para P.S.O REFORMAS

const DB_NAME = 'pso_reformas_db';
const DB_VERSION = 2;

let dbInstance = null;

// Inicializa o banco de dados
function initDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Criar store de clientes se não existir
      if (!db.objectStoreNames.contains('clientes')) {
        db.createObjectStore('clientes', { keyPath: 'id' });
      }
      
      // Criar store de orçamentos se não existir
      if (!db.objectStoreNames.contains('orcamentos')) {
        db.createObjectStore('orcamentos', { keyPath: 'id' });
      }

      // Criar store de obras se não existir
      if (!db.objectStoreNames.contains('obras')) {
        db.createObjectStore('obras', { keyPath: 'id' });
      }
    };

    request.onblocked = () => {
      console.warn('Upgrade do IndexedDB bloqueado por outra aba aberta. Recarregando...');
      window.location.reload();
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('Erro ao abrir IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Métodos genéricos para ler/gravar
async function getStore(storeName, mode = 'readonly') {
  const db = await initDB();
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

// === CLIENTES ===
const dbClientes = {
  async getAll() {
    const store = await getStore('clientes');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async getById(id) {
    const store = await getStore('clientes');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async save(cliente) {
    const store = await getStore('clientes', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(cliente);
      request.onsuccess = () => resolve(cliente);
      request.onerror = () => reject(request.error);
    });
  },

  async delete(id) {
    const store = await getStore('clientes', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async clearAll() {
    const store = await getStore('clientes', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};

// === ORÇAMENTOS ===
const dbOrcamentos = {
  async getAll() {
    const store = await getStore('orcamentos');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async getById(id) {
    const store = await getStore('orcamentos');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async save(orcamento) {
    const store = await getStore('orcamentos', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(orcamento);
      request.onsuccess = () => resolve(orcamento);
      request.onerror = () => reject(request.error);
    });
  },

  async delete(id) {
    const store = await getStore('orcamentos', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async clearAll() {
    const store = await getStore('orcamentos', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};

// === OBRAS ===
const dbObras = {
  async getAll() {
    const store = await getStore('obras');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async getById(id) {
    const store = await getStore('obras');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async save(obra) {
    const store = await getStore('obras', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(obra);
      request.onsuccess = () => resolve(obra);
      request.onerror = () => reject(request.error);
    });
  },

  async delete(id) {
    const store = await getStore('obras', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async clearAll() {
    const store = await getStore('obras', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};

// === CONTROLES DE BACKUP ===

// Dispara o download de um arquivo JSON no navegador
function downloadJsonFile(data, filename) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Exportar backup de clientes
async function exportClientesBackup() {
  const clientes = await dbClientes.getAll();
  downloadJsonFile(clientes, `pso_clientes_backup_${new Date().toISOString().slice(0, 10)}.json`);
}

// Exportar backup de orçamentos (todos)
async function exportOrcamentosBackup() {
  const orcamentos = await dbOrcamentos.getAll();
  downloadJsonFile(orcamentos, `pso_orcamentos_backup_${new Date().toISOString().slice(0, 10)}.json`);
}

// Exportar backup de um único orçamento específico
function exportSingleOrcamentoBackup(orcamento) {
  downloadJsonFile(orcamento, `backup_${orcamento.codigo}.json`);
}

// Importar dados de clientes de um JSON
async function importClientesBackup(jsonData) {
  try {
    const clientes = JSON.parse(jsonData);
    if (!Array.isArray(clientes)) throw new Error('O formato do backup é inválido (deve ser uma lista).');
    
    for (const cli of clientes) {
      if (cli.id && cli.nome) {
        await dbClientes.save(cli);
      }
    }
    return { success: true, count: clientes.length };
  } catch (error) {
    console.error('Erro na importação de clientes:', error);
    return { success: false, error: error.message };
  }
}

// Importar dados de orçamentos de um JSON
async function importOrcamentosBackup(jsonData) {
  try {
    const orcamentos = JSON.parse(jsonData);
    const list = Array.isArray(orcamentos) ? orcamentos : [orcamentos]; // Suporta backup de único orçamento ou lista
    
    let count = 0;
    for (const orc of list) {
      if (orc.id && orc.codigo) {
        await dbOrcamentos.save(orc);
        count++;
      }
    }
    return { success: true, count: count };
  } catch (error) {
    console.error('Erro na importação de orçamentos:', error);
    return { success: false, error: error.message };
  }
}

// Exportar backup geral (todos os clientes, orçamentos e obras em um único arquivo)
async function exportGeralBackup() {
  const clientes = await dbClientes.getAll();
  const orcamentos = await dbOrcamentos.getAll();
  const obras = await dbObras.getAll();
  
  const backupData = {
    version: 2,
    exportedAt: new Date().toISOString(),
    clientes: clientes,
    orcamentos: orcamentos,
    obras: obras
  };
  
  downloadJsonFile(backupData, `pso_backup_geral_${new Date().toISOString().slice(0, 10)}.json`);
}

// Importar backup geral (clientes, orçamentos e obras juntos com compatibilidade retroativa)
async function importGeralBackup(jsonData) {
  try {
    const backup = JSON.parse(jsonData);
    
    // Suporte ao formato legado caso o usuário tente carregar um backup antigo de apenas clientes ou apenas orçamentos (como lista)
    if (Array.isArray(backup)) {
      if (backup.length === 0) {
        return { success: true, clientesCount: 0, orcamentosCount: 0, obrasCount: 0 };
      }
      const first = backup[0];
      if (first.nome) {
        const res = await importClientesBackup(jsonData);
        return { success: res.success, clientesCount: res.count, orcamentosCount: 0, obrasCount: 0, error: res.error };
      } else if (first.codigo) {
        const res = await importOrcamentosBackup(jsonData);
        return { success: res.success, clientesCount: 0, orcamentosCount: res.count, obrasCount: 0, error: res.error };
      }
      throw new Error('Formato de lista desconhecido.');
    }
    
    // Formato de orçamento único legado
    if (backup.clientes === undefined && backup.orcamentos === undefined) {
      if (backup.codigo) {
        const res = await importOrcamentosBackup(JSON.stringify([backup]));
        return { success: res.success, clientesCount: 0, orcamentosCount: res.count, obrasCount: 0, error: res.error };
      }
      throw new Error('Arquivo de backup inválido ou incompatível.');
    }
    
    let clientesCount = 0;
    let orcamentosCount = 0;
    let obrasCount = 0;
    
    if (backup.clientes && Array.isArray(backup.clientes)) {
      for (const cli of backup.clientes) {
        if (cli.id && cli.nome) {
          await dbClientes.save(cli);
          clientesCount++;
        }
      }
    }
    
    if (backup.orcamentos && Array.isArray(backup.orcamentos)) {
      for (const orc of backup.orcamentos) {
        if (orc.id && orc.codigo) {
          await dbOrcamentos.save(orc);
          orcamentosCount++;
        }
      }
    }

    if (backup.obras && Array.isArray(backup.obras)) {
      for (const ob of backup.obras) {
        if (ob.id && ob.orcamentoId) {
          await dbObras.save(ob);
          obrasCount++;
        }
      }
    }
    
    return { success: true, clientesCount, orcamentosCount, obrasCount };
  } catch (error) {
    console.error('Erro na importação do backup geral:', error);
    return { success: false, error: error.message };
  }
}
