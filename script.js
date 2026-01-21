// --- IMPORTAÇÕES DO FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, 
    onSnapshot, writeBatch, getDoc, query, where, getDocs 
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

// Usuários (Local Storage)
let users = JSON.parse(localStorage.getItem('estoquePro_users')) || [
    { user: 'Expeto', pass: '1511', isAdmin: true, canEdit: true, access: 'all' }
];

// --- 1. FUNÇÃO PARA TROCAR DE LOJA ---
window.trocarLoja = function(novaLoja) {
    if (currentUser && currentUser.access !== 'all' && currentUser.access !== novaLoja) {
        return alert("⛔ ACESSO NEGADO: Você não tem permissão para esta área.");
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

// --- 2. LOGIN (COM PERMISSÕES) ---
window.fazerLogin = function() {
    const u = document.getElementById('loginUser').value;
    const p = document.getElementById('loginPass').value;
    const found = users.find(user => user.user === u && user.pass === p);

    if (found) {
        currentUser = found;
        if(!currentUser.access) currentUser.access = 'all';

        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        document.getElementById('sidebarLoja').style.display = 'flex';
        document.body.classList.add('logado');

        const btnAdm = document.getElementById('btnAdminSide');
        if(btnAdm) btnAdm.style.display = found.isAdmin ? 'flex' : 'none';
        
        // Filtro de Botões da Sidebar
        const btnV = document.getElementById('btn-ventura');
        const btnC = document.getElementById('btn-contento');
        const btnCasa = document.getElementById('btn-casa');

        // Reset
        if(btnV) btnV.style.display = 'flex'; 
        if(btnC) btnC.style.display = 'flex'; 
        if(btnCasa) btnCasa.style.display = 'flex';

        // Lógica de Redirecionamento
        if (currentUser.access === 'all') {
            window.trocarLoja('estoque_ventura');
        } else {
            // Esconde os outros
            if(currentUser.access !== 'estoque_ventura' && btnV) btnV.style.display = 'none';
            if(currentUser.access !== 'estoque_contento' && btnC) btnC.style.display = 'none';
            if(currentUser.access !== 'estoque_casa' && btnCasa) btnCasa.style.display = 'none';
            
            window.trocarLoja(currentUser.access);
        }
    } else {
        document.getElementById('loginMsg').innerText = "Senha incorreta!";
    }
}
window.fazerLogout = function() { location.reload(); }

// --- 3. ATUALIZAR VALOR (COM TRANSFERÊNCIA RELATIVA DA CASA) ---
window.atualizarValor = async function(id, campo, valor) {
    const valFinal = (campo === 'real' && valor === '') ? '' : (parseInt(valor) || 0);
    const docRef = doc(db, currentLoja, id);
    
    try {
        // LÓGICA DE TRANSFERÊNCIA INTELIGENTE
        // Se NÃO for a Casa e for alteração na ENTRADA
        if (currentLoja !== 'estoque_casa' && campo === 'entry') {
            
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const dadosAtuais = docSnap.data();
                const valorAntigo = dadosAtuais.entry || 0;
                
                // Calcula a DIFERENÇA (Pode ser positiva ou negativa)
                // Ex 1: Era 0, virou 50. Diferença = 50 (Sai 50 da Casa)
                // Ex 2: Era 50, virou 0. Diferença = -50 (Volta 50 pra Casa)
                const diferenca = valFinal - valorAntigo;
                const nomeProduto = dadosAtuais.nome;

                // Se houve qualquer mudança (pra mais ou pra menos)
                if (diferenca !== 0) {
                    // Busca na CASA pelo nome exato
                    const q = query(collection(db, "estoque_casa"), where("nome", "==", nomeProduto));
                    const querySnapshot = await getDocs(q);

                    if (!querySnapshot.empty) {
                        querySnapshot.forEach(async (docCasa) => {
                            const estoqueAtualCasa = docCasa.data().initial || 0;
                            // A fórmula mágica: EstoqueCasa - Diferença
                            // Se dif for 50: Estoque - 50
                            // Se dif for -50: Estoque - (-50) = Estoque + 50
                            const novoEstoqueCasa = estoqueAtualCasa - diferenca;
                            
                            await updateDoc(doc(db, "estoque_casa", docCasa.id), {
                                initial: novoEstoqueCasa
                            });
                            
                            // Mensagem Inteligente
                            if(diferenca > 0) {
                                alert(`🚚 ABASTECIMENTO:\nSaiu ${diferenca}x ${nomeProduto} do estoque da CASA.`);
                            } else {
                                alert(`↩️ DEVOLUÇÃO:\nVoltou ${Math.abs(diferenca)}x ${nomeProduto} para o estoque da CASA.`);
                            }
                        });
                    } else {
                        // Opcional: Avisar se não achou na casa (pode comentar se achar chato)
                        console.log(`Produto ${nomeProduto} não encontrado na Casa para dar baixa.`);
                    }
                }
            }
        }

        // Atualiza a loja atual
        await updateDoc(docRef, { [campo]: valFinal });

    } catch(e) { console.error(e); }
}

// --- 4. SALVAR/CRIAR ---
window.salvarProduto = async function() {
    const id = document.getElementById('m_id').value;
    const nome = document.getElementById('m_nome').value.toUpperCase();
    const cat = document.getElementById('m_categoria').value.toUpperCase() || 'GERAL';
    const qtdIni = parseInt(document.getElementById('m_qtd').value) || 0;
    const min = parseInt(document.getElementById('m_min').value) || 1;
    const preco = parseFloat(document.getElementById('m_preco').value) || 0;

    if (!nome) return alert("Preencha o nome!");

    try {
        if (id) {
            await updateDoc(doc(db, currentLoja, id), { nome, categoria: cat, min, preco });
        } else {
            await addDoc(collection(db, currentLoja), {
                nome, categoria: cat, initial: qtdIni, min, preco,
                entry: 0, sales: 0, internal: 0, voucher: 0, damage: 0, real: ''
            });
        }
        window.fecharModal();
    } catch (e) { alert("Erro ao salvar: " + e.message); }
}

// --- 5. DELETAR E FECHAR SEMANA ---
window.deletarProduto = async function(id) {
    if(!currentUser || !currentUser.canEdit) return alert("Sem permissão!");
    if (confirm("Apagar produto desta loja?")) {
        try { await deleteDoc(doc(db, currentLoja, id)); } catch (e) { alert("Erro: " + e.message); }
    }
}

window.fecharSemana = async function() {
    if(!currentUser || !currentUser.isAdmin) return alert("Apenas Admin!");
    
    let nomeLoja = 'DESCONHECIDA';
    if(currentLoja === 'estoque_ventura') nomeLoja = 'VENTURA';
    if(currentLoja === 'estoque_contento') nomeLoja = 'CONTENTO';
    if(currentLoja === 'estoque_casa') nomeLoja = 'CASA (CENTRAL)';

    if(!confirm(`⚠️ FECHAR CAIXA DA ${nomeLoja}?\n\nO estoque REAL vira o INICIAL.\nEntradas/Saídas zeram.\nConfirma?`)) return;

    try {
        const batch = writeBatch(db);
        itens.forEach(i => {
            const docRef = doc(db, currentLoja, i.id);
            const ini=i.initial||0; const ent=i.entry||0; const sale=i.sales||0;
            const int=i.internal||0; const vou=i.voucher||0; const dam=i.damage||0;
            
            let novoInicial = ini + ent - sale - int - vou - dam;
            if (i.real !== '' && i.real !== undefined) novoInicial = parseInt(i.real);

            batch.update(docRef, { initial: novoInicial, entry: 0, sales: 0, internal: 0, voucher: 0, damage: 0, real: '' });
        });
        await batch.commit();
        alert(`✅ Semana da ${nomeLoja} fechada!`);
    } catch(e) { alert("Erro: " + e.message); }
}

// --- 6. RENDERIZAÇÃO (AUDITORIA CEGA + CATEGORIAS) ---
function renderizarInterface() {
    const isAdmin = currentUser && currentUser.isAdmin;

    // Visibilidade dos Cards
    const cardValor = document.getElementById('cardValor');
    const cardAlertas = document.getElementById('cardAlertas');
    if (cardValor && cardAlertas) {
        if (isAdmin) { cardValor.style.display = 'flex'; cardAlertas.style.display = 'flex'; } 
        else { cardValor.style.display = 'none'; cardAlertas.style.display = 'none'; }
    }

    // Totais
    document.getElementById('totalItens').innerText = itens.length;
    const valorTotal = itens.reduce((acc, i) => acc + (((i.initial||0)+(i.entry||0)-(i.sales||0)-(i.internal||0)-(i.voucher||0)-(i.damage||0)) * i.preco), 0);
    document.getElementById('valorTotal').innerText = valorTotal.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
    document.getElementById('alertasBaixos').innerText = itens.filter(i => ((i.initial||0)+(i.entry||0)-(i.sales||0)-(i.internal||0)-(i.voucher||0)-(i.damage||0)) <= i.min).length;

    // Tabela
    const tbody = document.querySelector('#tabelaProdutos tbody');
    const thead = document.querySelector('#tabelaProdutos thead tr');
    
    // Cabeçalho Dinâmico (Auditoria Cega)
    let headerHTML = `<th style="width: 200px;">Produto</th><th class="th-center">INI (+)</th><th class="th-center">ENT (+)</th>`;
    if (isAdmin) { headerHTML += `<th class="th-center">VENDA (-)</th><th class="th-center">CONS (-)</th>`; }
    headerHTML += `<th class="th-center">VALE (-)</th><th class="th-center">AVARIA (-)</th>`;
    if (isAdmin) { headerHTML += `<th class="th-center" style="background:#f0f0f0;">SIST</th>`; }
    headerHTML += `<th class="th-center" style="background:#fffbe6; border:2px solid #f1c40f;">REAL</th>`;
    if (isAdmin) { headerHTML += `<th class="th-center">Status</th>`; }
    headerHTML += `<th class="th-center">Ações</th>`;
    thead.innerHTML = headerHTML;

    tbody.innerHTML = '';
    if (itens.length === 0) { tbody.innerHTML = '<tr><td colspan="15" style="text-align:center; padding:30px; color:#999;">Nada aqui.</td></tr>'; return; }

    // Agrupamento por Categoria
    const grupos = {};
    itens.forEach(item => {
        const cat = (item.categoria || 'GERAL').toUpperCase().trim();
        if (!grupos[cat]) grupos[cat] = [];
        grupos[cat].push(item);
    });

    Object.keys(grupos).sort().forEach(categoria => {
        const colspanTotal = isAdmin ? 11 : 7; 
        tbody.innerHTML += `<tr><td colspan="${colspanTotal}" class="cat-header">📂 ${categoria} <span style="font-size:0.8em; opacity:0.6;">(${grupos[categoria].length})</span></td></tr>`;

        grupos[categoria].sort((a,b) => (a.nome||"").localeCompare(b.nome||"")).forEach(item => {
            const ini=item.initial||0; const ent=item.entry||0; const sale=item.sales||0;
            const int=item.internal||0; const vou=item.voucher||0; const dam=item.damage||0;
            const sist = ini + ent - sale - int - vou - dam;
            
            let statusHtml = '<span style="color:#ccc">-</span>';
            if (item.real !== '' && item.real !== undefined) {
                const diff = parseInt(item.real) - sist;
                if (diff === 0) statusHtml = '<span class="status-ok">✅ OK</span>';
                else if (diff > 0) statusHtml = `<span class="status-sobra">⚠️ +${diff}</span>`;
                else statusHtml = `<span class="status-falta">❌ -${Math.abs(diff)}</span>`;
            }

            const readonly = (currentUser && currentUser.canEdit) ? '' : 'disabled';
            const acoes = (currentUser && currentUser.canEdit) 
                ? `<button class="btn-action" onclick="window.abrirModal('${item.id}')">✏️</button><button class="btn-action" style="color:red;" onclick="window.deletarProduto('${item.id}')">🗑️</button>` : '🔒';

            let row = `<td style="padding-left:20px;"><strong>${item.nome}</strong></td>
                       <td class="th-center" style="background:#f9f9f9; font-weight:bold;">${ini}</td>
                       <td><input type="number" class="input-cell" value="${ent}" onchange="window.atualizarValor('${item.id}', 'entry', this.value)" ${readonly}></td>`;
            if (isAdmin) row += `<td><input type="number" class="input-cell" value="${sale}" onchange="window.atualizarValor('${item.id}', 'sales', this.value)" ${readonly}></td>
                                 <td><input type="number" class="input-cell" value="${int}" onchange="window.atualizarValor('${item.id}', 'internal', this.value)" ${readonly}></td>`;
            row += `<td><input type="number" class="input-cell" value="${vou}" onchange="window.atualizarValor('${item.id}', 'voucher', this.value)" ${readonly}></td>
                    <td><input type="number" class="input-cell" value="${dam}" onchange="window.atualizarValor('${item.id}', 'damage', this.value)" ${readonly}></td>`;
            if (isAdmin) row += `<td><span class="text-sistema">${sist}</span></td>`;
            row += `<td><input type="number" class="input-cell input-real" value="${item.real !== undefined ? item.real : ''}" placeholder="-" onchange="window.atualizarValor('${item.id}', 'real', this.value)" ${readonly}></td>`;
            if (isAdmin) row += `<td>${statusHtml}</td>`;
            row += `<td class="th-center">${acoes}</td>`;

            const tr = document.createElement('tr'); tr.innerHTML = row; tbody.appendChild(tr);
        });
    });
}

// --- 7. SISTEMA DE USUÁRIOS ---
let editingUserIdx = null;

window.salvarUsuario = function() {
    const u = document.getElementById('new_user').value;
    const p = document.getElementById('new_pass').value;
    const access = document.getElementById('new_access').value;

    if(!u || !p) return alert("Preencha tudo!");

    if (editingUserIdx !== null) {
        users[editingUserIdx] = { ...users[editingUserIdx], user:u, pass:p, access:access };
        alert("✅ Atualizado!");
        window.cancelarEdicaoUser();
    } else {
        if(users.find(x => x.user === u)) return alert("Já existe!");
        users.push({ user:u, pass:p, isAdmin:false, canEdit:false, access:access });
        alert("✅ Criado!");
    }
    localStorage.setItem('estoquePro_users', JSON.stringify(users));
    renderUsers();
    if (editingUserIdx === null) { document.getElementById('new_user').value = ''; document.getElementById('new_pass').value = ''; }
}

window.editarUsuario = function(i) {
    const u = users[i]; 
    document.getElementById('new_user').value = u.user; 
    document.getElementById('new_pass').value = u.pass; 
    document.getElementById('new_access').value = u.access||'all';
    editingUserIdx = i; 
    document.getElementById('tituloFormUser').innerText = `✏️ Editando: ${u.user}`; 
    document.getElementById('tituloFormUser').style.color = "#f39c12";
    document.getElementById('btnSaveUser').innerText = "Salvar"; 
    document.getElementById('btnSaveUser').style.backgroundColor = "#f39c12";
    document.getElementById('btnCancelUser').style.display = "block";
}

window.cancelarEdicaoUser = function() {
    editingUserIdx = null; 
    document.getElementById('new_user').value = ''; 
    document.getElementById('new_pass').value = ''; 
    document.getElementById('new_access').value = 'all';
    document.getElementById('tituloFormUser').innerText = "Novo Usuário"; 
    document.getElementById('tituloFormUser').style.color = "";
    document.getElementById('btnSaveUser').innerText = "Add"; 
    document.getElementById('btnSaveUser').style.backgroundColor = "";
    document.getElementById('btnCancelUser').style.display = "none";
}

window.delUser = function(i) { 
    if(confirm('Apagar?')) { 
        users.splice(i, 1); 
        localStorage.setItem('estoquePro_users', JSON.stringify(users)); 
        if(editingUserIdx === i) window.cancelarEdicaoUser();
        renderUsers(); 
    } 
}

window.togglePerm = function(i,t) { 
    users[i][t] = !users[i][t]; 
    localStorage.setItem('estoquePro_users', JSON.stringify(users)); 
}

function renderUsers() {
    const tb = document.querySelector('#tabelaUsers tbody'); tb.innerHTML = '';
    const nomes = { 
        'all':'<span style="color:blue;font-weight:bold">🌍 Total</span>', 
        'estoque_casa':'📦 Casa', 
        'estoque_ventura':'🏠 Ventura', 
        'estoque_contento':'🏢 Contento' 
    };
    
    users.forEach((u, i) => {
        const isMe = u.user === 'Expeto';
        const del = isMe ? '' : `<button onclick="window.delUser(${i})" style="color:red;border:none;background:none;cursor:pointer;font-size:1.1rem">🗑️</button>`;
        const edit = `<button onclick="window.editarUsuario(${i})" style="color:orange;border:none;background:none;cursor:pointer;font-size:1.1rem;margin-right:5px">✏️</button>`;
        
        tb.innerHTML += `
            <tr style="border-bottom:1px solid #eee">
                <td style="padding:10px"><strong>${u.user}</strong></td>
                <td style="padding:10px">${nomes[u.access]||u.access}</td>
                <td style="text-align:center"><input type="checkbox" ${u.canEdit?'checked':''} onchange="window.togglePerm(${i},'canEdit')" ${isMe?'disabled':''}></td>
                <td style="text-align:center"><input type="checkbox" ${u.isAdmin?'checked':''} onchange="window.togglePerm(${i},'isAdmin')" ${isMe?'disabled':''}></td>
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
    
    if(id){
        const i=itens.find(x=>x.id==id); 
        document.getElementById('m_id').value=i.id; 
        document.getElementById('m_nome').value=i.nome; 
        document.getElementById('m_categoria').value=i.categoria; 
        document.getElementById('m_qtd').value=i.initial; 
        document.getElementById('m_min').value=i.min; 
        document.getElementById('m_preco').value=i.preco;
        document.getElementById('modalTitle').innerText = 'Editar Produto';
    } else {
        document.getElementById('modalTitle').innerText = 'Novo Produto';
    }
}
window.fecharModal = function() { mProd.classList.remove('active'); }

const mAdm = document.getElementById('modalAdmin');
window.abrirAdmin = function() { mAdm.classList.add('active'); renderUsers(); }
window.fecharAdmin = function() { mAdm.classList.remove('active'); }

const mRel = document.getElementById('modalRelatorio');
window.verDivergencias = function() { 
    const l=document.getElementById('listaDivergencias'); l.innerHTML=''; 
    let hasError = false;
    itens.forEach(i=>{ 
        if(i.real!==''){ 
            const diff=parseInt(i.real)-((i.initial||0)+(i.entry||0)-(i.sales||0)-(i.internal||0)-(i.voucher||0)-(i.damage||0)); 
            if(diff!==0) {
                hasError = true;
                const cor = diff > 0 ? 'blue' : 'red';
                const sinal = diff > 0 ? '+' : '';
                l.innerHTML+=`<li style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between;"><span>${i.nome}</span> <b style="color:${cor}">${sinal}${diff}</b></li>`; 
            }
        } 
    }); 
    if(!hasError) l.innerHTML = '<li style="padding:15px; text-align:center; color:green;">✅ Tudo certo por aqui!</li>';
    mRel.classList.add('active'); 
}
window.fecharRelatorio = function() { mRel.classList.remove('active'); }