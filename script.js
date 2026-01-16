// --- IMPORTAÇÕES DO FIREBASE (CDN) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// --- CONFIGURAÇÃO DO SEU PROJETO ---
const firebaseConfig = {
  apiKey: "AIzaSyA5JBf4DcZghGXZWnLYdlMCOBd9As36Czw",
  authDomain: "estoque-ventura-3ddf3.firebaseapp.com",
  projectId: "estoque-ventura-3ddf3",
  storageBucket: "estoque-ventura-3ddf3.firebasestorage.app",
  messagingSenderId: "859531094118",
  appId: "1:859531094118:web:21ebe937b5ed851160a5a7",
  measurementId: "G-7NV7DY9FV6"
};
// --- VARIÁVEIS DAS LOJAS ---
let currentLoja = 'estoque_ventura'; // Começa na Ventura
let unsubscribe = null; // Serve para parar de carregar a loja antiga

// --- FUNÇÃO PARA TROCAR DE LOJA ---
window.trocarLoja = function(novaLoja) {
    currentLoja = novaLoja;
    
    // Atualiza visual dos botões
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if(novaLoja.includes('ventura')) document.getElementById('btn-ventura').classList.add('active');
    if(novaLoja.includes('contento')) document.getElementById('btn-contento').classList.add('active');

    // Troca o título lá em cima
    const titulos = { 'estoque_ventura': 'Loja Ventura', 'estoque_contento': 'Loja Contento' };
    const tituloEl = document.querySelector('.title');
    if(tituloEl) tituloEl.innerHTML = titulos[novaLoja] || 'Estoque';

    // Para de ouvir a loja antiga e conecta na nova
    if(unsubscribe) unsubscribe();
    
    const novaRef = collection(db, currentLoja);
    unsubscribe = onSnapshot(novaRef, (snapshot) => {
        itens = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        // Ordena por nome
        itens.sort((a,b) => (a.nome || "").localeCompare(b.nome || ""));
        renderizarInterface();
    });
}


// --- VARIÁVEIS GLOBAIS ---
let itens = [];
let currentUser = null;

// Usuários (Local Storage - Mantido para simplicidade neste momento)
let users = JSON.parse(localStorage.getItem('estoquePro_users')) || [
    { user: 'Expeto', pass: '1511', isAdmin: true, canEdit: true }
];



// --- FUNÇÕES DE LOGIN (PRESA AO WINDOW) ---
window.fazerLogin = function() {
    const u = document.getElementById('loginUser').value;
    const p = document.getElementById('loginPass').value;
    const found = users.find(user => user.user === u && user.pass === p);

    if (found) {
        currentUser = found;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        document.getElementById('btnAdmin').style.display = found.isAdmin ? 'block' : 'none';
        renderizarInterface();
    } else {
        document.getElementById('loginMsg').innerText = "Senha incorreta!";
    }
}
window.fazerLogout = function() { location.reload(); }

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

// --- CRUD FIREBASE ---
window.salvarProduto = async function() {
    const id = document.getElementById('m_id').value;
    const nome = document.getElementById('m_nome').value;
    const cat = document.getElementById('m_categoria').value || '-';
    const qtdIni = parseInt(document.getElementById('m_qtd').value) || 0;
    const min = parseInt(document.getElementById('m_min').value) || 1;
    const preco = parseFloat(document.getElementById('m_preco').value) || 0;

    if (!nome) return alert("Preencha o nome!");

    try {
        if (id) {
            // Update
            const docRef = doc(db, currentLoja, id);
            await updateDoc(docRef, { nome, categoria: cat, min, preco });
        } else {
            // Create
            await addDoc(produtosRef, {
                nome, categoria: cat, initial: qtdIni, min, preco,
                entry: 0, sales: 0, internal: 0, voucher: 0, damage: 0, real: ''
            });
        }
        window.fecharModal();
    } catch (e) {
        console.error(e);
        alert("Erro ao salvar no banco!");
    }
}

window.deletarProduto = async function(id) {
    // 1. Verifica se tem permissão
    if(!currentUser || !currentUser.canEdit) return alert("Sem permissão!");

    // 2. Confirmação de segurança
    if (confirm("Tem certeza que deseja apagar este produto desta loja?")) {
        try {
            // 3. Deleta da LOJA ATUAL (currentLoja)
            await deleteDoc(doc(db, currentLoja, id));
        } catch (e) {
            alert("Erro ao apagar: " + e.message);
        }
    }
}

window.atualizarValor = async function(id, campo, valor) {
    // 1. Trata o valor (se for 'real' vazio, fica vazio, senão vira número)
    const valFinal = (campo === 'real' && valor === '') ? '' : (parseInt(valor) || 0);
    
    // 2. Pega a referência do documento na LOJA ATUAL
    const docRef = doc(db, currentLoja, id);
    
    // 3. Atualiza só aquele campo no Firebase
    try {
        await updateDoc(docRef, { [campo]: valFinal });
    } catch (e) {
        console.error("Erro ao atualizar:", e);
    }
}

