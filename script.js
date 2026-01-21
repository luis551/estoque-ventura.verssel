// --- IMPORTAÇÕES DO FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

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
let currentLoja = 'estoque_ventura'; // Começa na Ventura
let unsubscribe = null; // Para parar de ouvir a loja antiga

// Usuários (Local Storage)
// Usuários (Adicionei o campo 'access' no padrão)
let users = JSON.parse(localStorage.getItem('estoquePro_users')) || [
    { user: 'Expeto', pass: '1511', isAdmin: true, canEdit: true, access: 'all' }
];

// --- FUNÇÃO PARA TROCAR DE LOJA (COM SEGURANÇA) ---
window.trocarLoja = function(novaLoja) {
    // 1. SEGURANÇA: Se não for 'all' e tentar acessar outra loja, bloqueia
    if (currentUser && currentUser.access !== 'all' && currentUser.access !== novaLoja) {
        return alert("⛔ ACESSO NEGADO: Você não tem permissão para esta loja.");
    }

    currentLoja = novaLoja;
    
    // 2. Atualiza Botões Visuais
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    // Só marca como ativo se o botão estiver visível
    const btnV = document.getElementById('btn-ventura');
    const btnC = document.getElementById('btn-contento');
    
    if(novaLoja.includes('ventura') && btnV) btnV.classList.add('active');
    if(novaLoja.includes('contento') && btnC) btnC.classList.add('active');

    // 3. Atualiza Títulos
    const titulos = { 'estoque_ventura': 'LOJA VENTURA', 'estoque_contento': 'LOJA CONTENTO' };
    const nomeLoja = titulos[novaLoja] || 'ESTOQUE';
    
    const tituloEl = document.getElementById('tituloLoja');
    if(tituloEl) tituloEl.innerHTML = nomeLoja;

    const subTituloEl = document.getElementById('subtituloLoja');
    if(subTituloEl) subTituloEl.innerHTML = `Produtos (${nomeLoja})`;

    // 4. Carrega os dados do banco
    if(unsubscribe) unsubscribe();
    const novaRef = collection(db, currentLoja);
    unsubscribe = onSnapshot(novaRef, (snapshot) => {
        itens = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        itens.sort((a,b) => (a.nome || "").localeCompare(b.nome || ""));
        renderizarInterface();
    });
}

// --- LOGIN (FILTRO DE ACESSO) ---
window.fazerLogin = function() {
    const u = document.getElementById('loginUser').value;
    const p = document.getElementById('loginPass').value;
    const found = users.find(user => user.user === u && user.pass === p);

    if (found) {
        currentUser = found;
        
        // Garante compatibilidade com usuários antigos (se não tiver access, vira 'all')
        if(!currentUser.access) currentUser.access = 'all';

        // Mostra a tela
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        document.getElementById('sidebarLoja').style.display = 'flex';
        document.body.classList.add('logado');

        // Botão Admin só aparece se for Admin
        const btnAdm = document.getElementById('btnAdminSide');
        if(btnAdm) btnAdm.style.display = found.isAdmin ? 'flex' : 'none';
        
        // --- FILTRO DE BOTÕES DA BARRA LATERAL ---
        const btnVentura = document.getElementById('btn-ventura');
        const btnContento = document.getElementById('btn-contento');

        // Reseta (mostra todos)
        btnVentura.style.display = 'flex';
        btnContento.style.display = 'flex';

        // Aplica a regra
        if (currentUser.access === 'estoque_ventura') {
            btnContento.style.display = 'none'; // Esconde Contento
            window.trocarLoja('estoque_ventura'); // Entra na Ventura
        } 
        else if (currentUser.access === 'estoque_contento') {
            btnVentura.style.display = 'none'; // Esconde Ventura
            window.trocarLoja('estoque_contento'); // Entra na Contento
        } 
        else {
            // Se for 'all', mostra tudo e entra na padrão
            window.trocarLoja('estoque_ventura');
        }

    } else {
        document.getElementById('loginMsg').innerText = "Senha incorreta!";
    }
}
window.fazerLogout = function() { location.reload(); }

// --- 3. SALVAR (CRIAR OU EDITAR) CORRIGIDO ---
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
            // EDITAR: Usa currentLoja
            const docRef = doc(db, currentLoja, id);
            await updateDoc(docRef, { nome, categoria: cat, min, preco });
        } else {
            // CRIAR: Usa currentLoja
            await addDoc(collection(db, currentLoja), {
                nome, categoria: cat, initial: qtdIni, min, preco,
                entry: 0, sales: 0, internal: 0, voucher: 0, damage: 0, real: ''
            });
        }
        window.fecharModal();
    } catch (e) {
        console.error(e);
        alert("Erro ao salvar: " + e.message);
    }
}

// --- 4. DELETAR CORRIGIDO ---
window.deletarProduto = async function(id) {
    if(!currentUser || !currentUser.canEdit) return alert("Sem permissão!");
    
    if (confirm("Apagar produto desta loja?")) {
        try {
            // Deleta da coleção atual
            await deleteDoc(doc(db, currentLoja, id));
        } catch (e) {
            alert("Erro ao apagar: " + e.message);
        }
    }
}

