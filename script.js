// --- IMPORTAÇÕES CORRETAS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, 
    onSnapshot, writeBatch, getDoc, query, where, getDocs,
    orderBy, limit 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// --- SUAS CONFIGURAÇÕES ---
const firebaseConfig = {
  apiKey: "AIzaSyA5JBf4DcZghGXZWnLYdlMCOBd9As36Czw",
  authDomain: "estoque-ventura-3ddf3.firebaseapp.com",
  projectId: "estoque-ventura-3ddf3",
  storageBucket: "estoque-ventura-3ddf3.firebasestorage.app",
  messagingSenderId: "859531094118",
  appId: "1:859531094118:web:21ebe937b5ed851160a5a7",
  measurementId: "G-7NV7DY9FV6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- ESTADO GLOBAL ---
let itens = [];
let currentUser = null;
let currentLoja = 'estoque_ventura'; 
let unsubscribe = null; 
let unsubscribeUsers = null; // Nova variável pra ouvir os usuários

// EM VEZ DE LER DO LOCALSTORAGE, A GENTE INICIA VAZIO
let users = [];

// --- CARREGAR USUÁRIOS DO FIREBASE (NOVA FUNÇÃO) ---
// Coloca isso logo depois das variáveis globais
const usersRef = collection(db, "usuarios"); // Vai criar uma coleção 'usuarios' lá no banco
unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
    users = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    renderUsers(); // Atualiza a tabela sempre que mudar algo no banco
});
// Faz a busca funcionar em tempo real
document.addEventListener('input', (e) => {
    if (e.target.id === 'inputBusca') {
        const termo = e.target.value.toLowerCase();
        renderizarInterface(termo);
    }
});
// --- 1. FUNÇÃO PARA TROCAR DE LOJA ---
window.trocarLoja = function(novaLoja) {
    // VERIFICAÇÃO DE SEGURANÇA MULTI-ACESSO
    if (currentUser) {
        const acc = currentUser.access;
        // Se não for 'all' E a loja nova não estiver na lista de acessos do cara
        if (acc !== 'all' && (!Array.isArray(acc) || !acc.includes(novaLoja))) {
            return alert("⛔ ACESSO NEGADO: Você não tem permissão nesta loja.");
        }
    }

    currentLoja = novaLoja;
    
    // Atualiza Botões Visuais
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    const btnV = document.getElementById('btn-ventura');
    const btnC = document.getElementById('btn-contento');
    const btnCasa = document.getElementById('btn-casa');
    
    if(novaLoja === 'estoque_casa' && btnCasa) btnCasa.classList.add('active');
    if(novaLoja === 'estoque_ventura' && btnV) btnV.classList.add('active');
    if(novaLoja === 'estoque_contento' && btnC) btnC.classList.add('active');

    // Atualiza Títulos
    const titulos = { 
        'estoque_casa': '📦 ESTOQUE CASA (CENTRAL)',
        'estoque_ventura': '🏠 LOJA VENTURA', 
        'estoque_contento': '🏢 LOJA CONTENTO' 
    };
    const nomeLoja = titulos[novaLoja] || 'ESTOQUE';
    
    const tituloEl = document.getElementById('tituloLoja');
    if(tituloEl) tituloEl.innerHTML = nomeLoja;

    const subTituloEl = document.getElementById('subtituloLoja');
    if(subTituloEl) subTituloEl.innerHTML = `Produtos (${nomeLoja})`;

    // Carrega dados
    if(unsubscribe) unsubscribe();
    const novaRef = collection(db, currentLoja);
    unsubscribe = onSnapshot(novaRef, (snapshot) => {
        itens = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        itens.sort((a,b) => (a.nome || "").localeCompare(b.nome || ""));
        renderizarInterface();
    });
}

// --- 2. LOGIN (VERSÃO COM REFRESH VISUAL FORÇADO) ---
window.fazerLogin = function() {
    const u = document.getElementById('loginUser').value;
    const p = document.getElementById('loginPass').value;
    
    const found = users.find(user => user.user === u && user.pass === p);

    if (found) {
        currentUser = found;
        if(!currentUser.access) currentUser.access = 'all';

        // 1. Libera as telas e a Sidebar
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        
        const side = document.getElementById('sidebarLoja');
        side.style.display = 'flex'; // Força o Flex
        
        document.body.classList.add('logado');

        // 2. Controla o acesso administrativo
        const btnLogs = document.getElementById('btnLogsSide');
        const btnAdmin = document.getElementById('btnAdminSide');
        if(btnLogs) btnLogs.style.display = found.isAdmin ? 'flex' : 'none';
        if(btnAdmin) btnAdmin.style.display = found.isAdmin ? 'flex' : 'none';
        
        // 3. Reseta e libera os botões das Lojas
        const lojas = {
            'btn-ventura': 'estoque_ventura',
            'btn-contento': 'estoque_contento',
            'btn-casa': 'estoque_casa'
        };

        const acc = currentUser.access;

        Object.keys(lojas).forEach(btnId => {
            const btn = document.getElementById(btnId);
            if(btn) {
                const temAcesso = (acc === 'all' || (Array.isArray(acc) && acc.includes(lojas[btnId])));
                btn.style.setProperty('display', temAcesso ? 'flex' : 'none', 'important');
            }
        });

        // 4. TRUQUE DE MESTRE: Força o navegador a recalcular o layout
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
            // Entra na primeira loja disponível
            if (acc === 'all') {
                window.trocarLoja('estoque_ventura');
            } else if (Array.isArray(acc) && acc.length > 0) {
                window.trocarLoja(acc[0]);
            }
        }, 50);

        console.log("🔥 Login e Renderização forçada para:", u);

    } else {
        document.getElementById('loginMsg').innerText = "Usuário ou senha incorretos!";
    }
}
window.fazerLogout = function() { location.reload(); }

