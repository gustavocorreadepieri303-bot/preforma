const URL = 'https://wolverine-concave-baggie.ngrok-free.dev';
const API_URL = `${URL}/api/etiquetas`;
/**
 * Carrega opções de um dropdown com suporte a cache local (stale-while-revalidate).
 * @param {string} selectId - ID do elemento <select>
 * @param {string} aba - Nome da aba da API
 * @param {string} chaveStorage - Chave do localStorage
 * @param {Object} [estilosExtra] - Estilos CSS opcionais para aplicar ao elemento
 */
document.addEventListener('DOMContentLoaded', inicializarDropdowns);

async function inicializarDropdowns() {
    // 1. Tenta carregar imediatamente do localStorage (memória do navegador)
    const opcoesSalvas = localStorage.getItem('opcoes_dropdowns');

    if (opcoesSalvas) {
        try {
            const opcoes = JSON.parse(opcoesSalvas);
            renderizarTodosDropdowns(opcoes);
            console.log('Opções carregadas do cache local (localStorage).');
        } catch (e) {
            console.error('Erro ao ler do localStorage:', e);
        }
    }

    // 2. Busca os dados atualizados do servidor Node.js em segundo plano
    await atualizarOpcoesDoServidor();
}

async function atualizarOpcoesDoServidor() {
    try {
        const resposta = await fetchComRetry(`${URL}/api/opcoes`, {
            headers: {
                'ngrok-skip-browser-warning': 'true' // Ignora o aviso do ngrok
            }
        });

        if (!resposta.ok) throw new Error(`Erro HTTP: ${resposta.status}`)

        const novasOpcoes = await resposta.json();

        // Verifica se vieram dados válidos antes de atualizar
        if (novasOpcoes && (novasOpcoes.caixas || novasOpcoes.resinas)) {
            // Salva na memória do navegador para o próximo acesso
            localStorage.setItem('opcoes_dropdowns', JSON.stringify(novasOpcoes));

            // Atualiza os dropdowns na tela com as opções mais recentes
            renderizarTodosDropdowns(novasOpcoes);
            console.log('Opções atualizadas a partir do servidor e salvas no localStorage.');
        }
    } catch (erro) {
        console.warn('Não foi possível atualizar do servidor. Mantendo dados do cache:', erro.message);
    }
}

function renderizarTodosDropdowns(opcoes) {
    preencherSelect('dropdown-cxs', opcoes.caixas);
    preencherSelect('dropdown-resina', opcoes.resinas);
    preencherSelect('dropdown-fornecedores', opcoes.fornecedores);
    preencherSelect('dropdown-deposito', opcoes.depositos);
}

function preencherSelect(elementId, itens) {
    const select = document.getElementById(elementId);
    if (!select || !Array.isArray(itens)) return;

    // Preserva o valor selecionado atualmente, caso o operador já esteja mexendo no form
    const valorAtual = select.value;

    select.innerHTML = '<option value="">Selecione...</option>';

    itens.forEach(item => {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item;
        select.appendChild(option);
    });

    if (valorAtual) {
        select.value = valorAtual;
    }
}

async function fetchComRetry(url, opcoes, tentativas = 3) {
    for (let i = 0; i < tentativas; i++) {
        try {
            const resposta = await fetch(url, opcoes);
            if (resposta.ok) return resposta;
        } catch (erro) {
            console.warn(`Tentativa ${i + 1} de ${tentativas} falhou. A tentar novamente...`);
            if (i === tentativas - 1) throw erro; // Lança o erro se atingir a última tentativa
            await new Promise(resolve => setTimeout(resolve, 1000)); // Aguarda 1 segundo antes de tentar de novo
        }
    }
}