// --- 5. ATUALIZAR VALOR (PLANILHA) CORRIGIDO ---
window.atualizarValor = async function(id, campo, valor) {
    const valFinal = (campo === 'real' && valor === '') ? '' : (parseInt(valor) || 0);
    const docRef = doc(db, currentLoja, id);
    
    try {
        await updateDoc(docRef, { [campo]: valFinal });
    } catch(e) { console.error(e); }
}

// --- 6. FECHAR SEMANA CORRIGIDO ---
window.fecharSemana = async function() {
    if(!currentUser || !currentUser.isAdmin) return alert("Apenas Admin!");
    
    const nomeLoja = currentLoja === 'estoque_ventura' ? 'VENTURA' : 'CONTENTO';
    if(!confirm(`⚠️ FECHAR CAIXA DA LOJA ${nomeLoja}?\n\nO estoque REAL vira o INICIAL.\nEntradas/Saídas zeram.\n\nConfirma?`)) return;

    try {
        const batch = writeBatch(db);

        itens.forEach(i => {
            const docRef = doc(db, currentLoja, i.id);
            const ini = i.initial || 0;
            const ent = i.entry || 0;
            const sale = i.sales || 0;
            const int = i.internal || 0;
            const vou = i.voucher || 0;
            const dam = i.damage || 0;
            
            let novoInicial = ini + ent - sale - int - vou - dam;
            if (i.real !== '' && i.real !== undefined) novoInicial = parseInt(i.real);

            batch.update(docRef, {
                initial: novoInicial,
                entry: 0, sales: 0, internal: 0, voucher: 0, damage: 0, real: ''
            });
        });

        await batch.commit();
        alert(`✅ Semana da ${nomeLoja} fechada!`);
    } catch(e) {
        alert("Erro: " + e.message);
    }
}