// --- 3. ATUALIZAR VALOR (COM TRANSFERÊNCIA E LOGS 🕵️‍♂️) ---
window.atualizarValor = async function(id, campo, valor) {
    // Tratamento do valor (igual antes)
    const valFinal = (campo === 'real' && valor === '') ? '' : (parseInt(valor) || 0);
    const docRef = doc(db, currentLoja, id);

    try {
        // 1. Antes de tudo, vamos buscar os dados do item pra saber o NOME dele
        const docSnap = await getDoc(docRef);
        let nomeProduto = 'Item Desconhecido';
        let dadosAtuais = {};

        if (docSnap.exists()) {
            dadosAtuais = docSnap.data();
            nomeProduto = dadosAtuais.nome || 'Sem Nome';
        }

        // 2. Lógica de Transferência da Casa (Mantivemos a sua lógica original intacta)
        if (currentLoja !== 'estoque_casa' && campo === 'entry') {
            const valorAntigo = dadosAtuais.entry || 0;
            const diferenca = valFinal - valorAntigo;

            if (diferenca !== 0) {
                const q = query(collection(db, "estoque_casa"), where("nome", "==", nomeProduto));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    querySnapshot.forEach(async (docCasa) => {
                        const estoqueAtualCasa = docCasa.data().initial || 0;
                        const novoEstoqueCasa = estoqueAtualCasa - diferenca;
                        await updateDoc(doc(db, "estoque_casa", docCasa.id), { initial: novoEstoqueCasa });
                        
                        if(diferenca > 0) alert(`🚚 ABASTECIMENTO:\nSaiu ${diferenca}x ${nomeProduto} da CASA.`);
                        else alert(`↩️ DEVOLUÇÃO:\nVoltou ${Math.abs(diferenca)}x ${nomeProduto} para a CASA.`);
                        
                        // Opcional: Logar também essa transferência automática
                        registrarLog("Transferência Automática", `Moveu ${diferenca}x ${nomeProduto} da Casa para ${currentLoja}`);
                    });
                }
            }
        }

        // 3. Atualiza o valor no banco (Ação Principal)
        await updateDoc(docRef, { [campo]: valFinal });

        // 4. --- AQUI ENTRA O X-9 (REGISTRA O LOG) --- 🕵️‍♂️
        // Só registra se a função existir (pra não dar erro se tu esqueceu de colar ela)
        if (typeof registrarLog === "function") {
            const msgLog = `${nomeProduto} | Campo: ${campo.toUpperCase()} | Valor: ${valFinal}`;
            registrarLog("Alteração de Saldo", msgLog);
        }

    } catch(e) { 
        console.error("Erro ao atualizar e logar:", e); 
    }
}

// --- 4. SALVAR PRODUTO (CORRIGIDO PARA SALVAR ESTOQUE INICIAL) ---
window.salvarProduto = async function() {
    const id = document.getElementById('m_id').value;
    const nome = document.getElementById('m_nome').value.toUpperCase();
    const cat = document.getElementById('m_categoria').value.toUpperCase() || 'GERAL';
    
    // Captura o valor do campo de Estoque Inicial
    const qtdIni = parseInt(document.getElementById('m_qtd').value) || 0;
    
    const min = parseInt(document.getElementById('m_min').value) || 1;
    const preco = parseFloat(document.getElementById('m_preco').value) || 0;
    
    if (!nome) return alert("Preencha o nome!");
    
    try {
        if (id) {
            // --- MODO EDIÇÃO ---
            // O ERRO TAVA AQUI: Faltava o 'initial: qtdIni' na lista de atualização
            await updateDoc(doc(db, currentLoja, id), { 
                nome, 
                categoria: cat, 
                initial: qtdIni, // <--- ADICIONEI ISSO AQUI!
                min, 
                preco 
            });
            
            // X-9: Registra que editou
            if (typeof registrarLog === "function") {
                registrarLog("Edição de Produto", `Alterou dados de: ${nome} (Estoque definido para ${qtdIni})`);
            }
        } 
        else {
            // --- MODO CRIAÇÃO ---
            await addDoc(collection(db, currentLoja), { 
                nome, categoria: cat, initial: qtdIni, min, preco, 
                entry: 0, sales: 0, internal: 0, voucher: 0, damage: 0, real: '' 
            });
            
            // X-9: Registra que criou novo
            if (typeof registrarLog === "function") {
                registrarLog("Novo Produto", `Criou: ${nome} | Estoque Inicial: ${qtdIni}`);
            }
        }
        window.fecharModal();
    } catch (e) { 
        alert("Erro ao salvar: " + e.message); 
    }
}