window.fecharSemana = async function() {
    // 1. Segurança de Admin
    if(!currentUser || !currentUser.isAdmin) return alert("Apenas Admin pode fechar a semana!");

    // 2. Confirmação mostrando o nome da loja
    const nomeLoja = currentLoja === 'estoque_ventura' ? 'VENTURA' : 'CONTENTO';
    if(!confirm(`⚠️ ATENÇÃO MESTRE!\n\nVocê vai fechar o caixa da loja ${nomeLoja}.\n\nO estoque 'REAL' ou 'SISTEMA' virará o novo INICIAL.\nEntradas e Vendas serão zeradas.\n\nConfirma?`)) return;

    try {
        const batch = writeBatch(db); // Prepara o pacote de atualizações

        // 3. Passa item por item da lista atual
        itens.forEach(i => {
            const docRef = doc(db, currentLoja, i.id);

            // Calcula o estoque final atual
            const ini = i.initial || 0;
            const ent = i.entry || 0;
            const sale = i.sales || 0;
            const int = i.internal || 0;
            const vou = i.voucher || 0;
            const dam = i.damage || 0;
            
            let novoInicial = ini + ent - sale - int - vou - dam;

            // Se tiver contagem REAL, ela manda em tudo
            if (i.real !== '' && i.real !== undefined) {
                novoInicial = parseInt(i.real);
            }

            // Define o reset para a próxima semana
            batch.update(docRef, {
                initial: novoInicial,
                entry: 0,
                sales: 0,
                internal: 0,
                voucher: 0,
                damage: 0,
                real: '' // Limpa o campo real
            });
        });

        // 4. Envia tudo pro Firebase
        await batch.commit();
        alert(`✅ Semana da loja ${nomeLoja} fechada com sucesso!`);

    } catch(e) {
        alert("Erro ao fechar semana: " + e.message);
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
            else if (diff > 0) statusHtml = `<span class="status-sobra">⚠️ SOBRA ${diff}</span>`;
            else statusHtml = `<span class="status-falta">❌ FALTA ${Math.abs(diff)}</span>`;
        }

        const readonly = (currentUser && currentUser.canEdit) ? '' : 'disabled';
        
        // Passando ID como string (aspas simples)
        const acoes = (currentUser && currentUser.canEdit) 
            ? `<button class="btn-action btn-edit" onclick="window.abrirModal('${item.id}')"><i class='bx bx-edit-alt'></i></button>
               <button class="btn-action btn-delete" onclick="window.deletarProduto('${item.id}')"><i class='bx bx-trash'></i></button>`
            : '<small>🔒</small>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.nome}</strong></td>
            <td class="text-center" style="background:#f9f9f9; font-weight:bold;">${ini}</td>
            <td><input type="number" class="input-cell" value="${ent}" onchange="window.atualizarValor('${item.id}', 'entry', this.value)" ${readonly}></td>
            <td><input type="number" class="input-cell" value="${sale}" onchange="window.atualizarValor('${item.id}', 'sales', this.value)" ${readonly}></td>
            <td><input type="number" class="input-cell" value="${int}" onchange="window.atualizarValor('${item.id}', 'internal', this.value)" ${readonly}></td>
            <td><input type="number" class="input-cell" value="${vou}" onchange="window.atualizarValor('${item.id}', 'voucher', this.value)" ${readonly}></td>
            <td><input type="number" class="input-cell" value="${dam}" onchange="window.atualizarValor('${item.id}', 'damage', this.value)" ${readonly}></td>
            <td><span class="text-sistema">${sist}</span></td>
            <td><input type="number" class="input-cell input-real" value="${item.real !== undefined ? item.real : ''}" placeholder="-" onchange="window.atualizarValor('${item.id}', 'real', this.value)" ${readonly}></td>
            <td>${statusHtml}</td>
            <td class="text-center">${acoes}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- FUNÇÕES ADMIN E RELATÓRIO (MODAIS) ---
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
    if (!temErro) lista.innerHTML = '<li style="padding:10px;color:green">Tudo OK!</li>';
    modalRelatorio.classList.add('active');
}
window.fecharRelatorio = function() { modalRelatorio.classList.remove('active'); }

// --- LOGICA DE USUÁRIOS (LOCAL STORAGE) ---
window.adicionarUsuario = function() {
    const u = document.getElementById('new_user').value;
    const p = document.getElementById('new_pass').value;
    if(u && p) {
        users.push({ user:u, pass:p, isAdmin:false, canEdit:false });
        localStorage.setItem('estoquePro_users', JSON.stringify(users));
        renderUsers();
    }
}
function renderUsers() {
    const tb = document.querySelector('#tabelaUsers tbody');
    tb.innerHTML = '';
    users.forEach((u, idx) => {
        const isMe = u.user === 'Expeto';
        const btnDel = isMe ? '' : `<button onclick="window.delUser(${idx})" style="color:red;border:none;background:none;cursor:pointer">🗑️</button>`;
        tb.innerHTML += `<tr><td>${u.user}</td><td><input type="checkbox" ${u.canEdit?'checked':''} onchange="window.togglePerm(${idx},'canEdit')" ${isMe?'disabled':''}></td><td><input type="checkbox" ${u.isAdmin?'checked':''} onchange="window.togglePerm(${idx},'isAdmin')" ${isMe?'disabled':''}></td><td>${btnDel}</td></tr>`;
    });
}
window.togglePerm = function(idx, tipo) {
    users[idx][tipo] = !users[idx][tipo];
    localStorage.setItem('estoquePro_users', JSON.stringify(users));
}
window.delUser = function(idx) {
    if(confirm('Apagar?')) { users.splice(idx,1); localStorage.setItem('estoquePro_users', JSON.stringify(users)); renderUsers(); }
}