// --- RENDERIZAÇÃO ---
function renderizarInterface() {
    // Totais
    document.getElementById('totalItens').innerText = itens.length;
    
    const valorTotal = itens.reduce((acc, i) => {
        const sist = (i.initial||0) + (i.entry||0) - (i.sales||0) - (i.internal||0) - (i.voucher||0) - (i.damage||0);
        return acc + (sist * i.preco);
    }, 0);
    document.getElementById('valorTotal').innerText = valorTotal.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

    const alertas = itens.filter(i => {
        const sist = (i.initial||0) + (i.entry||0) - (i.sales||0) - (i.internal||0) - (i.voucher||0) - (i.damage||0);
        return sist <= i.min;
    }).length;
    document.getElementById('alertasBaixos').innerText = alertas;

    // Tabela
    const tbody = document.querySelector('#tabelaProdutos tbody');
    tbody.innerHTML = '';

    if (itens.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:30px; color:#999;">Nenhum produto nesta loja.<br>Clique em "+ Novo Item".</td></tr>';
        return;
    }

    itens.forEach(item => {
        const ini = item.initial || 0;
        const ent = item.entry || 0;
        const sale = item.sales || 0;
        const int = item.internal || 0;
        const vou = item.voucher || 0;
        const dam = item.damage || 0;
        const sist = ini + ent - sale - int - vou - dam;
        
        let statusHtml = '<span style="color:#ccc">-</span>';
        if (item.real !== '' && item.real !== undefined) {
            const real = parseInt(item.real);
            const diff = real - sist;
            if (diff === 0) statusHtml = '<span class="status-ok">✅ OK</span>';
            else if (diff > 0) statusHtml = `<span class="status-sobra">⚠️ +${diff}</span>`;
            else statusHtml = `<span class="status-falta">❌ -${Math.abs(diff)}</span>`;
        }

        const readonly = (currentUser && currentUser.canEdit) ? '' : 'disabled';
        
        const acoes = (currentUser && currentUser.canEdit) 
            ? `<button class="btn-action" title="Editar" onclick="window.abrirModal('${item.id}')">✏️</button>
               <button class="btn-action" title="Apagar" style="color:#e74c3c;" onclick="window.deletarProduto('${item.id}')">🗑️</button>`
            : '<small>🔒</small>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.nome}</strong></td>
            <td class="th-center" style="background:#f9f9f9; font-weight:bold;">${ini}</td>
            <td><input type="number" class="input-cell" value="${ent}" onchange="window.atualizarValor('${item.id}', 'entry', this.value)" ${readonly}></td>
            <td><input type="number" class="input-cell" value="${sale}" onchange="window.atualizarValor('${item.id}', 'sales', this.value)" ${readonly}></td>
            <td><input type="number" class="input-cell" value="${int}" onchange="window.atualizarValor('${item.id}', 'internal', this.value)" ${readonly}></td>
            <td><input type="number" class="input-cell" value="${vou}" onchange="window.atualizarValor('${item.id}', 'voucher', this.value)" ${readonly}></td>
            <td><input type="number" class="input-cell" value="${dam}" onchange="window.atualizarValor('${item.id}', 'damage', this.value)" ${readonly}></td>
            <td><span class="text-sistema">${sist}</span></td>
            <td><input type="number" class="input-cell input-real" value="${item.real !== undefined ? item.real : ''}" placeholder="-" onchange="window.atualizarValor('${item.id}', 'real', this.value)" ${readonly}></td>
            <td>${statusHtml}</td>
            <td class="th-center">${acoes}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- FUNÇÕES DE MODAL ---
const modal = document.getElementById('modalProduto');
window.abrirModal = function(editId = null) {
    if(!currentUser || !currentUser.canEdit) return alert("Sem permissão!");
    modal.classList.add('active');
    document.getElementById('m_id').value = '';
    document.getElementById('modalTitle').innerText = 'Novo Produto';
    limparCampos();

    if (editId) {
        const item = itens.find(i => i.id === editId);
        if (item) {
            document.getElementById('m_id').value = item.id;
            document.getElementById('m_nome').value = item.nome;
            document.getElementById('m_categoria').value = item.categoria;
            document.getElementById('m_qtd').value = item.initial || 0;
            document.getElementById('m_min').value = item.min;
            document.getElementById('m_preco').value = item.preco;
            document.getElementById('modalTitle').innerText = 'Editar Produto';
        }
    }
}
window.fecharModal = function() { modal.classList.remove('active'); limparCampos(); }
function limparCampos() { document.querySelectorAll('#modalProduto input').forEach(i => i.value = ''); }

// --- ADMIN E RELATÓRIO ---
const modalAdmin = document.getElementById('modalAdmin');
window.abrirAdmin = function() { modalAdmin.classList.add('active'); renderUsers(); }
window.fecharAdmin = function() { modalAdmin.classList.remove('active'); }

const modalRelatorio = document.getElementById('modalRelatorio');
window.verDivergencias = function() {
    const lista = document.getElementById('listaDivergencias');
    lista.innerHTML = '';
    let temErro = false;
    itens.forEach(i => {
        if (i.real === '' || i.real === undefined) return;
        const sist = (i.initial||0) + (i.entry||0) - (i.sales||0) - (i.internal||0) - (i.voucher||0) - (i.damage||0);
        const real = parseInt(i.real);
        const diff = real - sist;
        if (diff !== 0) {
            temErro = true;
            const classe = diff > 0 ? 'div-sobra' : 'div-falta';
            const texto = diff > 0 ? `SOBRA DE ${diff}` : `FALTA DE ${Math.abs(diff)}`;
            lista.innerHTML += `<li class="div-item"><span><strong>${i.nome}</strong></span><span class="${classe}">${texto}</span></li>`;
        }
    });
    if (!temErro) lista.innerHTML = '<li style="padding:10px;color:green;text-align:center;">Tudo Certo!</li>';
    modalRelatorio.classList.add('active');
}
window.fecharRelatorio = function() { modalRelatorio.classList.remove('active'); }

// --- SISTEMA DE USUÁRIOS (ATUALIZADO) ---
window.adicionarUsuario = function() {
    const u = document.getElementById('new_user').value;
    const p = document.getElementById('new_pass').value;
    const access = document.getElementById('new_access').value; // Pega o acesso escolhido

    if(u && p) {
        if(users.find(user => user.user === u)) return alert("Usuário já existe!");

        users.push({ 
            user: u, 
            pass: p, 
            isAdmin: false, 
            canEdit: false, 
            access: access // Salva: 'all', 'estoque_ventura' ou 'estoque_contento'
        });
        
        localStorage.setItem('estoquePro_users', JSON.stringify(users));
        renderUsers();
        
        // Limpa campos
        document.getElementById('new_user').value = '';
        document.getElementById('new_pass').value = '';
    } else {
        alert("Preencha usuário e senha!");
    }
}

function renderUsers() {
    const tb = document.querySelector('#tabelaUsers tbody');
    tb.innerHTML = '';
    
    // Dicionário para mostrar nomes bonitos na tabela
    const nomesAcesso = {
        'all': '<span style="color:blue; font-weight:bold;">🌍 Total</span>',
        'estoque_ventura': '🏠 Ventura',
        'estoque_contento': '🏢 Contento'
    };

    users.forEach((u, idx) => {
        const isMe = u.user === 'Expeto';
        const btnDel = isMe ? '' : `<button onclick="window.delUser(${idx})" style="color:red;border:none;background:none;cursor:pointer">🗑️</button>`;
        
        // Pega o nome bonito ou usa o código se der erro
        const displayAccess = nomesAcesso[u.access] || 'Total';

        tb.innerHTML += `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px;"><strong>${u.user}</strong></td>
                <td style="padding:10px;">${displayAccess}</td>
                <td style="text-align:center;"><input type="checkbox" ${u.canEdit?'checked':''} onchange="window.togglePerm(${idx},'canEdit')" ${isMe?'disabled':''}></td>
                <td style="text-align:center;"><input type="checkbox" ${u.isAdmin?'checked':''} onchange="window.togglePerm(${idx},'isAdmin')" ${isMe?'disabled':''}></td>
                <td style="text-align:center;">${btnDel}</td>
            </tr>
        `;
    });
}