// --- 5. DELETAR PRODUTO (COM LOG DE EXCLUSÃO) ---
window.deletarProduto = async function(id) {
    if(!currentUser || !currentUser.canEdit) return alert("Sem permissão!");
    
    if (confirm("Tem certeza que quer apagar esse produto?")) {
        try { 
            // 1. Busca o nome antes de deletar (pra saber quem morreu)
            const docSnap = await getDoc(doc(db, currentLoja, id));
            let nomeItem = "Item Desconhecido";
            if (docSnap.exists()) {
                nomeItem = docSnap.data().nome;
            }

            // 2. Deleta
            await deleteDoc(doc(db, currentLoja, id)); 
            
            // 3. X-9: Registra o óbito
            if (typeof registrarLog === "function") {
                registrarLog("Exclusão", `Apagou o item: ${nomeItem}`);
            }

        } catch (e) { 
            alert("Erro: " + e.message); 
        }
    }
}
import { serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js"; // Adicione isso lá no topo junto com as outras importações se não tiver

// --- 6. FECHAR SEMANA (ATUALIZADA COM SAVE STATE NO HISTÓRICO 💾) ---
window.fecharSemana = async function() {
    if(!currentUser || !currentUser.isAdmin) return alert("Apenas Admin!");
    
    if(!confirm(`⚠️ FECHAR CAIXA?\n\nO sistema vai salvar um BKP desta semana, o estoque REAL vira o INICIAL, e as Entradas/Saídas zeram.\nConfirma?`)) return;

    try {
        const batch = writeBatch(db);
        
        // 1. Prepara a "Foto" (Snapshot) de como o estoque tá agora
        const fotoDoEstoque = itens.map(i => {
            const ini=i.initial||0; const ent=i.entry||0; const sale=i.sales||0; const int=i.internal||0; const vou=i.voucher||0; const dam=i.damage||0;
            const sist = ini + ent - sale - int - vou - dam;
            return {
                nome: i.nome || 'Sem nome',
                categoria: i.categoria || 'GERAL',
                ini, ent, sale, int, vou, dam, sist,
                real: i.real !== undefined ? i.real : ''
            };
        });

        // 2. Salva essa foto na coleção 'historico'
        const docHistoricoRef = doc(collection(db, "historico"));
        batch.set(docHistoricoRef, {
            loja: currentLoja,
            dataFechamento: new Date().toISOString(), // Grava a data exata
            fechadoPor: currentUser.user,
            itens: fotoDoEstoque
        });
        
        // 3. Zera o estoque da semana atual (igual era antes)
        itens.forEach(i => {
            const docRef = doc(db, currentLoja, i.id);
            const ini=i.initial||0; const ent=i.entry||0; const sale=i.sales||0; const int=i.internal||0; const vou=i.voucher||0; const dam=i.damage||0;
            
            let novoInicial = ini + ent - sale - int - vou - dam;
            if (i.real !== '' && i.real !== undefined) novoInicial = parseInt(i.real);
            
            batch.update(docRef, { initial: novoInicial, entry: 0, sales: 0, internal: 0, voucher: 0, damage: 0, real: '' });
        });

        // Executa tudo de uma vez (Salva histórico e zera atual)
        await batch.commit();
        
        if (typeof registrarLog === "function") {
            registrarLog("Fechamento de Caixa", `Gerou Histórico e zerou caixa da semana.`);
        }
        
        alert(`✅ Save State criado e semana fechada com sucesso, mestre!`);
    } catch(e) { 
        alert("Erro: " + e.message); 
    }
}
// --- 6. RENDERIZAÇÃO (ATUALIZADA COM FILTRO DE BUSCA) ---
function renderizarInterface(filtro = "") {
    const isAdmin = currentUser && currentUser.isAdmin;
    const cardValor = document.getElementById('cardValor');
    const cardAlertas = document.getElementById('cardAlertas');
    
    if (cardValor && cardAlertas) {
        if (isAdmin) { cardValor.style.display = 'flex'; cardAlertas.style.display = 'flex'; } 
        else { cardValor.style.display = 'none'; cardAlertas.style.display = 'none'; }
    }

    // Aplica o filtro de busca no nome ou na categoria
    const itensFiltrados = itens.filter(i => 
        (i.nome || "").toLowerCase().includes(filtro.toLowerCase()) || 
        (i.categoria || "").toLowerCase().includes(filtro.toLowerCase())
    );

    document.getElementById('totalItens').innerText = itensFiltrados.length;
    
    const valorTotal = itensFiltrados.reduce((acc, i) => acc + (((i.initial||0)+(i.entry||0)-(i.sales||0)-(i.internal||0)-(i.voucher||0)-(i.damage||0)) * i.preco), 0);
    document.getElementById('valorTotal').innerText = valorTotal.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
    // Conta quantos itens estão com estoque abaixo ou igual ao mínimo
document.getElementById('alertasBaixos').innerText = itensFiltrados.filter(i => {
    const sist = (i.initial||0) + (i.entry||0) - (i.sales||0) - (i.internal||0) - (i.voucher||0) - (i.damage||0);
    return sist <= (i.min || 0);
}).length;

    const tbody = document.querySelector('#tabelaProdutos tbody');
    const thead = document.querySelector('#tabelaProdutos thead tr');
    
    let headerHTML = `<th style="width: 200px;">Produto</th><th class="th-center">INI (+)</th><th class="th-center">ENT (+)</th>`;
    if (isAdmin) { headerHTML += `<th class="th-center">VENDA (-)</th><th class="th-center">CONS (-)</th>`; }
    headerHTML += `<th class="th-center">VALE (-)</th><th class="th-center">AVARIA (-)</th>`;
    if (isAdmin) { headerHTML += `<th class="th-center" style="background:#f0f0f0;">SIST</th>`; }
    headerHTML += `<th class="th-center" style="background:#fffbe6; border:2px solid #f1c40f;">REAL</th>`;
    if (isAdmin) { headerHTML += `<th class="th-center">Status</th>`; }
    headerHTML += `<th class="th-center">Ações</th>`;
    
    thead.innerHTML = headerHTML;
    tbody.innerHTML = '';
    
    if (itensFiltrados.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="15" style="text-align:center; padding:30px; color:#999;">Nenhum produto encontrado.</td></tr>'; 
        return; 
    }

    const grupos = {};
    // Agrupa usando apenas os itens que passaram pelo filtro
    itensFiltrados.forEach(item => { 
        const cat = (item.categoria || 'GERAL').toUpperCase().trim(); 
        if (!grupos[cat]) grupos[cat] = []; 
        grupos[cat].push(item); 
    });

    Object.keys(grupos).sort().forEach(categoria => {
        const colspanTotal = isAdmin ? 11 : 7; 
        tbody.innerHTML += `<tr><td colspan="${colspanTotal}" class="cat-header">📂 ${categoria} <span style="font-size:0.8em; opacity:0.6;">(${grupos[categoria].length})</span></td></tr>`;
        
        // --- DENTRO DA FUNÇÃO renderizarInterface ---
// Procure onde começa o: grupos[categoria].sort(...).forEach(item => {

        grupos[categoria].sort((a,b) => (a.nome||"").localeCompare(b.nome||"")).forEach(item => {
            const ini=item.initial||0; const ent=item.entry||0; const sale=item.sales||0; const int=item.internal||0; const vou=item.voucher||0; const dam=item.damage||0;
            const sist = ini + ent - sale - int - vou - dam;
            
            // --- LOGICA DE ALERTA AQUI ---
            // Verifica se o estoque do sistema está abaixo ou igual ao mínimo definido
            const estoqueAbaixoMinimo = sist <= (item.min || 0);
            const corAlerta = estoqueAbaixoMinimo ? 'color: #e74c3c; font-weight: bold;' : ''; 
            const iconeAlerta = estoqueAbaixoMinimo ? '⚠️ ' : '';
            // -----------------------------

            // --- 🎲 REGRA DO EXPETO: CONFERÊNCIA POR VALOR ABSOLUTO ---
            let statusHtml = '<span style="color:#ccc">-</span>';

            if (item.real !== '' && item.real !== undefined) {
                const valorReal = parseInt(item.real) || 0;
                const sist = (item.initial||0) + (item.entry||0) - (item.sales||0) - (item.internal||0) - (item.voucher||0) - (item.damage||0);
                
                let diff;

                // Se o sistema está negativo, tratamos o real como a correção direta do saldo
                if (sist < 0) {
                    diff = sist + valorReal; 
                } else {
                    diff = valorReal - sist; 
                }

                if (diff === 0) {
                    statusHtml = '<span class="status-ok">✅ OK</span>';
                } else if (diff > 0) {
                    statusHtml = `<span class="status-sobra">⚠️ +${diff}</span>`;
                } else {
                    statusHtml = `<span class="status-falta">❌ ${diff}</span>`; 
                }
            }
            const readonly = (currentUser && currentUser.canEdit) ? '' : 'disabled';
            const acoes = (currentUser && currentUser.canEdit) ? `<button class="btn-action" onclick="window.abrirModal('${item.id}')">✏️</button><button class="btn-action" style="color:red;" onclick="window.deletarProduto('${item.id}')">🗑️</button>` : '🔒';
            
            // Aqui a gente aplica a corAlerta e o iconeAlerta no nome do produto
            let row = `<td style="padding-left:20px; ${corAlerta}"><strong>${iconeAlerta}${item.nome}</strong></td><td class="th-center" style="background:#f9f9f9; font-weight:bold;">${ini}</td><td><input type="number" class="input-cell" value="${ent}" onchange="window.atualizarValor('${item.id}', 'entry', this.value)" ${readonly}></td>`;
            
            if (isAdmin) row += `<td><input type="number" class="input-cell" value="${sale}" onchange="window.atualizarValor('${item.id}', 'sales', this.value)" ${readonly}></td><td><input type="number" class="input-cell" value="${int}" onchange="window.atualizarValor('${item.id}', 'internal', this.value)" ${readonly}></td>`;
            
            row += `<td><input type="number" class="input-cell" value="${vou}" onchange="window.atualizarValor('${item.id}', 'voucher', this.value)" ${readonly}></td><td><input type="number" class="input-cell" value="${dam}" onchange="window.atualizarValor('${item.id}', 'damage', this.value)" ${readonly}></td>`;
            
            if (isAdmin) row += `<td><span class="text-sistema">${sist}</span></td>`;
            
            row += `<td><input type="number" class="input-cell input-real" value="${item.real !== undefined ? item.real : ''}" placeholder="-" onchange="window.atualizarValor('${item.id}', 'real', this.value)" ${readonly}></td>`;
            
            if (isAdmin) row += `<td>${statusHtml}</td>`;
            
            row += `<td class="th-center">${acoes}</td>`;
            
            const tr = document.createElement('tr'); 
            // Se estiver baixo, a gente adiciona uma classe CSS na linha toda também
            if(estoqueAbaixoMinimo) tr.classList.add('estoque-critico');
            
            tr.innerHTML = row; 
            tbody.appendChild(tr);
        });
    });
}

// --- 7. SISTEMA DE USUÁRIOS (AGORA NA NUVEM ☁️) ---
let editingUserId = null; // Agora guarda o ID do Firestore, não o índice

// Helper para pegar checkboxes (esse continua igual)
window.toggleAllAccess = function(source) {
    document.querySelectorAll('.chk-access').forEach(c => c.checked = source.checked);
}

// SALVAR (CRIAR OU EDITAR) NO FIRESTORE
window.salvarUsuario = async function() {
    const u = document.getElementById('new_user').value;
    const p = document.getElementById('new_pass').value;
    
    // Captura os acessos marcados
    let accessList = [];
    const chkAll = document.getElementById('chk_all');
    if (chkAll.checked) {
        accessList = 'all';
    } else {
        document.querySelectorAll('.chk-access:checked').forEach(c => accessList.push(c.value));
    }

    if(!u || !p) return alert("Preencha usuário e senha!");
    if(Array.isArray(accessList) && accessList.length === 0) return alert("Selecione pelo menos uma loja!");

    try {
        if (editingUserId) {
            // EDITAR: Atualiza o doc existente
            await updateDoc(doc(db, "usuarios", editingUserId), { 
                user: u, 
                pass: p, 
                access: accessList 
            });
            alert("✅ Usuário atualizado!");
            window.cancelarEdicaoUser();
        } else {
            // CRIAR: Verifica duplicidade na lista local antes de mandar pro banco
            if(users.find(x => x.user === u)) return alert("Já existe esse usuário!");
            
            await addDoc(collection(db, "usuarios"), { 
                user: u, 
                pass: p, 
                isAdmin: false, 
                canEdit: false, 
                access: accessList 
            });
            alert("✅ Usuário criado!");
            // Limpa campos
            document.getElementById('new_user').value = ''; 
            document.getElementById('new_pass').value = ''; 
        }
    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    }
}

// EDITAR (PREENCHE O FORMULÁRIO COM DADOS DO BANCO)
window.editarUsuario = function(id) {
    const u = users.find(x => x.id === id); // Busca na lista carregada do firebase
    if(!u) return;

    document.getElementById('new_user').value = u.user; 
    document.getElementById('new_pass').value = u.pass; 
    
    // Configura os checkboxes
    const chkAll = document.getElementById('chk_all');
    const checkboxes = document.querySelectorAll('.chk-access');
    
    chkAll.checked = false;
    checkboxes.forEach(c => c.checked = false);

    if (u.access === 'all') {
        chkAll.checked = true;
        checkboxes.forEach(c => c.checked = true);
    } else if (Array.isArray(u.access)) {
        u.access.forEach(loja => {
            const el = document.querySelector(`.chk-access[value="${loja}"]`);
            if(el) el.checked = true;
        });
    }

    editingUserId = id; // Marca que estamos editando esse ID
    document.getElementById('tituloFormUser').innerText = `✏️ Editando: ${u.user}`; 
    document.getElementById('btnSaveUser').innerText = "Salvar"; 
    document.getElementById('btnSaveUser').style.backgroundColor = "#f39c12";
    document.getElementById('btnCancelUser').style.display = "block";
}

// CANCELAR EDIÇÃO
window.cancelarEdicaoUser = function() {
    editingUserId = null; 
    document.getElementById('new_user').value = ''; 
    document.getElementById('new_pass').value = ''; 
    
    document.getElementById('chk_all').checked = false;
    document.querySelectorAll('.chk-access').forEach(c => c.checked = false);

    document.getElementById('tituloFormUser').innerText = "Novo Usuário"; 
    document.getElementById('btnSaveUser').innerText = "Add"; 
    document.getElementById('btnSaveUser').style.backgroundColor = "";
    document.getElementById('btnCancelUser').style.display = "none";
}

// DELETAR (DIRETO NO BANCO)
window.delUser = async function(id) { 
    if(confirm('Apagar usuário permanentemente?')) { 
        try {
            await deleteDoc(doc(db, "usuarios", id));
            if(editingUserId === id) window.cancelarEdicaoUser();
        } catch(e) {
            alert("Erro ao deletar: " + e.message);
        }
    } 
}

// TROCAR PERMISSÃO (ADMIN/EDIT) DIRETO NO BANCO
window.togglePerm = async function(id, campo, valorAtual) { 
    try {
        await updateDoc(doc(db, "usuarios", id), { [campo]: !valorAtual });
    } catch(e) {
        console.error(e);
        alert("Erro ao mudar permissão.");
    }
}

// RENDERIZAR TABELA (AGORA USANDO IDs)
function renderUsers() {
    const tb = document.querySelector('#tabelaUsers tbody'); 
    tb.innerHTML = '';
    
    users.forEach((u) => {
        // Se quiser impedir que vc se delete, verifica pelo nome ou ID
        const isMe = (u.user === 'Expeto'); 
        
        // CUIDADO: As aspas dentro do onclick devem ser simples ' ' para não quebrar a string
        const del = isMe ? '' : `<button onclick="window.delUser('${u.id}')" style="color:red;border:none;background:none;cursor:pointer;font-size:1.1rem">🗑️</button>`;
        const edit = `<button onclick="window.editarUsuario('${u.id}')" style="color:orange;border:none;background:none;cursor:pointer;font-size:1.1rem;margin-right:5px">✏️</button>`;
        
        let displayAccess = '';
        if (u.access === 'all') {
            displayAccess = '<span style="color:blue;font-weight:bold">🌍 TUDO</span>';
        } else if (Array.isArray(u.access)) {
            u.access.forEach(loja => {
                let nome = '';
                if(loja==='estoque_casa') nome='📦 Casa';
                if(loja==='estoque_ventura') nome='🏠 Ventura';
                if(loja==='estoque_contento') nome='🏢 Contento';
                displayAccess += `<span style="background:#eee; padding:2px 6px; border-radius:4px; margin-right:3px; font-size:0.8rem;">${nome}</span>`;
            });
        } else {
             displayAccess = u.access; 
        }

        // Checkboxes passam o ID e o valor atual para o togglePerm
        tb.innerHTML += `
            <tr style="border-bottom:1px solid #eee">
                <td style="padding:10px"><strong>${u.user}</strong></td>
                <td style="padding:10px">${displayAccess}</td>
                <td style="text-align:center">
                    <input type="checkbox" ${u.canEdit?'checked':''} onchange="window.togglePerm('${u.id}', 'canEdit', ${u.canEdit})" ${isMe?'disabled':''}>
                </td>
                <td style="text-align:center">
                    <input type="checkbox" ${u.isAdmin?'checked':''} onchange="window.togglePerm('${u.id}', 'isAdmin', ${u.isAdmin})" ${isMe?'disabled':''}>
                </td>
                <td style="text-align:center">${edit}${del}</td>
            </tr>`;
    });
}
// --- 8. MODAIS ---
const mProd = document.getElementById('modalProduto');
window.abrirModal = function(id) { 
    if(!currentUser?.canEdit) return alert('Sem permissão'); 
    mProd.classList.add('active'); 
    document.getElementById('m_id').value=''; 
    document.querySelectorAll('#modalProduto input').forEach(i=>i.value=''); 
    if(id){ const i=itens.find(x=>x.id==id); document.getElementById('m_id').value=i.id; document.getElementById('m_nome').value=i.nome; document.getElementById('m_categoria').value=i.categoria; document.getElementById('m_qtd').value=i.initial; document.getElementById('m_min').value=i.min; document.getElementById('m_preco').value=i.preco; document.getElementById('modalTitle').innerText = 'Editar Produto'; } else { document.getElementById('modalTitle').innerText = 'Novo Produto'; }
}
window.fecharModal = function() { mProd.classList.remove('active'); }
const mAdm = document.getElementById('modalAdmin');
window.abrirAdmin = function() { mAdm.classList.add('active'); renderUsers(); }
window.fecharAdmin = function() { mAdm.classList.remove('active'); }
// --- 8. MODAIS E AUDITORIA ---
const mRel = document.getElementById('modalRelatorio');

window.verDivergencias = function() { 
    const l = document.getElementById('listaDivergencias'); 
    l.innerHTML = ''; 
    let produtosParaRecontar = [];

    // 1. Identifica quais produtos têm divergência
    itens.forEach(i => { 
        if(i.real !== '' && i.real !== undefined && i.real !== null) { 
            const sist = (i.initial||0) + (i.entry||0) - (i.sales||0) - (i.internal||0) - (i.voucher||0) - (i.damage||0);
            const real = parseInt(i.real);
            
            // Se houver qualquer diferença (positiva ou negativa)
            if(real !== sist) { 
                produtosParaRecontar.push(i.nome);
            } 
        } 
    }); 

    if(produtosParaRecontar.length === 0) {
        l.innerHTML = '<li style="padding:20px; text-align:center; color:#27ae60; font-weight:bold;">✅ Tudo certo! Nenhuma divergência encontrada.</li>'; 
    } else {
        // 2. Prepara a saudação baseada no horário
        const hora = new Date().getHours();
        let saudacao = "Bom dia";
        if (hora >= 12 && hora < 18) saudacao = "Boa tarde";
        if (hora >= 18 || hora < 5) saudacao = "Boa noite";

        // 3. Pega o nome da loja atual formatado
        const nomesLojas = { 
            'estoque_casa': 'Casa (Central)', 
            'estoque_ventura': 'Ventura', 
            'estoque_contento': 'Contento' 
        };
        const nomeDaLoja = nomesLojas[currentLoja] || "Loja";

        // 4. Monta a lista visual no modal usando as novas classes CSS
        let listaHTML = `<div class="relatorio-container">`;
        listaHTML += `<div class="relatorio-header">
                        <p><strong>${saudacao},</strong></p>
                        <p>Preciso que os gerentes da loja <strong>${nomeDaLoja}</strong> recontem os seguintes produtos:</p>
                      </div>`;
        
        listaHTML += `<ul class="lista-recontagem">`;
        produtosParaRecontar.forEach(prod => {
            listaHTML += `<li><i class='bx bx-check-double' style='color:#3498db'></i> ${prod}</li>`;
        });
        listaHTML += `</ul></div>`;
        
        // Botão rápido para copiar o texto (opcional, mas ajuda muito!)
        listaHTML += `
            <button onclick="window.copiarRelatorio()" style="margin-top:15px; width:100%; background:#3498db; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer; font-weight:bold;">
                📋 Copiar para WhatsApp
            </button>`;

        l.innerHTML = listaHTML;

        // Função extra para copiar o texto direto
        window.copiarRelatorio = () => {
            const texto = `${saudacao},\n\nPreciso que os gerentes da loja ${nomeDaLoja} recontem os seguintes produtos:\n\n${produtosParaRecontar.map(p => `• ${p}`).join('\n')}`;
            navigator.clipboard.writeText(texto);
            alert("Relatório copiado para a área de transferência! 👍");
        };
    }
    
    document.getElementById('modalRelatorio').classList.add('active'); 
}
window.fecharRelatorio = function() { mRel.classList.remove('active'); }

// --- FUNÇÃO X-9 (REGISTRAR LOG) ---
async function registrarLog(acao, detalhes) {
    if (!currentUser) return; // Se não tem ninguém logado, não registra (ou registra como Anônimo)
    
    const logData = {
        data: new Date().toISOString(), // Data e hora exata
        usuario: currentUser.user,      // Quem fez (Expeto, Gomes...)
        loja: currentLoja,              // Onde (Ventura, Contento...)
        acao: acao,                     // Ex: "Alterou Estoque", "Fechou Semana"
        detalhes: detalhes              // Ex: "Heineken: 10 -> 12"
    };

    try {
        // Salva numa coleção separada chamada 'logs'
        await addDoc(collection(db, "logs"), logData);
        console.log("📝 Log registrado:", detalhes);
    } catch (e) {
        console.error("Erro ao gravar log:", e);
    }
}

// --- 9. SISTEMA DE VISUALIZAÇÃO DE LOGS ---
const mLogs = document.getElementById('modalLogs');

window.abrirLogs = async function() {
    if(!currentUser || !currentUser.isAdmin) return alert("Você não tem Nível de Acesso suficiente! 🚫");
    
    mLogs.classList.add('active');
    const lista = document.getElementById('listaLogs');
    const loading = document.getElementById('loadingLogs');
    
    lista.innerHTML = '';
    loading.style.display = 'block';

    try {
        // Busca os últimos 50 logs ordenados por data (mais recente primeiro)
        const q = query(
            collection(db, "logs"), 
            orderBy("data", "desc"), 
            limit(50)
        );
        
        const querySnapshot = await getDocs(q);
        loading.style.display = 'none';

        if (querySnapshot.empty) {
            lista.innerHTML = '<li style="text-align:center; color:#999;">Nenhum registro encontrado. O silêncio reina. 🦗</li>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const d = doc.data();
            // Formata a data pra ficar bonitinha (pt-BR)
            const dataObj = new Date(d.data);
            const dataFormatada = dataObj.toLocaleString('pt-BR');

            // Define cor baseada na ação
            let corIcone = '#95a5a6';
            let icone = 'bx-circle';
            
            if(d.acao.includes('Alteração')) { corIcone = '#3498db'; icone = 'bx-edit'; }
            if(d.acao.includes('Novo')) { corIcone = '#2ecc71'; icone = 'bx-plus-circle'; }
            if(d.acao.includes('Exclusão')) { corIcone = '#e74c3c'; icone = 'bx-trash'; }
            if(d.acao.includes('Fechamento')) { corIcone = '#9b59b6'; icone = 'bx-calendar-check'; }

            const html = `
                <li style="border-bottom:1px solid #eee; padding:10px 0; display:flex; gap:10px;">
                    <div style="font-size:1.5rem; color:${corIcone}; display:flex; align-items:center;">
                        <i class='bx ${icone}'></i>
                    </div>
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:#666; margin-bottom:2px;">
                            <strong>👤 ${d.usuario}</strong>
                            <span>${dataFormatada}</span>
                        </div>
                        <div style="font-weight:bold; color:#333;">${d.acao} <span style="font-weight:normal; font-size:0.8rem; background:#f0f0f0; padding:2px 6px; border-radius:4px;">${d.loja}</span></div>
                        <div style="font-size:0.9rem; color:#555; margin-top:2px;">${d.detalhes}</div>
                    </div>
                </li>
            `;
            lista.innerHTML += html;
        });

    } catch (e) {
        console.error(e);
        loading.innerHTML = `<span style="color:red">Erro ao carregar logs: ${e.message}</span>`;
        // DICA: Se der erro de índice no console, o Firebase vai mandar um link. Clica nele pra criar o índice automático!
    }
}