async function enviarFormulario(event) {
    if (event) event.preventDefault();
    
    const btnSubmit = document.querySelector('#form button[type="submit"]') || event?.target?.querySelector('button[type="submit"]');
    if (btnSubmit && btnSubmit.disabled) return;
    if (btnSubmit) btnSubmit.disabled = true;

    const selectCaixa = document.getElementById('input-cxs');
    const selectResina = document.getElementById('input-resina');
    const selectFornecedor = document.getElementById('input-fornecedores');
    const selectDeposito = document.getElementById('input-deposito');
    const inputQntd = document.getElementById('qntd-cxs');
    const inputNota = document.getElementById('numero-nota');

    const dados = {
        notaFiscal: inputNota ? inputNota.value.trim() : '',
        caixa: selectCaixa ? selectCaixa.value : '',
        resina: selectResina ? selectResina.value : '',
        fornecedor: selectFornecedor ? selectFornecedor.value : '',
        deposito: selectDeposito ? selectDeposito.value : '',
        qntdCxs: inputQntd ? inputQntd.value : '1'
    };

    try {
        // Utiliza o fetchComRetry em vez do fetch comum
        const response = await fetchComRetry(API_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify(dados)
        });

        const resultado = await response.json();

        if (resultado.status === 'sucesso') {
            alert('Lote e nota fiscal registrados com sucesso!');
        } else {
            alert('Erro ao salvar no MySQL/Planilha: ' + (resultado.mensagem || ''));
        }

    } catch (erro) {
        console.error('Erro de conexão com o servidor Node.js:', erro);
        alert('Ocorreu uma falha na comunicação com o servidor. Por favor, tente novamente.');
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
    }
}


// 1. Carrega a lista de Chegadas Gerais (Sem o botão de imprimir lote e sem TIPO)
async function carregarChegadasGerais() {
    try {
        const res = await fetchComRetry(`${URL}/api/lotes`, {
            headers: {
                'ngrok-skip-browser-warning': 'true' // Ignora o aviso do ngrok
            }
        });
        if (!res.ok) throw new Error(`Erro: ${res.status}`);

        const json = await res.json();
        const tabelaBody = document.getElementById('tabelaLotesBody');

        if (!tabelaBody) return;

        if (json.status === 'sucesso' && json.dados.length > 0) {
            let html = '';
            json.dados.forEach(lote => {
                html += `
                    <tr>
                        <td>
                            <button type="button" title="Ver Detalhes" onclick="abrirDetalhesLote(${lote.lote_id})">🔍</button>
                            <!-- Botão de imprimir lote todo removido -->
                        </td>
                        <td>${lote.lote_id}</td>
                        <td>${lote.aviso}</td>
                        <td>${lote.local || 'BALY'}</td>
                        <td>${lote.data_cad}</td>
                    </tr>
                `;
            });
            tabelaBody.innerHTML = html;
        } else {
            tabelaBody.innerHTML = '<tr><td colspan="5" class="texto-vazio">Nenhum lote registrado.</td></tr>';
        }
    } catch (erro) {
        console.error("Falha ao carregar lotes:", erro);
    }
}

// 2. Carrega etiquetas do Lote com botão de Impressão Individual
// Variável global para guardar as etiquetas do lote atual em memória
let etiquetasLoteAtual = [];

async function abrirDetalhesLote(loteId) {
    try {
        const res = await fetchComRetry(`${URL}/api/lotes/${loteId}/etiquetas`, {
            headers: {
                'ngrok-skip-browser-warning': 'true' // Ignora o aviso do ngrok
            }
        }
        );
        const json = await res.json();

        if (!res.ok) {
            console.error('Detalhe do erro vindo do servidor:', json.detalhe || json.mensagem);
            alert(`Erro no Servidor (500): ${json.detalhe || json.mensagem}`);
            return;
        }

        const tabelaEtiquetasBody = document.getElementById('tabelaEtiquetasBody');
        const modal = document.getElementById('modalEtiquetas');
        const tituloModal = document.getElementById('tituloModalEtiquetas');

        if (tituloModal) tituloModal.innerText = `Etiquetas do Lote #${loteId}`;

        if (json.status === 'sucesso') {
            etiquetasLoteAtual = json.dados;
            let html = '';
            json.dados.forEach((etq, index) => {
                html += `
                    <tr>
                        <td><input type="checkbox" class="chk-etiqueta" value="${index}"></td>
                        <td><strong>${etq.nr_etiqueta}</strong></td>
                        <td>${etq.seq_pallet}</td>
                        <td><span class="status-ok">${etq.status || 'OK'}</span></td>
                        <td>${etq.dta_geracao}</td>
                    </tr>
                `;
            });
            tabelaEtiquetasBody.innerHTML = html;
            modal.style.display = 'block';
        }
    } catch (erro) {
        console.error("Falha ao carregar etiquetas do lote:", erro);
    }
}