window.fecharLogs = function() {
    mLogs.classList.remove('active');
}
// --- ESCUTADOR DA BUSCA ---
document.addEventListener('input', (e) => {
    if (e.target.id === 'inputBusca') {
        const termo = e.target.value.toLowerCase();
        renderizarInterface(termo); // Chama a renderização passando o que você digitou
    }
});
// --- SISTEMA DE ENTRADA EM LOTE (MODO RÁPIDO) ---
const mLote = document.getElementById('modalLote');

// 1. Função para abrir a janela e listar as categorias
window.abrirEntradaRapida = function() {
    if(!currentUser?.canEdit) return alert('Sem permissão para realizar movimentações!');
    
    // Puxa todas as categorias existentes e tira as duplicadas
    const categorias = [...new Set(itens.map(i => (i.categoria || 'GERAL').toUpperCase().trim()))].sort();
    
    // Preenche a caixa de seleção de categorias
    const selectCat = document.getElementById('lote_categoria');
    selectCat.innerHTML = `<option value="TODAS">🌟 TODAS AS CATEGORIAS</option>`;
    categorias.forEach(cat => {
        selectCat.innerHTML += `<option value="${cat}">📂 ${cat}</option>`;
    });

    // Renderiza a lista inicial
    window.renderizarItensLote();
    mLote.classList.add('active');
}

// NOVO: Função que desenha a tabela baseada na categoria escolhida
window.renderizarItensLote = function() {
    const catSelecionada = document.getElementById('lote_categoria').value;
    const tbody = document.querySelector('#tabelaLote tbody');
    tbody.innerHTML = '';

    // Filtra: Mostra tudo ou só a categoria escolhida
    const itensFiltrados = catSelecionada === "TODAS" 
        ? itens 
        : itens.filter(i => (i.categoria || 'GERAL').toUpperCase().trim() === catSelecionada);

    // Escreve na tabela
    itensFiltrados.sort((a,b) => (a.nome||"").localeCompare(b.nome||"")).forEach(item => {
        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px;">
                    <strong>${item.nome}</strong><br>
                    <span style="font-size:0.75rem; color:#888;">${item.categoria || 'GERAL'}</span>
                </td>
                <td style="padding: 10px;">
                    <input type="number" class="input-cell lote-input" 
                           data-id="${item.id}" data-nome="${item.nome}"
                           placeholder="0" min="0" 
                           style="border: 2px solid #4070f4; background: #f0f7ff; font-weight:bold;">
                </td>
            </tr>
        `;
    });
}

// 2. Função para fechar a janela
window.fecharLote = () => {
    mLote.classList.remove('active');
}

window.processarLote = async function() {
    const tipo = document.getElementById('lote_tipo').value;
    const inputs = document.querySelectorAll('.lote-input');
    const batch = writeBatch(db); // Prepara o pacote de atualizações
    let alterados = 0;

    try {
        // Precisamos usar um loop for...of para conseguir usar await dentro
        for (let input of inputs) {
            const qtdMovimentada = parseInt(input.value);
            
            // Só processa se o valor for maior que zero
            if (qtdMovimentada > 0) {
                const id = input.dataset.id;
                const nome = input.dataset.nome;
                const docRef = doc(db, currentLoja, id);
                
                // 1. Pega o item local para atualizar o saldo da loja atual
                const itemAtual = itens.find(i => i.id === id);
                const valorAntigo = itemAtual[tipo] || 0;
                const novoValor = valorAntigo + qtdMovimentada;

                // Adiciona a atualização da loja atual no batch
                batch.update(docRef, { [tipo]: novoValor });

                // 2. LÓGICA DE INTEGRAÇÃO COM A CASA (Apenas para ENTRADAS)
                // Se não estivermos na loja casa e o movimento for 'entry' (Entrada)
                if (currentLoja !== 'estoque_casa' && tipo === 'entry') {
                    const casaRef = collection(db, "estoque_casa");
                    const q = query(casaRef, where("nome", "==", nome));
                    const querySnapshot = await getDocs(q);

                    if (!querySnapshot.empty) {
                        querySnapshot.forEach((docCasa) => {
                            const estoqueAtualCasa = docCasa.data().initial || 0;
                            const novoEstoqueCasa = estoqueAtualCasa - qtdMovimentada;
                            
                            // Adiciona o abatimento da Central no mesmo pacote
                            batch.update(doc(db, "estoque_casa", docCasa.id), { 
                                initial: novoEstoqueCasa 
                            });
                        });
                    }
                }
                
                // Registra o log da operação
                registrarLog("Entrada em Lote", `${nome}: +${qtdMovimentada} em ${tipo.toUpperCase()}`);
                alterados++;
            }
        }

        if (alterados === 0) return alert("Nenhuma quantidade preenchida!");

        // Envia todas as alterações (Loja atual + Abatimentos na Casa) de uma vez só
        await batch.commit();
        
        alert(`✅ Sucesso! ${alterados} itens atualizados e abatidos da Central.`);
        window.fecharLote();
        
    } catch (e) {
        console.error("Erro no processamento em lote:", e);
        alert("Erro ao processar lote: " + e.message);
    }
}
// --- SISTEMA DE IMPRESSÃO DE FALTANTES (RESUMO COMPLETO) 🧙‍♂️ ---
window.imprimirFaltantes = function() {
    const isAdmin = currentUser && currentUser.isAdmin;

    // Filtra SÓ os itens que tiveram contagem REAL e deram diferença NEGATIVA
    const itensFaltantes = itens.filter(item => {
        if (item.real === '' || item.real === undefined) return false;

        const sist = (item.initial||0) + (item.entry||0) - (item.sales||0) - (item.internal||0) - (item.voucher||0) - (item.damage||0);
        const valorReal = parseInt(item.real) || 0;
        let diff = (sist < 0) ? (sist + valorReal) : (valorReal - sist);

        return diff < 0;
    });

    if(itensFaltantes.length === 0) {
        return alert("Tá tranquilo, mestre! Nenhuma FALTA detectada para imprimir. 🍻");
    }

    const nomesLojas = { 
        'estoque_casa': 'Casa (Central)', 
        'estoque_ventura': 'Ventura', 
        'estoque_contento': 'Contento' 
    };
    const nomeDaLoja = nomesLojas[currentLoja] || "Loja";

    let html = `
        <html>
        <head>
            <title>Relatório de Quebras - ${nomeDaLoja}</title>
            <style>
                body { font-family: 'Poppins', Arial, sans-serif; padding: 20px; color: #333; }
                h2 { color: #e74c3c; border-bottom: 2px solid #e74c3c; padding-bottom: 10px; margin-bottom: 5px;}
                .header-info { margin-bottom: 20px; font-size: 0.9rem; color: #666; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.85rem; }
                th, td { border: 1px solid #ccc; padding: 8px; text-align: center; }
                th { background-color: #f2f2f2; font-weight: bold; text-transform: uppercase; }
                .text-left { text-align: left; }
                .critico { color: #e74c3c; font-weight: bold; background: #fff5f5; }
                .col-destaque { background: #f9f9f9; font-weight: bold; }
                @media print { @page { margin: 1cm; } }
            </style>
        </head>
        <body>
            <h2>🚨 Relatório de Quebras e Movimentação</h2>
            <div class="header-info">
                <strong>Loja:</strong> ${nomeDaLoja} | 
                <strong>Data:</strong> ${new Date().toLocaleString('pt-BR')} | 
                <strong>Responsável:</strong> ${currentUser.user}
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th class="text-left">Produto</th>
                        <th>INI</th>
                        <th>ENT</th>
                        ${isAdmin ? '<th>VEND</th><th>CONS</th>' : ''}
                        <th>VALE</th>
                        <th>AVAR</th>
                        <th class="col-destaque">SIST</th>
                        <th class="col-destaque">REAL</th>
                        <th class="critico">FALTA</th>
                    </tr>
                </thead>
                <tbody>
    `;

    itensFaltantes.sort((a,b) => (a.nome||"").localeCompare(b.nome||"")).forEach(item => {
        const ini=item.initial||0; const ent=item.entry||0; const sale=item.sales||0; 
        const int=item.internal||0; const vou=item.voucher||0; const dam=item.damage||0;
        const sist = ini + ent - sale - int - vou - dam;
        const valorReal = parseInt(item.real) || 0;
        let diff = (sist < 0) ? (sist + valorReal) : (valorReal - sist);

        html += `
            <tr>
                <td class="text-left"><strong>${item.nome}</strong></td>
                <td>${ini}</td>
                <td>${ent}</td>
                ${isAdmin ? `<td>${sale}</td><td>${int}</td>` : ''}
                <td>${vou}</td>
                <td>${dam}</td>
                <td class="col-destaque">${sist}</td>
                <td class="col-destaque">${valorReal}</td>
                <td class="critico">${diff}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
            <div style="margin-top: 30px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 0.8rem; text-align: center;">
                Documento gerado pelo Sistema de Gestão Ventura.
            </div>
            <script>
                window.onload = function() { 
                    setTimeout(() => { window.print(); window.close(); }, 300);
                }
            </script>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
}
// --- SISTEMA DE HISTÓRICO (SOMENTE LEITURA 🕰️) ---

window.fecharListaHistorico = () => document.getElementById('modalListaHistorico').classList.remove('active');
window.fecharVerHistorico = () => document.getElementById('modalVerHistorico').classList.remove('active');

let historicosCarregados = []; // Variável pra guardar o array de BKP

window.abrirHistorico = async function() {
    document.getElementById('modalListaHistorico').classList.add('active');
    const lista = document.getElementById('listaSemanasAntigas');
    const loading = document.getElementById('loadingHistorico');
    
    lista.innerHTML = '';
    loading.style.display = 'block';

    try {
        // Busca os históricos SÓ da loja atual, do mais novo pro mais antigo
        const q = query(
            collection(db, "historico"), 
            where("loja", "==", currentLoja),
            orderBy("dataFechamento", "desc"),
            limit(10) // Puxa os últimos 10 fechamentos
        );
        
        const querySnapshot = await getDocs(q);
        loading.style.display = 'none';

        if (querySnapshot.empty) {
            lista.innerHTML = '<li style="text-align:center; padding:15px; color:#999;">Nenhum fechamento passado registrado pra essa taverna ainda. 🏜️</li>';
            return;
        }

        historicosCarregados = [];
        
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            data.id = docSnap.id;
            historicosCarregados.push(data);
            
            const dataFormatada = new Date(data.dataFechamento).toLocaleString('pt-BR');
            
            lista.innerHTML += `
                <li style="border-bottom:1px solid #eee; padding:10px 0; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>🗓️ ${dataFormatada}</strong><br>
                        <span style="font-size:0.8rem; color:#888;">Fechado por: ${data.fechadoPor}</span>
                    </div>
                    <button onclick="window.visualizarSemanaDetalhe('${data.id}')" style="background:#3498db; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">Ver</button>
                </li>
            `;
        });

    } catch(e) {
        console.error(e);
        loading.innerHTML = `<span style="color:red">Erro: Lembre de criar o Índice no Firebase se ele pedir no Console F12!</span>`;
    }
}

window.visualizarSemanaDetalhe = function(idHistorico) {
    const BKP = historicosCarregados.find(h => h.id === idHistorico);
    if(!BKP) return;

    const dataFormatada = new Date(BKP.dataFechamento).toLocaleString('pt-BR');
    document.getElementById('tituloSemanaAntiga').innerText = `📅 Fechamento: ${dataFormatada}`;
    
    const tbody = document.getElementById('tabelaSemanaAntiga');
    tbody.innerHTML = '';

    // Organiza por ordem alfabética antes de mostrar
    BKP.itens.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(item => {
        const totalSaidas = (item.sale||0) + (item.int||0) + (item.vou||0) + (item.dam||0);
        
        tbody.innerHTML += `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px;"><strong>${item.nome}</strong><br><span style="font-size:0.75rem;color:#888;">${item.categoria}</span></td>
                <td style="padding:10px; text-align:center;">${item.ini}</td>
                <td style="padding:10px; text-align:center; color:#2ecc71;">+${item.ent}</td>
                <td style="padding:10px; text-align:center; color:#e74c3c;">-${totalSaidas}</td>
                <td style="padding:10px; text-align:center; font-weight:bold; background:#f0f0f0;">${item.sist}</td>
                <td style="padding:10px; text-align:center; font-weight:bold; color:#f39c12;">${item.real !== '' ? item.real : '-'}</td>
            </tr>
        `;
    });

    // Esconde a lista e mostra os detalhes
    window.fecharListaHistorico();
    document.getElementById('modalVerHistorico').classList.add('active');
}