function imprimirEtiquetaUnica() {
    const checkboxes = document.querySelectorAll('.chk-etiqueta:checked');
    
    if (checkboxes.length === 0) {
        alert('Selecione pelo menos uma etiqueta para imprimir.');
        return;
    }

    let iframeAnterior = document.getElementById('iframeImpressao');
    if (iframeAnterior) {
        iframeAnterior.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'iframeImpressao';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const docFrame = iframe.contentWindow.document;
    const agora = new Date();
    const horaAtual = agora.toLocaleTimeString('pt-BR');

    docFrame.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title></title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
            <style>
                @media print {
                    @page {
                        size: 120mm 30mm;
                        margin: 0 !important;
                    }
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #fff;
                    }
                }
                * {
                    box-sizing: border-box;
                }
                body {
                    margin: 0;
                    padding: 0;
                    background: #fff;
                    font-family: Arial, sans-serif;
                }
                .card-etiqueta-print {
                    position: relative !important;
                    page-break-after: always !important;
                    break-after: page !important;
                    width: 120mm;
                    height: 30mm;
                    border: 1px solid #000;
                    padding: 1.5mm 3mm;
                    color: #000;
                    display: flex;
                    flex-direction: row;
                    justify-content: space-between;
                    align-items: center;
                    overflow: hidden;
                    background: #fff;
                }
                .card-etiqueta-print:last-child {
                    page-break-after: avoid !important;
                    break-after: avoid !important;
                }
                .etq-info {
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    height: 100%;
                    width: 73%;
                }
                .etq-caixa {
                    font-size: 15px;
                    font-weight: bold;
                    line-height: 1.1;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .etq-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    row-gap: 2px;
                    column-gap: 6px;
                    font-size: 10px;
                    font-weight: bold;
                    line-height: 1.1;
                }
                .etq-lote {
                    font-size: 10px;
                    font-weight: bold;
                    line-height: 1.1;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .campo-lote {
                    display: inline-block;
                    border: 1px solid #000;
                    min-width: 40px;
                    height: 13px;
                    padding: 0 3px;
                    line-height: 11px;
                }
                .etq-direita {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    justify-content: space-between;
                    height: 100%;
                    width: 25%;
                }
                .etq-qrcode {
                    width: 22mm;
                    height: 22mm;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .etq-qrcode img, .etq-qrcode canvas {
                    width: 22mm !important;
                    height: 22mm !important;
                }
                .etq-serie {
                    font-size: 7px;
                    font-weight: bold;
                    color: #000;
                    word-break: break-all;
                    text-align: right;
                    line-height: 1;
                }
            </style>
        </head>
        <body>
            <div id="conteudoEtiquetas"></div>
        </body>
        </html>
    `);
    docFrame.close();

    const containerFrame = docFrame.getElementById('conteudoEtiquetas');

    checkboxes.forEach((chk) => {
        const idx = chk.value;
        const etq = etiquetasLoteAtual[idx];

        const horaExibicao = etq.hora_geracao || etq.hora || horaAtual;
        const resinaExibicao = etq.resina || etq.RESINA || 'N/A';

        // Formatação garantida da data em DD/MM/YYYY
        let dataExibicao = agora.toLocaleDateString('pt-BR');
        const dataBruta = etq.dta_geracao || etq.data;

        if (dataBruta) {
            const d = new Date(dataBruta);
            if (!isNaN(d.getTime())) {
                dataExibicao = d.toLocaleDateString('pt-BR');
            }
        }

        const card = docFrame.createElement('div');
        card.className = 'card-etiqueta-print';
        
        card.innerHTML = `
            <div class="etq-info">
                <div class="etq-caixa">Caixa: "${etq.caixa || ''}"</div>
                <div class="etq-grid">
                    <div>DEPÓSITO: ${etq.deposito || 'XXXX'}</div>
                    <div>DATA: ${dataExibicao}</div>
                    <div>N° CAIXA: ${etq.seq_pallet || ''}</div>
                    <div>HORÁRIO: ${horaExibicao}</div>
                    <div>RESINA: ${resinaExibicao}</div>
                </div>
                <div class="etq-lote">Lote: <span class="campo-lote">${etq.lote || etq.lote_id || ''}</span></div>
            </div>
            <div class="etq-direita">
                <div class="etq-qrcode" id="qr_${idx}"></div>
                <div class="etq-serie">${etq.nr_etiqueta}</div>
            </div>
        `;

        containerFrame.appendChild(card);

        new iframe.contentWindow.QRCode(docFrame.getElementById(`qr_${idx}`), {
            text: etq.nr_etiqueta,
            width: 85,
            height: 85,
            correctLevel: iframe.contentWindow.QRCode.CorrectLevel.H
        });
    });

    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
    }, 400);
}
function fecharModalEtiquetas() {
    document.getElementById('modalEtiquetas').style.display = 'none';
}

function marcarTodosEtiquetas(checkboxPai) {
    const checkboxes = document.querySelectorAll('.chk-etiqueta');
    checkboxes.forEach(chk => chk.checked = checkboxPai.checked);
}

function fecharModalGerenciador() {
    document.getElementsByClassName('container-etq-bkg')[0].style.display = 'none';
}

let etiquetasBipadas = [];

// Função auxiliar para resetar o estado da saída
function limparModalSaida() {
    etiquetasBipadas = [];

    const lista = document.getElementById('listaBipados');
    if (lista) lista.innerHTML = '';

    const total = document.getElementById('totalBipados');
    if (total) total.innerText = '0';

    const inputBipador = document.getElementById('inputBipador');
    if (inputBipador) inputBipador.value = '';

    const notaSaida = document.getElementById('notaSaida');
    if (notaSaida) notaSaida.value = '';
}

function abrirModalSaida() {
    limparModalSaida();

    const modalBkg = document.getElementById('modalSaida-bkg');
    if (modalBkg) modalBkg.style.display = 'block';

    const input = document.getElementById('inputBipador');
    if (input) {
        input.value = '';
        input.focus();
    }
}

function fecharModalSaida() {
    const modalBkg = document.getElementById('modalSaida-bkg');
    if (modalBkg) modalBkg.style.display = 'none';

    limparModalSaida();
}

// LÓGICA DO BIPADOR: Usamos 'change' ou evitamos acúmulo limpando o listener antigo
const inputBipadorElem = document.getElementById('inputBipador');

if (inputBipadorElem) {
    // Remove qualquer ouvinte antigo antes de adicionar o novo
    inputBipadorElem.replaceWith(inputBipadorElem.cloneNode(true));

    // Pega a nova referência do elemento clonado
    const novoInputBipador = document.getElementById('inputBipador');

    novoInputBipador.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation(); // Impede que o evento suba ou seja executado mais de uma vez

            // Limpa caracteres de controle invisíveis e espaços
            const codigo = this.value.replace(/[\r\n]/g, '').trim();

            if (!codigo) return;

            // Checa se já existe no array
            if (etiquetasBipadas.includes(codigo)) {
                alert(`A etiqueta "${codigo}" já foi bipada nesta sessão!`);
                this.value = '';
                return;
            }

            // Adiciona a etiqueta
            etiquetasBipadas.push(codigo);
            atualizarListaBipados();

            this.value = '';
            this.focus();
        }
    });
}

function atualizarListaBipados() {
    const lista = document.getElementById('listaBipados');
    if (!lista) return;

    lista.innerHTML = '';

    etiquetasBipadas.forEach((cod, index) => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.padding = '6px 0';
        li.style.borderBottom = '1px solid #444';
        li.innerHTML = `
            <span><strong>#${index + 1}</strong> - ${cod}</span>
            <button type="button" onclick="removerBipado(${index})" style="color:#ff4d4d; border:none; background:none; cursor:pointer; font-weight:bold;">X</button>
        `;
        lista.appendChild(li);
    });

    const totalElem = document.getElementById('totalBipados');
    if (totalElem) {
        totalElem.innerText = etiquetasBipadas.length;
    }
}

function removerBipado(index) {
    etiquetasBipadas.splice(index, 1);
    atualizarListaBipados();
}

async function finalizarSaida() {
    if (etiquetasBipadas.length === 0) {
        alert('Nenhuma etiqueta foi bipada para registrar a saída.');
        return;
    }

    const notaSaida = document.getElementById('notaSaida').value.trim();

    if (!confirm(`Deseja confirmar a SAÍDA de ${etiquetasBipadas.length} caixa(s)?`)) return;

    try {
        alert('Enviando dados de saída para o servidor...');
        const response = await fetchComRetry(`${URL}/api/saida`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({
                etiquetas: etiquetasBipadas,
                notaFiscal: notaSaida
            })
        });

        const res = await response.json();

        if (res.status === 'sucesso') {
            alert('Saída registrada, estoque atualizado e etiquetas removidas com sucesso!');
            fecharModalSaida();
            if (typeof carregarLotes === 'function') carregarLotes();
        } else {
            alert('Erro no processamento da saída: ' + res.mensagem);
        }
    } catch (erro) {
        console.error('Erro de rede na saída:', erro);
        alert('Falha ao se comunicar com o servidor.');
    }
}