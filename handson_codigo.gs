/**
 * ============================================================================
 * HANDS-ON BY CISSA — PRESENÇA MULTIDIA, INSCRIÇÃO OPCIONAL E CERTIFICAÇÃO
 * Google Apps Script (V8) — arquivo único
 * Versão 1.1.0
 * ----------------------------------------------------------------------------
 * SEÇÕES: 1 Base · 2 Acesso · 3 Dias e presença · 4 Participantes e formulário ·
 *         5 Certificados e registro central · 6 Administração e entrada web
 *
 * REGRAS DE OURO
 *  - Funções SEM "_" no fim podem ser chamadas pelo navegador. Por isso cada uma valida
 *    sessão e perfil sozinha. Funções com "_" no fim são internas.
 *  - Toda regra é validada AQUI, no servidor. O navegador só mostra e coleta.
 *  - Fuso horário: Configurações do projeto > Fuso horário = America/Recife.
 *  - Execute setup() uma vez no editor antes da primeira publicação.
 *  - Nova edição do evento: faça uma CÓPIA da planilha, rode setup() de novo, publique e
 *    refaça a ponte da Netlify (gatilhos, propriedades e publicação não acompanham a cópia).
 * ============================================================================
 */
var VERSAO = '1.1.0';
var _mem = {};
var _idx = {};
var _abasOk = {};

var ABAS = {
  CONFIG: 'Configuracoes', DIAS: 'Dias', PARTICIPANTES: 'Participantes', PRESENCAS: 'Presencas',
  USUARIOS: 'Usuarios', AUDITORIA: 'Auditoria', MATERIAIS: 'Materiais', FORMULARIO: 'Formulario'
};

/** Esquema de cada aba: [campoInterno, tituloDaColuna]. A ordem define as colunas. */
var ESQ = {
  CONFIG: [['chave', 'Chave'], ['valor', 'Valor']],
  DIAS: [['id', 'ID'], ['data', 'Data'], ['inicio', 'Início'], ['fim', 'Término'], ['horas', 'Carga horária (h)'], ['titulo', 'Tema'],
    ['codigo', 'Código da aula'], ['janela', 'Janela (Auto/Aberta/Fechada)'], ['janelaAte', 'Janela manual vale até (ms)'], ['link', 'Link da transmissão'], ['senhaSala', 'Senha da sala'],
    ['status', 'Status'], ['codigoEnviadoEm', 'Código enviado à equipe em'], ['criadoEm', 'Criado em']],
  PARTICIPANTES: [['cpf', 'CPF'], ['nome', 'Nome (como no certificado)'], ['email', 'E-mail'], ['origem', 'Origem'], ['utm', 'Origem (UTM)'], ['inscritoEm', 'Inscrito em'],
    ['lgpd', 'LGPD aceita em'], ['respostas', 'Respostas do formulário (JSON)'],
    ['hash', 'Senha (hash)'], ['tempHash', 'Senha temporária (hash)'], ['tempExpira', 'Temporária expira (ms)'], ['envioSenha', 'Envio da senha'],
    ['npsNota', 'NPS nota'], ['npsComentario', 'NPS comentário'], ['npsEm', 'NPS respondido em'],
    ['certCodigo', 'Código do certificado'], ['certLink', 'Link do certificado (PDF)'], ['certHoras', 'Horas no certificado'], ['certEmitidoEm', 'Certificado emitido em'],
    ['registro', 'Registro central'], ['criadoEm', 'Criado em'], ['atualizadoEm', 'Atualizado em']],
  PRESENCAS: [['chave', 'Chave (CPF|Dia)'], ['diaId', 'Dia'], ['cpf', 'CPF'], ['horario', 'Horário'], ['origem', 'Origem (aluno/manual)'], ['status', 'Status'],
    ['motivo', 'Motivo'], ['registradoPor', 'Registrado por'], ['removidoEm', 'Removido em'], ['removidoPor', 'Removido por']],
  USUARIOS: [['id', 'ID'], ['nome', 'Nome'], ['email', 'E-mail'], ['papel', 'Papel'], ['hash', 'Senha (hash)'], ['trocarSenha', 'Trocar senha'],
    ['status', 'Status'], ['criadoEm', 'Criado em'], ['tentativas', 'Tentativas'], ['bloqueadoAte', 'Bloqueado até']],
  AUDITORIA: [['quando', 'Data/hora'], ['usuario', 'Usuário'], ['papel', 'Perfil'], ['acao', 'Ação'], ['entidade', 'Entidade'], ['detalhe', 'Detalhe']],
  FORMULARIO: [['id', 'ID'], ['rotulo', 'Campo'], ['tipo', 'Tipo'], ['placeholder', 'Texto de ajuda'], ['obrigatorio', 'Obrigatório (Sim/Não)'],
    ['opcoes', 'Opções (separadas por vírgula)'], ['ordem', 'Ordem'], ['ativo', 'Ativo (Sim/Não)']],
  MATERIAIS: [['id', 'ID'], ['titulo', 'Título'], ['descricao', 'Descrição'], ['tipo', 'Tipo'], ['ref', 'Endereço ou ID do arquivo'], ['nomeArquivo', 'Nome do arquivo'],
    ['tamanho', 'Tamanho (bytes)'], ['quemVe', 'Quem vê'], ['ordem', 'Ordem'], ['ativo', 'Ativo (Sim/Não)'], ['acessos', 'Acessos'], ['criadoEm', 'Criado em']]
};

var PAPEIS = ['admin', 'facilitador'];
var ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sem I, L, O, 0, 1: evita confusão ao ditar o código
var QV_AREA = 'Todos na área';
var QV_NPS = 'Após a pesquisa';
var NOME_REMETENTE = 'Equipe CISSA';
var NOME_PASTA_CERT = 'Certificados Emitidos';
var NOME_PASTA_BANNER = 'Banner do Evento';
var NOME_PASTA_MATERIAIS = 'Materiais do Evento';
var LIMITE_EXECUCAO_MS = 4.5 * 60 * 1000;

var CFG = {
  STATUS: 'Status do Evento', NOME: 'Nome do Evento', SUBTITULO: 'Subtítulo do Evento', EXIBIR_SUBTITULO: 'Exibir Subtítulo (Sim/Não)',
  FACILITADORES: 'Facilitadores (separados por ;)', LOCAL: 'Endereço / Local Presencial', EXIBIR_LOCAL: 'Exibir Local (Sim/Não)', OBS: 'Observações / Orientações Gerais',
  BANNER: 'Link do Banner Principal (URL)', COR1: 'Cor Primária (HEX)', COR2: 'Cor Secundária (HEX)',
  APP: 'Link da Aplicação (endereço principal)', TEMPLATE: 'Link do Template do Certificado',
  MIN_ANTES: 'Presença abre (minutos antes do fim da aula)', MIN_DEPOIS: 'Presença fecha (minutos depois do fim da aula)',
  FORA_LISTA: 'Aceitar CPFs fora da lista (Sim/Não)', CODIGO_EQUIPE: 'Enviar código do dia à equipe (Sim/Não)', EMAILS_EXTRAS: 'E-mails extras da equipe (separados por ;)',
  SENHA_DIAS: 'Validade da senha temporária inicial (dias)', EMAIL_SENHA_IMPORT: 'Enviar senha por e-mail ao importar ou cadastrar (Sim/Não)',
  NPS_EXIGIR: 'Exigir pesquisa de satisfação para o certificado (Sim/Não)', NPS_LIB: 'Pesquisa de satisfação (Auto/Sim/Não)',
  CERT_LIB: 'Certificados (Auto/Sim/Não)', FREQ_MIN: 'Frequência mínima para certificado (% das horas, vazio = sem mínimo)',
  TRANSMISSAO: 'Habilitar link da transmissão (Sim/Não)', ZOOM: 'Link da Transmissão (geral)', ZOOM_SENHA: 'Senha da sala (geral)',
  ZOOM_ANTECED: 'Liberar transmissão (minutos antes do início)',
  FORM_ATIVO: 'Formulário de inscrição habilitado (Sim/Não)', INSCR_ABERTAS: 'Inscrições abertas (Sim/Não)',
  INSCR_ATE: 'Inscrições abertas até (DD/MM/AAAA HH:MM, opcional)', META: 'Meta de inscritos (opcional)', INSCR_TETO_HORA: 'Teto de inscrições por hora',
  REG_ATIVO: 'Registro Central Ativo (Sim/Não)', REG_URL: 'Registro Central - Endereço', REG_FONTE: 'Registro Central - ID da Fonte'
};

var CFG_PADRAO = {};
CFG_PADRAO[CFG.STATUS] = 'Pendente';
CFG_PADRAO[CFG.NOME] = 'Novo Evento CISSA';
CFG_PADRAO[CFG.SUBTITULO] = '';
CFG_PADRAO[CFG.EXIBIR_SUBTITULO] = 'Sim';
CFG_PADRAO[CFG.FACILITADORES] = '';
CFG_PADRAO[CFG.LOCAL] = '';
CFG_PADRAO[CFG.EXIBIR_LOCAL] = 'Sim';
CFG_PADRAO[CFG.OBS] = '';
CFG_PADRAO[CFG.BANNER] = '';
CFG_PADRAO[CFG.COR1] = '#D25600';
CFG_PADRAO[CFG.COR2] = '#375B95';
CFG_PADRAO[CFG.APP] = '';
CFG_PADRAO[CFG.TEMPLATE] = '';
CFG_PADRAO[CFG.MIN_ANTES] = '10';
CFG_PADRAO[CFG.MIN_DEPOIS] = '10';
CFG_PADRAO[CFG.FORA_LISTA] = 'Sim';
CFG_PADRAO[CFG.CODIGO_EQUIPE] = 'Sim';
CFG_PADRAO[CFG.EMAILS_EXTRAS] = '';
CFG_PADRAO[CFG.SENHA_DIAS] = '14';
CFG_PADRAO[CFG.EMAIL_SENHA_IMPORT] = 'Sim';
CFG_PADRAO[CFG.NPS_EXIGIR] = 'Sim';
CFG_PADRAO[CFG.NPS_LIB] = 'Auto';
CFG_PADRAO[CFG.CERT_LIB] = 'Auto';
CFG_PADRAO[CFG.FREQ_MIN] = '';
CFG_PADRAO[CFG.TRANSMISSAO] = 'Não';
CFG_PADRAO[CFG.ZOOM] = '';
CFG_PADRAO[CFG.ZOOM_SENHA] = '';
CFG_PADRAO[CFG.ZOOM_ANTECED] = '20';
CFG_PADRAO[CFG.FORM_ATIVO] = 'Não';
CFG_PADRAO[CFG.INSCR_ABERTAS] = 'Sim';
CFG_PADRAO[CFG.INSCR_ATE] = '';
CFG_PADRAO[CFG.META] = '';
CFG_PADRAO[CFG.INSCR_TETO_HORA] = '120';
CFG_PADRAO[CFG.REG_ATIVO] = 'Não';
CFG_PADRAO[CFG.REG_URL] = '';
CFG_PADRAO[CFG.REG_FONTE] = '';

/* =============================== planilha / dados =============================== */

function ss_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Planilha não encontrada. Abra a planilha, vá em Extensões > Apps Script e execute setup().');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  return ss;
}
function cabecalhoEsperado_(k) { return ESQ[k].map(function (c) { return c[1]; }); }

function aba_(k) {
  var ss = ss_(), nome = ABAS[k], esq = ESQ[k], sh = ss.getSheetByName(nome);
  if (!sh) sh = ss.insertSheet(nome);
  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, esq.length).setNumberFormat('@').setValues([cabecalhoEsperado_(k)]).setFontWeight('bold').setBackground('#e8ecf3');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, Math.max(sh.getMaxRows(), 2), esq.length).setNumberFormat('@');
    _abasOk[k] = true;
  } else if (!_abasOk[k]) {
    var atual = sh.getRange(1, 1, 1, esq.length).getValues()[0].map(String);
    if (atual.join('|') !== cabecalhoEsperado_(k).join('|')) {
      throw new Error('FORMATO_INESPERADO: o cabeçalho da aba "' + nome + '" foi alterado. Restaure os títulos originais ou apague a aba e rode setup().');
    }
    _abasOk[k] = true;
  }
  return sh;
}
function garantirLinhas_(sh, linha) {
  if (sh.getMaxRows() < linha) sh.insertRowsAfter(sh.getMaxRows(), Math.max(100, linha - sh.getMaxRows()));
}
function limparMem_(k) { delete _mem[k]; Object.keys(_idx).forEach(function (x) { if (x.indexOf(k + '|') === 0) delete _idx[x]; }); }

/** Lê a aba inteira como objetos (cache por execução). Cada objeto traz __linha (linha real na planilha). */
function lerTudo_(k) {
  if (_mem[k]) return _mem[k];
  var sh = aba_(k), esq = ESQ[k], ult = sh.getLastRow(), out = [];
  if (ult >= 2) {
    sh.getRange(2, 1, ult - 1, esq.length).getValues().forEach(function (r, i) {
      if (String(r[0]).trim() === '' && String(r[1]).trim() === '') return;
      var o = { __linha: i + 2 };
      esq.forEach(function (c, j) { o[c[0]] = String(r[j] == null ? '' : r[j]); });
      out.push(o);
    });
  }
  _mem[k] = out;
  return out;
}
/** Índice por campo (ex.: participantes por CPF). Reconstruído quando a aba muda. */
function indice_(k, campo) {
  var ch = k + '|' + campo;
  if (_idx[ch]) return _idx[ch];
  var m = {};
  lerTudo_(k).forEach(function (o) { m[o[campo]] = o; });
  _idx[ch] = m;
  return m;
}
function linhaDe_(k, o) { return ESQ[k].map(function (c) { return o[c[0]] == null ? '' : String(o[c[0]]); }); }
function anexar_(k, o) {
  var sh = aba_(k), linha = sh.getLastRow() + 1;
  garantirLinhas_(sh, linha);
  sh.getRange(linha, 1, 1, ESQ[k].length).setNumberFormat('@').setValues([linhaDe_(k, o)]);
  o.__linha = linha; limparMem_(k);
  return o;
}
function anexarLote_(k, lista) {
  if (!lista.length) return;
  var sh = aba_(k), ini = sh.getLastRow() + 1;
  garantirLinhas_(sh, ini + lista.length - 1);
  sh.getRange(ini, 1, lista.length, ESQ[k].length).setNumberFormat('@').setValues(lista.map(function (o) { return linhaDe_(k, o); }));
  lista.forEach(function (o, i) { o.__linha = ini + i; });
  limparMem_(k);
}
function gravar_(k, o) {
  aba_(k).getRange(o.__linha, 1, 1, ESQ[k].length).setNumberFormat('@').setValues([linhaDe_(k, o)]);
  limparMem_(k);
  return o;
}
/** Apaga linhas (números reais da planilha), de baixo para cima. */
function apagarLinhas_(k, linhas) {
  var sh = aba_(k);
  linhas.slice().sort(function (a, b) { return b - a; }).forEach(function (n) { sh.deleteRow(n); });
  limparMem_(k);
}
function comTrava_(fn, esperaMs) {
  var l = LockService.getScriptLock();
  l.waitLock(esperaMs || 25000);
  try {
    _mem = {}; _idx = {}; // depois de obter a trava, relê tudo: outra execução pode ter gravado enquanto esperávamos
    return fn();
  } finally { l.releaseLock(); }
}

/* ================================ utilidades ================================ */

function novoId_(p) { return p + Utilities.getUuid().replace(/-/g, '').substring(0, 10).toUpperCase(); }
function gerarSegredo_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').toLowerCase(); }
function hex_(bytes) { return bytes.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length < 2 ? '0' + v : v; }).join(''); }
function iguais_(a, b) { a = String(a); b = String(b); if (a.length !== b.length) return false; var d = 0; for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
function limitar_(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().substring(0, n); }
function chaveTexto_(v) { return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function emailValido_(e) { return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(String(e || '').trim()) && String(e).length <= 120; }
function sim_(v) { var s = String(v == null ? '' : v).trim().toLowerCase(); return s === 'sim' || s === 's' || s === 'true' || s === '1' || s === 'yes'; }
function simNao_(v) { return sim_(v) ? 'Sim' : 'Não'; }
function soDigitos_(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }
function esc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function corHex_(v, padrao) { return /^#[0-9a-fA-F]{6}$/.test(String(v || '').trim()) ? String(v).trim() : padrao; }
function urlHttpsValida_(u) { u = String(u || '').trim(); return u.length <= 500 && /^https:\/\/[^\s<>"'`]+$/.test(u); }
function csvCel_(v) {
  var t = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; // evita injeção de fórmula ao abrir no Excel
  return '"' + t.replace(/"/g, '""') + '"';
}
function htmlParaTexto_(html) {
  return String(html).replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|h1|h2|h3)>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

function cpfValido_(cpf) {
  var d = soDigitos_(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  var i, soma = 0, r;
  for (i = 0; i < 9; i++) soma += parseInt(d.charAt(i), 10) * (10 - i);
  r = (soma * 10) % 11; if (r === 10) r = 0;
  if (r !== parseInt(d.charAt(9), 10)) return false;
  soma = 0;
  for (i = 0; i < 10; i++) soma += parseInt(d.charAt(i), 10) * (11 - i);
  r = (soma * 10) % 11; if (r === 10) r = 0;
  return r === parseInt(d.charAt(10), 10);
}
function formatarCPF_(d) { d = soDigitos_(d); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : d; }
function mascararEmail_(e) {
  var p = String(e || '').split('@');
  if (p.length !== 2 || !p[0]) return '';
  return p[0].charAt(0) + '***@' + p[1];
}
function primeiroNome_(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }

/** Nome como será impresso no certificado. Devolve {ok, nome} ou {ok:false, mensagem}. */
function normalizarNome_(bruto) {
  var n = String(bruto == null ? '' : bruto).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (n.length < 5 || n.length > 120) return { ok: false, mensagem: 'Informe o nome completo, como deve aparecer no certificado.' };
  if (!/^[\p{L}][\p{L}\p{M}'’.\- ]*$/u.test(n) || n.split(' ').length < 2) return { ok: false, mensagem: 'Informe nome e sobrenome, usando apenas letras.' };
  // Só ajusta a capitalização quando o nome veio todo em maiúsculas ou todo em minúsculas.
  if (n === n.toUpperCase() || n === n.toLowerCase()) {
    var peq = { da: 1, de: 1, do: 1, das: 1, dos: 1, e: 1 };
    n = n.toLowerCase().split(' ').map(function (p, i) { return (i > 0 && peq[p]) ? p : p.charAt(0).toUpperCase() + p.substring(1); }).join(' ');
  }
  return { ok: true, nome: n };
}

/* ================================== tempo ================================== */

function tz_() { return Session.getScriptTimeZone() || 'America/Recife'; }
function fmt_(ms, p) { return Utilities.formatDate(new Date(ms), tz_(), p); }
function agoraTxt_() { return fmt_(Date.now(), 'dd/MM/yyyy HH:mm:ss'); }
function hojeTxt_() { return fmt_(Date.now(), 'dd/MM/yyyy'); }
/** "dd/MM/yyyy HH:mm" -> milissegundos (fuso do script) ou null. */
function parseDH_(txt) {
  var s = String(txt || '').trim();
  if (!/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/.test(s)) return null;
  try {
    var ms = Utilities.parseDate(s, tz_(), 'dd/MM/yyyy HH:mm').getTime();
    return fmt_(ms, 'dd/MM/yyyy HH:mm') === s ? ms : null; // recusa datas inexistentes (ex.: 31/02)
  } catch (e) { return null; }
}
function dataValida_(txt) { return parseDH_(String(txt || '').trim() + ' 00:00') !== null; }
function horaValida_(txt) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(txt || '').trim()); }
function horasNum_(v) {
  var n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
  return (isNaN(n) || n <= 0 || n > 24) ? null : Math.round(n * 100) / 100;
}
function horasTexto_(n) { n = Math.round(Number(n) * 100) / 100; return String(n).replace('.', ','); }

/* ============================== configuração ================================ */

function cfg_() {
  var cache = CacheService.getScriptCache(), bruto = cache.get('CFG_V');
  if (bruto) { try { return JSON.parse(bruto); } catch (e) { /* relê abaixo */ } }
  var c = {};
  Object.keys(CFG_PADRAO).forEach(function (k) { c[k] = CFG_PADRAO[k]; });
  lerTudo_('CONFIG').forEach(function (r) { if (r.chave in CFG_PADRAO) c[r.chave] = r.valor; });
  cache.put('CFG_V', JSON.stringify(c), 120);
  return c;
}
function salvarCfg_(chave, valor) {
  CacheService.getScriptCache().remove('CFG_V');
  var existente = lerTudo_('CONFIG').filter(function (r) { return r.chave === chave; })[0];
  if (existente) { existente.valor = String(valor); gravar_('CONFIG', existente); }
  else anexar_('CONFIG', { chave: chave, valor: String(valor) });
}
function inteiroCfg_(cfg, chave, padrao, min, max) {
  var n = parseInt(cfg[chave], 10);
  return (isNaN(n) || n < min || n > max) ? padrao : n;
}

/* ===================== cache de valores grandes (> 100 KB) ===================== */

function cachePutBig_(chave, obj, ttl) {
  var cache = CacheService.getScriptCache(), txt = JSON.stringify(obj), partes = [], n = 0;
  for (var i = 0; i < txt.length; i += 30000) partes.push(txt.substring(i, i + 30000)); // 30 mil caracteres: com acentos (2 bytes) fica bem abaixo dos 100 KB por valor do cache
  var pares = {};
  partes.forEach(function (p, k) { pares[chave + '#' + k] = p; });
  pares[chave + '#n'] = String(partes.length);
  cache.putAll(pares, ttl);
}
function cacheGetBig_(chave) {
  var cache = CacheService.getScriptCache(), n = parseInt(cache.get(chave + '#n') || '0', 10);
  if (!n) return null;
  var txt = '';
  for (var k = 0; k < n; k++) { var p = cache.get(chave + '#' + k); if (p == null) return null; txt += p; }
  try { return JSON.parse(txt); } catch (e) { return null; }
}
function cacheDelBig_(chave) {
  var cache = CacheService.getScriptCache(), n = parseInt(cache.get(chave + '#n') || '0', 10), ks = [chave + '#n'];
  for (var k = 0; k < n; k++) ks.push(chave + '#' + k);
  cache.removeAll(ks);
}

/* ===================== limitação de tentativas (anti-abuso) ===================== */

function contagem_(chave) { return parseInt(CacheService.getScriptCache().get(chave) || '0', 10); }
function contar_(chave, ttlSeg) { CacheService.getScriptCache().put(chave, String(contagem_(chave) + 1), ttlSeg); }

/* ============================================================================
 * SEÇÃO 2 — ACESSO: equipe, participantes, sessões, auditoria, usuários e e-mail
 * LIMITAÇÃO CONHECIDA: o Apps Script não tem PBKDF2 nativo. O hash abaixo (SHA-256 repetido 300 vezes com sal)
 * é o mesmo do Bootcamp e é mais fraco que o recomendado hoje. Compensações: senha forte obrigatória,
 * bloqueio por tentativas, planilha restrita à equipe. Se a planilha vazar, as senhas ficam expostas a ataque offline.
 * ============================================================================ */

/* ============================== senhas e sessões ============================== */

var ITERACOES_SENHA_ = 300;
var HASH_FALSO_ = 'v1$300$0123456789abcdef$0000000000000000000000000000000000000000000000000000000000000000';

function derivar_(senha, salt, it) {
  var h = salt + ':' + senha;
  for (var i = 0; i < it; i++) h = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + ':' + i));
  return h;
}
function criarHashSenha_(s) { var salt = gerarSegredo_().substring(0, 16); return 'v1$' + ITERACOES_SENHA_ + '$' + salt + '$' + derivar_(s, salt, ITERACOES_SENHA_); }
function confereSenha_(s, guardado) {
  var p = String(guardado || '').split('$');
  if (p.length !== 4 || p[0] !== 'v1') return false;
  return iguais_(derivar_(s, p[2], parseInt(p[1], 10)), p[3]);
}
function senhaForte_(s) { s = String(s || ''); return s.length >= 10 && s.length <= 100 && /[A-Za-z]/.test(s) && /\d/.test(s); }
function senhaTemporaria_() {
  var a = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789', s = '', i, h = gerarSegredo_();
  for (i = 0; i < 10; i++) s += a.charAt(parseInt(h.substring(i * 2, i * 2 + 2), 16) % a.length);
  return s + '7a';
}

var PREFIXO_SESSAO_ = { staff: 'S_', part: 'P_' }; // chaves separadas: um token de participante nunca vale como de equipe
function criarSessao_(tipo, dados) {
  var t = gerarSegredo_();
  dados.ts = Date.now();
  CacheService.getScriptCache().put(PREFIXO_SESSAO_[tipo] + t, JSON.stringify(dados), 21600);
  return t;
}
function sessao_(token, tipo) {
  var raw = token ? CacheService.getScriptCache().get(PREFIXO_SESSAO_[tipo] + String(token)) : null;
  if (!raw) throw new Error('SESSAO_EXPIRADA: entre de novo.');
  try { return JSON.parse(raw); } catch (e) { throw new Error('SESSAO_EXPIRADA: entre de novo.'); }
}
function salvarSessao_(token, tipo, dados) { CacheService.getScriptCache().put(PREFIXO_SESSAO_[tipo] + String(token), JSON.stringify(dados), 21600); }
function encerrarSessao_(token, tipo) { if (token) CacheService.getScriptCache().remove(PREFIXO_SESSAO_[tipo] + String(token)); }

/** Equipe: confere a sessão E o cadastro atual (usuário desativado perde o acesso na hora). */
function exigir_(token, papeis, permitirTroca) {
  var s = sessao_(token, 'staff');
  var u = indice_('USUARIOS', 'id')[s.id];
  if (!u || u.status !== 'Ativo') { encerrarSessao_(token, 'staff'); throw new Error('SESSAO_EXPIRADA: entre de novo.'); }
  if (s.trocar && !permitirTroca) throw new Error('TROCAR_SENHA: defina uma nova senha para continuar.');
  if (papeis && papeis.indexOf(u.papel) < 0) throw new Error('ACESSO_NEGADO: você não tem permissão para esta ação.');
  s.papel = u.papel; s.nome = u.nome; s.email = u.email;
  return s;
}
/** Participante: confere a sessão e devolve {s, p}. Enquanto a senha for temporária, só a troca de senha é aceita. */
function exigirParticipante_(token, permitirTroca) {
  var s = sessao_(token, 'part');
  var p = indice_('PARTICIPANTES', 'cpf')[s.cpf];
  if (!p) { encerrarSessao_(token, 'part'); throw new Error('SESSAO_EXPIRADA: entre de novo.'); }
  if (s.trocar && !permitirTroca) throw new Error('TROCAR_SENHA: defina uma nova senha para continuar.');
  return { s: s, p: p };
}

function auditar_(s, acao, entidade, detalhe) {
  try {
    anexar_('AUDITORIA', { quando: agoraTxt_(), usuario: s ? (s.nome || s.email || s.cpf || '') : 'sistema', papel: s ? (s.papel || (s.cpf ? 'participante' : '')) : '', acao: acao, entidade: entidade || '', detalhe: limitar_(detalhe, 300) });
  } catch (e) { Logger.log('Auditoria: ' + e); }
}

/* ============================= equipe: entrada e senha ============================= */

function entrar(email, senha) {
  var generico = { ok: false, mensagem: 'E-mail ou senha incorretos.' };
  email = String(email || '').trim().toLowerCase();
  if (!email || !senha) return generico;
  var chaveFalhas = 'LF_' + email;
  if (contagem_(chaveFalhas) >= 10) return { ok: false, mensagem: 'Muitas tentativas. Aguarde 10 minutos e tente de novo.' };
  var u = lerTudo_('USUARIOS').filter(function (x) { return x.email.toLowerCase() === email; })[0];
  if (!u || u.status !== 'Ativo') {
    confereSenha_(String(senha), HASH_FALSO_); // gasta o mesmo tempo para não revelar se o e-mail existe
    contar_(chaveFalhas, 600); Utilities.sleep(400); return generico;
  }
  var bloq = parseInt(u.bloqueadoAte || '0', 10);
  if (bloq && Date.now() < bloq) return { ok: false, mensagem: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' };
  if (!confereSenha_(String(senha), u.hash)) {
    u.tentativas = String((parseInt(u.tentativas || '0', 10) || 0) + 1);
    if (parseInt(u.tentativas, 10) >= 8) { u.bloqueadoAte = String(Date.now() + 600000); u.tentativas = '0'; }
    gravar_('USUARIOS', u);
    contar_(chaveFalhas, 600);
    return generico;
  }
  u.tentativas = '0'; u.bloqueadoAte = ''; gravar_('USUARIOS', u);
  var trocar = u.trocarSenha === 'Sim';
  var token = criarSessao_('staff', { id: u.id, trocar: trocar });
  auditar_({ nome: u.nome, papel: u.papel }, 'Login', 'usuário', '');
  return { ok: true, token: token, usuario: { nome: u.nome, email: u.email, papel: u.papel }, trocarSenha: trocar };
}
function sair(token) { encerrarSessao_(token, 'staff'); return { ok: true }; }
function trocarSenha(token, atual, nova) {
  var s = exigir_(token, null, true);
  var u = indice_('USUARIOS', 'id')[s.id];
  if (!u || !confereSenha_(String(atual || ''), u.hash)) return { ok: false, mensagem: 'A senha atual não confere.' };
  if (!senhaForte_(nova)) return { ok: false, mensagem: 'A nova senha precisa de pelo menos 10 caracteres, com letras e números.' };
  if (String(nova) === String(atual)) return { ok: false, mensagem: 'Escolha uma senha diferente da atual.' };
  u.hash = criarHashSenha_(String(nova)); u.trocarSenha = 'Não'; gravar_('USUARIOS', u);
  salvarSessao_(token, 'staff', { id: s.id, trocar: false, ts: Date.now() });
  auditar_(s, 'Troca de senha', 'usuário', '');
  return { ok: true, mensagem: 'Senha alterada.' };
}
function eu(token) {
  var s = exigir_(token, null, true);
  var sessaoAtual = sessao_(token, 'staff');
  return { ok: true, usuario: { nome: s.nome, email: s.email, papel: s.papel }, trocarSenha: !!sessaoAtual.trocar };
}

/* ============================ equipe: gestão de usuários ============================ */

function listarUsuarios(token) {
  exigir_(token, ['admin']);
  return { ok: true, usuarios: lerTudo_('USUARIOS').map(function (u) { return { id: u.id, nome: u.nome, email: u.email, papel: u.papel, status: u.status, criadoEm: u.criadoEm }; }), papeis: PAPEIS };
}
function adminsAtivos_() { return lerTudo_('USUARIOS').filter(function (u) { return u.papel === 'admin' && u.status === 'Ativo'; }); }

function salvarUsuario(token, d) {
  var s = exigir_(token, ['admin']);
  d = d || {};
  var nome = limitar_(d.nome, 100), email = String(d.email || '').trim().toLowerCase(), papel = String(d.papel || '');
  if (nome.length < 3) return { ok: false, mensagem: 'Informe o nome da pessoa.' };
  if (!emailValido_(email)) return { ok: false, mensagem: 'E-mail inválido.' };
  if (PAPEIS.indexOf(papel) < 0) return { ok: false, mensagem: 'Escolha o perfil: administrador ou facilitador.' };
  var status = d.status === 'Inativo' ? 'Inativo' : 'Ativo';
  return comTrava_(function () {
    var todos = lerTudo_('USUARIOS');
    if (d.id) {
      var u = todos.filter(function (x) { return x.id === d.id; })[0];
      if (!u) return { ok: false, mensagem: 'Usuário não encontrado.' };
      if (todos.some(function (x) { return x.id !== u.id && x.email.toLowerCase() === email; })) return { ok: false, mensagem: 'Já existe um usuário com este e-mail.' };
      var seraAdminAtivo = papel === 'admin' && status === 'Ativo';
      if (u.papel === 'admin' && u.status === 'Ativo' && !seraAdminAtivo && adminsAtivos_().length <= 1) return { ok: false, mensagem: 'O sistema precisa de pelo menos um administrador ativo.' };
      u.nome = nome; u.email = email; u.papel = papel; u.status = status; gravar_('USUARIOS', u);
      auditar_(s, 'Usuário alterado', u.email, 'perfil ' + papel + ', ' + status);
      return { ok: true, mensagem: 'Usuário atualizado.' };
    }
    if (todos.some(function (x) { return x.email.toLowerCase() === email; })) return { ok: false, mensagem: 'Já existe um usuário com este e-mail.' };
    var temp = senhaTemporaria_();
    anexar_('USUARIOS', { id: novoId_('U'), nome: nome, email: email, papel: papel, hash: criarHashSenha_(temp), trocarSenha: 'Sim', status: 'Ativo', criadoEm: agoraTxt_(), tentativas: '0', bloqueadoAte: '' });
    auditar_(s, 'Usuário criado', email, 'perfil ' + papel);
    return entregarSenhaEquipe_(nome, email, temp, 'Usuário criado.');
  });
}
function redefinirSenhaUsuario(token, id) {
  var s = exigir_(token, ['admin']);
  return comTrava_(function () {
    var u = indice_('USUARIOS', 'id')[id];
    if (!u) return { ok: false, mensagem: 'Usuário não encontrado.' };
    var temp = senhaTemporaria_();
    u.hash = criarHashSenha_(temp); u.trocarSenha = 'Sim'; u.tentativas = '0'; u.bloqueadoAte = ''; gravar_('USUARIOS', u);
    auditar_(s, 'Senha redefinida', u.email, '');
    return entregarSenhaEquipe_(u.nome, u.email, temp, 'Senha redefinida.');
  });
}
/** Envia a senha temporária por e-mail. Só devolve a senha ao administrador se o e-mail falhar (ela é mostrada uma única vez). */
function entregarSenhaEquipe_(nome, email, temp, msgBase) {
  var cfg = cfg_(), url = getUrlApp_(cfg), enviado = false;
  try {
    var corpo = '<p style="margin:0 0 12px 0;font-size:15px;line-height:1.5;">Olá, <strong>' + esc_(nome) + '</strong>! Você recebeu acesso ao painel do evento <strong>' + esc_(cfg[CFG.NOME]) + '</strong>.</p>' +
      '<p style="margin:0 0 12px 0;font-size:15px;line-height:1.5;">Entre com este e-mail e a senha temporária abaixo. O sistema pede uma nova senha no primeiro acesso.</p>' +
      '<p style="margin:0 0 12px 0;font-size:18px;"><strong style="font-family:monospace;">' + esc_(temp) + '</strong></p>';
    enviado = enviarEmail_(email, 'Seu acesso ao painel: ' + String(cfg[CFG.NOME]), montarEmailHTML_(cfg, 'Acesso ao painel', corpo, url ? { url: url, texto: 'Abrir o painel' } : null));
  } catch (e) { Logger.log('E-mail de acesso da equipe: ' + e); }
  if (enviado) return { ok: true, mensagem: msgBase + ' A senha temporária foi enviada por e-mail.' };
  return { ok: true, mensagem: msgBase + ' Não foi possível enviar o e-mail: repasse a senha temporária abaixo (ela não será mostrada de novo).', senhaTemporaria: temp };
}
function listarAuditoria(token, f) {
  exigir_(token, ['admin']);
  f = f || {};
  var busca = chaveTexto_(f.busca), tam = 50, pag = Math.max(1, parseInt(f.pagina, 10) || 1);
  var lista = lerTudo_('AUDITORIA').slice().reverse().filter(function (a) { return !busca || chaveTexto_(a.usuario + ' ' + a.acao + ' ' + a.entidade + ' ' + a.detalhe).indexOf(busca) >= 0; });
  return { ok: true, total: lista.length, pagina: pag, tamanho: tam, itens: lista.slice((pag - 1) * tam, pag * tam).map(function (a) { return { quando: a.quando, usuario: a.usuario, papel: a.papel, acao: a.acao, entidade: a.entidade, detalhe: a.detalhe }; }) };
}

/* ============================ participante: entrada e senha ============================ */

function entrarParticipante(cpf, senha) {
  var generico = { ok: false, mensagem: 'CPF ou senha incorretos.' };
  var d = soDigitos_(cpf);
  if (!cpfValido_(d) || !senha || String(senha).length > 100) return generico;
  var chaveF = 'LP_' + d;
  if (contagem_(chaveF) >= 8) return { ok: false, mensagem: 'Muitas tentativas. Aguarde 10 minutos e tente de novo.' };
  var p = indice_('PARTICIPANTES', 'cpf')[d], ok = false, trocar = false;
  if (!p) confereSenha_(String(senha), HASH_FALSO_);
  else if (p.hash && confereSenha_(String(senha), p.hash)) ok = true;
  else if (p.tempHash && Date.now() < parseInt(p.tempExpira || '0', 10) && confereSenha_(String(senha), p.tempHash)) { ok = true; trocar = true; }
  else if (!p.hash) confereSenha_(String(senha), HASH_FALSO_);
  if (!ok) { contar_(chaveF, 600); Utilities.sleep(400); return generico; }
  var token = criarSessao_('part', { cpf: d, trocar: trocar });
  return { ok: true, token: token, trocarSenha: trocar, precisaLgpd: !p.lgpd, nome: primeiroNome_(p.nome) };
}
function sairParticipante(token) { encerrarSessao_(token, 'part'); return { ok: true }; }

/** Troca a senha. Na primeira troca, quem veio de importação ou cadastro manual também aceita a LGPD aqui. */
function trocarSenhaParticipante(token, atual, nova, aceiteLgpd) {
  var ctx = exigirParticipante_(token, true), s = ctx.s;
  return comTrava_(function () {
    var p = indice_('PARTICIPANTES', 'cpf')[s.cpf];
    if (!p) return { ok: false, mensagem: 'Cadastro não encontrado.' };
    atual = String(atual || '');
    var okAtual = (p.hash && confereSenha_(atual, p.hash)) ||
      (p.tempHash && Date.now() < parseInt(p.tempExpira || '0', 10) && confereSenha_(atual, p.tempHash));
    if (!okAtual) return { ok: false, mensagem: 'A senha atual não confere.' };
    if (!senhaForte_(nova)) return { ok: false, mensagem: 'A nova senha precisa de pelo menos 10 caracteres, com letras e números.' };
    if (String(nova) === atual) return { ok: false, mensagem: 'Escolha uma senha diferente da atual.' };
    if (!p.lgpd && !sim_(aceiteLgpd)) return { ok: false, mensagem: 'É necessário aceitar o tratamento dos seus dados (LGPD) para continuar.' };
    p.hash = criarHashSenha_(String(nova)); p.tempHash = ''; p.tempExpira = '';
    if (!p.lgpd) p.lgpd = agoraTxt_();
    p.atualizadoEm = agoraTxt_();
    gravar_('PARTICIPANTES', p);
    salvarSessao_(token, 'part', { cpf: s.cpf, trocar: false, ts: Date.now() });
    auditar_({ cpf: s.cpf }, 'Troca de senha', 'participante', '');
    return { ok: true, mensagem: 'Senha alterada.' };
  });
}

/**
 * Recuperação de senha: resposta sempre igual, exista o CPF ou não (não revela cadastro).
 * A senha atual continua valendo até a pessoa usar a temporária e trocá-la; assim, quem só digita o CPF de outra pessoa
 * não consegue travá-la fora da própria conta.
 */
function esqueciSenha(cpf) {
  var resposta = { ok: true, mensagem: 'Se este CPF estiver cadastrado, enviamos uma senha temporária para o e-mail da inscrição. Ela vale por 1 hora.' };
  var d = soDigitos_(cpf);
  if (!cpfValido_(d)) return { ok: false, mensagem: 'CPF inválido. Confira os números digitados.' };
  var kCpf = 'RS_' + d, kGlobal = 'RS_G';
  if (contagem_(kCpf) >= 3 || contagem_(kGlobal) >= 300) return resposta;
  contar_(kCpf, 3600); contar_(kGlobal, 3600);
  var p = indice_('PARTICIPANTES', 'cpf')[d];
  if (!p || !emailValido_(p.email)) return resposta;
  var cfg = cfg_(), temp = senhaTemporaria_();
  comTrava_(function () {
    var q = indice_('PARTICIPANTES', 'cpf')[d];
    q.tempHash = criarHashSenha_(temp); q.tempExpira = String(Date.now() + 3600000); q.atualizadoEm = agoraTxt_();
    gravar_('PARTICIPANTES', q);
  });
  try { enviarEmailSenhaParticipante_(cfg, p, temp, 'Recuperação de senha', 'Você pediu para recuperar a senha da sua área do participante. Use a senha temporária abaixo (vale por 1 hora). Se não foi você, ignore este e-mail: a sua senha atual continua valendo.'); }
  catch (e) { Logger.log('E-mail de recuperação: ' + e); }
  auditar_({ cpf: d }, 'Recuperação de senha solicitada', 'participante', '');
  return resposta;
}

/* ================================== e-mail ================================== */

function limparUrlApp_(u) { return String(u || '').trim().replace(/\/macros\/u\/\d+\//, '/macros/'); }
/** Endereço principal (Netlify). Se ainda não foi informado, usa o do Apps Script. */
function getUrlApp_(cfg) {
  var u = limparUrlApp_(cfg[CFG.APP]);
  if (/^https:\/\//i.test(u)) return u;
  try { return limparUrlApp_(ScriptApp.getService().getUrl()); } catch (e) { return ''; }
}
function idArquivoDrive_(url) {
  var m = String(url || '').trim().match(/^https:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([A-Za-z0-9_-]{15,})/);
  return m ? m[1] : '';
}
function urlImagemDireta_(url) { var id = idArquivoDrive_(url); return id ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600' : String(url || '').trim(); }
function urlImagemAlternativa_(url) { var id = idArquivoDrive_(url); return id ? 'https://lh3.googleusercontent.com/d/' + id + '=w1600' : ''; }

function montarEmailHTML_(cfg, titulo, blocosHtml, botao) {
  var cor = corHex_(cfg[CFG.COR1], '#D25600'), cor2 = corHex_(cfg[CFG.COR2], '#375B95'), h = '';
  h += '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>';
  h += '<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">';
  h += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 12px;"><tr><td align="center">';
  h += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;">';
  var banner = urlImagemDireta_(cfg[CFG.BANNER]);
  if (/^https:\/\//i.test(banner)) {
    h += '<tr><td style="background:' + cor2 + ';padding:0;font-size:0;line-height:0;color:#ffffff;"><img src="' + esc_(banner) + '" alt="' + esc_(cfg[CFG.NOME]) + '" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;font-size:16px;line-height:1.4;color:#ffffff;"></td></tr>';
  } else {
    h += '<tr><td style="background:' + cor2 + ';padding:22px 28px;color:#ffffff;font-size:13px;">' + esc_(cfg[CFG.NOME]) + '</td></tr>';
  }
  h += '<tr><td style="padding:28px;"><h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.3;color:' + cor2 + ';">' + titulo + '</h1>' + blocosHtml;
  if (botao && botao.url) h += '<p style="margin:26px 0 0 0;"><a href="' + esc_(botao.url) + '" style="background:' + cor + ';color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:bold;display:inline-block;">' + esc_(botao.texto) + '</a></p>';
  h += '</td></tr><tr><td style="padding:16px 28px;background:#f4f5f7;color:#6b7280;font-size:12px;">Mensagem automática da Plataforma de Eventos CISSA. Não é necessário responder.</td></tr></table></td></tr></table></body></html>';
  return h;
}
/** Envia um e-mail. Registra falhas no log e devolve true/false. Nunca lança erro. */
function enviarEmail_(para, assunto, html) {
  try {
    if (!emailValido_(para)) return false;
    if (MailApp.getRemainingDailyQuota() < 1) { Logger.log('Cota diária de e-mails esgotada.'); return false; }
    MailApp.sendEmail({ name: NOME_REMETENTE, to: String(para).trim(), subject: assunto, htmlBody: html, body: htmlParaTexto_(html) });
    return true;
  } catch (e) { Logger.log('Falha de envio para ' + mascararEmail_(para) + ': ' + e); return false; }
}
/** E-mail com a senha temporária do participante (primeiro acesso ou recuperação). */
function enviarEmailSenhaParticipante_(cfg, p, temp, titulo, intro, extraHtml) {
  var url = getUrlApp_(cfg);
  var corpo = '<p style="margin:0 0 12px 0;font-size:15px;line-height:1.5;">Olá, <strong>' + esc_(primeiroNome_(p.nome)) + '</strong>!</p>' +
    '<p style="margin:0 0 12px 0;font-size:15px;line-height:1.5;">' + esc_(intro) + '</p>' +
    '<p style="margin:0 0 6px 0;font-size:14px;color:#4b5563;">Evento: <strong>' + esc_(cfg[CFG.NOME]) + '</strong></p>' + (extraHtml || '') +
    '<p style="margin:0 0 12px 0;font-size:18px;">Senha temporária: <strong style="font-family:monospace;">' + esc_(temp) + '</strong></p>' +
    '<p style="margin:0;font-size:14px;line-height:1.5;color:#4b5563;">Para entrar na sua área do participante, informe o seu CPF e esta senha. O sistema vai pedir que você crie uma senha nova.</p>';
  return enviarEmail_(p.email, titulo + ': ' + String(cfg[CFG.NOME]), montarEmailHTML_(cfg, titulo, corpo, url ? { url: url, texto: 'Acessar minha área' } : null));
}

/* ============================================================================
 * SEÇÃO 3 — DIAS E PRESENÇA: dias, códigos, janela, registro de presença e presença manual
 * REGRA DA JANELA (calculada pelo relógio do servidor a cada requisição, sem depender de gatilho):
 *   abre  = término da aula − "minutos antes" (padrão 10)
 *   fecha = término da aula + "minutos depois" (padrão 10)
 * O administrador ou o facilitador pode forçar "Aberta" ou "Fechada" por um dia; a decisão manual expira sozinha
 * 24 h depois do término da aula, para nunca ficar aberta por esquecimento.
 * ============================================================================ */

/* ================================== dias ================================== */

function normalizarCodigo_(c) { return String(c == null ? '' : c).toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 12); }

function janelaDia_(d, cfg) {
  var ini = parseDH_(d.data + ' ' + d.inicio), fim = parseDH_(d.data + ' ' + d.fim);
  var antes = inteiroCfg_(cfg, CFG.MIN_ANTES, 10, 0, 240), depois = inteiroCfg_(cfg, CFG.MIN_DEPOIS, 10, 0, 240);
  return { iniMs: ini, fimMs: fim, aberturaMs: fim === null ? null : fim - antes * 60000, encerraMs: fim === null ? null : fim + depois * 60000 };
}
/** Estado para registro de presença: Cancelado | Programada | Aberta | Fechada (manual) | Encerrada. */
function estadoDia_(d, cfg, agora) {
  if (d.status === 'Cancelado') return 'Cancelado';
  var j = janelaDia_(d, cfg);
  if (j.iniMs === null || j.fimMs === null) return 'Programada';
  var jan = d.janela || 'Auto', ate = parseInt(d.janelaAte || '0', 10);
  if ((jan === 'Aberta' || jan === 'Fechada') && agora < ate) return jan === 'Aberta' ? 'Aberta' : 'Fechada';
  if (agora < j.aberturaMs) return 'Programada';
  if (agora <= j.encerraMs) return 'Aberta';
  return 'Encerrada';
}
function msInicioDia_(d) { var m = parseDH_(d.data + ' ' + d.inicio); return m === null ? 0 : m; }
function todosDiasOrdenados_() { return lerTudo_('DIAS').slice().sort(function (a, b) { return msInicioDia_(a) - msInicioDia_(b); }); }
function diasAtivos_() { return todosDiasOrdenados_().filter(function (d) { return d.status !== 'Cancelado'; }); }
function eventoEncerrado_(cfg, agora) {
  var dias = diasAtivos_();
  if (!dias.length) return false;
  return dias.every(function (d) { var j = janelaDia_(d, cfg); return j.encerraMs !== null && agora > j.encerraMs && estadoDia_(d, cfg, agora) !== 'Aberta'; });
}

function codigoPersonalizadoValido_(c) {
  if (c.length < 6 || c.length > 12) return 'O código deve ter de 6 a 12 letras ou números.';
  var distintos = {};
  c.split('').forEach(function (ch) { distintos[ch] = 1; });
  if (Object.keys(distintos).length < 3) return 'Use um código com pelo menos 3 caracteres diferentes.';
  if (/^\d+$/.test(c) && c.length < 8) return 'Códigos só com números precisam ter 8 dígitos ou mais. Misture letras e números.';
  if (['123456', 'ABCDEF', 'QWERTY', 'SENHA1', 'ABC123', 'CODIGO', 'PASSWORD', 'ABCD1234', 'ABC1234'].indexOf(c) >= 0) return 'Esse código é fácil de adivinhar. Escolha outro.';
  return '';
}
function gerarCodigoDia_(existentes) {
  for (var t = 0; t < 60; t++) {
    var c = '', h = gerarSegredo_();
    for (var i = 0; i < 6; i++) c += ALFABETO_CODIGO.charAt(parseInt(h.substring(i * 2, i * 2 + 2), 16) % ALFABETO_CODIGO.length);
    if (!existentes[c]) return c;
  }
  throw new Error('Não foi possível gerar um código único.');
}
function codigosEmUso_(excetoId) {
  var m = {};
  lerTudo_('DIAS').forEach(function (d) { if (d.id !== excetoId) m[d.codigo] = true; });
  return m;
}
function diaPorCodigo_(codigo) { return lerTudo_('DIAS').filter(function (d) { return d.codigo === codigo; })[0] || null; }

function contagemPresencasPorDia_() {
  var m = {};
  lerTudo_('PRESENCAS').forEach(function (r) { if (r.status === 'Valida') m[r.diaId] = (m[r.diaId] || 0) + 1; });
  return m;
}
function descreverDiaEquipe_(d, cfg, agora, cont) {
  var j = janelaDia_(d, cfg);
  return {
    id: d.id, data: d.data, inicio: d.inicio, fim: d.fim, horas: d.horas, titulo: d.titulo, codigo: d.codigo, janela: d.janela || 'Auto',
    link: d.link, senhaSala: d.senhaSala, status: d.status, estado: estadoDia_(d, cfg, agora),
    abreEm: j.aberturaMs === null ? '' : fmt_(j.aberturaMs, 'HH:mm'), fechaEm: j.encerraMs === null ? '' : fmt_(j.encerraMs, 'dd/MM HH:mm'),
    presencas: cont[d.id] || 0, codigoEnviado: !!d.codigoEnviadoEm
  };
}
function listarDias(token) {
  exigir_(token, PAPEIS);
  var cfg = cfg_(), agora = Date.now(), cont = contagemPresencasPorDia_();
  var temCert = lerTudo_('PARTICIPANTES').some(function (p) { return !!p.certCodigo; });
  return { ok: true, dias: todosDiasOrdenados_().map(function (d) { return descreverDiaEquipe_(d, cfg, agora, cont); }), certificadosEmitidos: temCert };
}

function salvarDia(token, d) {
  var s = exigir_(token, PAPEIS);
  d = d || {};
  var data = String(d.data || '').trim(), ini = String(d.inicio || '').trim(), fim = String(d.fim || '').trim();
  var horas = horasNum_(d.horas), titulo = limitar_(d.titulo, 100);
  if (!dataValida_(data)) return { ok: false, mensagem: 'Data inválida. Use o formato DD/MM/AAAA.' };
  if (!horaValida_(ini) || !horaValida_(fim)) return { ok: false, mensagem: 'Informe horários válidos (HH:MM).' };
  if (parseDH_(data + ' ' + fim) <= parseDH_(data + ' ' + ini)) return { ok: false, mensagem: 'O término precisa ser depois do início.' };
  if (horas === null) return { ok: false, mensagem: 'Informe a carga horária do dia, entre 0,5 e 24 horas.' };
  var link = String(d.link || '').trim(), senhaSala = limitar_(d.senhaSala, 100);
  if (link && !urlHttpsValida_(link)) return { ok: false, mensagem: 'O link da transmissão deve começar com https://' };
  var status = d.status === 'Cancelado' ? 'Cancelado' : 'Ativo';

  return comTrava_(function () {
    var existente = d.id ? indice_('DIAS', 'id')[d.id] : null;
    if (d.id && !existente) return { ok: false, mensagem: 'Dia não encontrado.' };
    var temCert = lerTudo_('PARTICIPANTES').some(function (p) { return !!p.certCodigo; });
    var mudouTempo = !!existente && (existente.data !== data || existente.inicio !== ini || existente.fim !== fim || horasNum_(existente.horas) !== horas || existente.status !== status);
    if (mudouTempo && temCert && s.papel !== 'admin') {
      return { ok: false, mensagem: 'Já existem certificados emitidos. Só o administrador pode alterar data, horário, carga horária ou cancelar um dia.' };
    }
    var emUso = codigosEmUso_(existente ? existente.id : ''), cod = normalizarCodigo_(d.codigo);
    if (d.gerarCodigo || (!existente && !cod)) cod = gerarCodigoDia_(emUso);
    else if (!cod && existente) cod = existente.codigo;
    else {
      var erroCod = codigoPersonalizadoValido_(cod);
      if (erroCod && !(existente && cod === existente.codigo)) return { ok: false, mensagem: erroCod };
      if (emUso[cod]) return { ok: false, mensagem: 'Este código já é usado em outro dia. Escolha outro.' };
    }
    var o = existente || { id: novoId_('D'), janela: 'Auto', janelaAte: '', codigoEnviadoEm: '', criadoEm: agoraTxt_() };
    var mudouCodigo = !!existente && existente.codigo !== cod;
    o.data = data; o.inicio = ini; o.fim = fim; o.horas = String(horas); o.titulo = titulo; o.codigo = cod;
    o.link = link; o.senhaSala = senhaSala; o.status = status;
    if (mudouCodigo || (existente && mudouTempo)) o.codigoEnviadoEm = ''; // a equipe recebe o código de novo quando a presença abrir
    if (existente) gravar_('DIAS', o); else anexar_('DIAS', o);
    auditar_(s, existente ? 'Dia alterado' : 'Dia criado', data, 'código ' + (mudouCodigo || !existente ? 'definido' : 'mantido') + ', ' + horas + ' h');
    return { ok: true, mensagem: existente ? 'Dia atualizado.' : 'Dia adicionado.', id: o.id, codigo: cod };
  });
}
function excluirDia(token, id) {
  var s = exigir_(token, ['admin']);
  return comTrava_(function () {
    var dia = indice_('DIAS', 'id')[id];
    if (!dia) return { ok: false, mensagem: 'Dia não encontrado.' };
    if (lerTudo_('PRESENCAS').some(function (r) { return r.diaId === id; })) return { ok: false, mensagem: 'Este dia já tem presenças registradas. Cancele o dia em vez de excluí-lo.' };
    apagarLinhas_('DIAS', [dia.__linha]);
    auditar_(s, 'Dia excluído', dia.data, '');
    return { ok: true, mensagem: 'Dia excluído.' };
  });
}
/** Força a janela de presença de um dia: 'Aberta', 'Fechada' ou 'Auto' (volta à regra normal). */
function alterarJanelaDia(token, id, modo) {
  var s = exigir_(token, PAPEIS);
  if (['Auto', 'Aberta', 'Fechada'].indexOf(modo) < 0) return { ok: false, mensagem: 'Modo inválido.' };
  return comTrava_(function () {
    var d = indice_('DIAS', 'id')[id];
    if (!d) return { ok: false, mensagem: 'Dia não encontrado.' };
    if (d.status === 'Cancelado') return { ok: false, mensagem: 'Este dia está cancelado.' };
    var j = janelaDia_(d, cfg_());
    d.janela = modo; d.janelaAte = modo === 'Auto' || j.fimMs === null ? '' : String(j.fimMs + 24 * 3600000);
    gravar_('DIAS', d);
    auditar_(s, 'Janela de presença', d.data, modo);
    return { ok: true, mensagem: modo === 'Auto' ? 'A janela voltou ao horário normal.' : 'Janela marcada como ' + modo.toLowerCase() + ' até 24 h após o término da aula.' };
  });
}

/* ================================ público ================================ */

function listaNomes_(txt) { return String(txt || '').split(';').map(function (n) { return n.trim(); }).filter(Boolean); }

/** Dados públicos do evento (nunca inclui códigos, links de transmissão nem senhas). */
function obterConfigPublica() {
  var cfg = cfg_(), agora = Date.now();
  var dias = diasAtivos_().map(function (d, i) {
    return { ordem: i + 1, data: d.data, inicio: d.inicio, fim: d.fim, horas: d.horas, titulo: d.titulo };
  });
  var tot = 0;
  dias.forEach(function (d) { tot += horasNum_(d.horas) || 0; });
  var banner = /^https:\/\//i.test(cfg[CFG.BANNER]) ? cfg[CFG.BANNER] : '';
  var formAtivo = sim_(cfg[CFG.FORM_ATIVO]), ab = inscricoesAbertas_(cfg, agora);
  return {
    ok: true, versao: VERSAO, statusEvento: cfg[CFG.STATUS], nome: cfg[CFG.NOME],
    subtitulo: sim_(cfg[CFG.EXIBIR_SUBTITULO]) ? cfg[CFG.SUBTITULO] : '',
    facilitadores: listaNomes_(cfg[CFG.FACILITADORES]), local: sim_(cfg[CFG.EXIBIR_LOCAL]) ? cfg[CFG.LOCAL] : '', observacoes: cfg[CFG.OBS],
    banner: banner ? urlImagemDireta_(banner) : '', bannerAlt: banner ? urlImagemAlternativa_(banner) : '',
    corPrimaria: corHex_(cfg[CFG.COR1], '#D25600'), corSecundaria: corHex_(cfg[CFG.COR2], '#375B95'),
    dias: dias, horasTotais: Math.round(tot * 100) / 100, encerrado: eventoEncerrado_(cfg, agora),
    minutosAntes: inteiroCfg_(cfg, CFG.MIN_ANTES, 10, 0, 240), minutosDepois: inteiroCfg_(cfg, CFG.MIN_DEPOIS, 10, 0, 240),
    formulario: { ativo: formAtivo, abertas: ab.abertas, motivo: formAtivo ? ab.motivo : '', ate: formAtivo ? cfg[CFG.INSCR_ATE] : '', campos: formAtivo ? camposFormulario_(false).map(campoPublico_) : [] }
  };
}

/* ============================ presença: CPF primeiro ============================ */

/**
 * Primeira etapa da tela do aluno: só o CPF. Diz qual caminho seguir, sem revelar nome nem e-mail completo.
 * Limitada por CPF para dificultar a verificação em massa de quem está cadastrado.
 */
function verificarCpf(cpf) {
  var d = soDigitos_(cpf);
  if (!cpfValido_(d)) return { ok: false, mensagem: 'CPF inválido. Confira os números digitados.' };
  if (contagem_('VC_' + d) >= 20 || contagem_('VC_G') >= 4000) return { ok: false, mensagem: 'Muitas consultas. Aguarde alguns minutos.' };
  contar_('VC_' + d, 600); contar_('VC_G', 600);
  var cfg = cfg_(), p = indice_('PARTICIPANTES', 'cpf')[d];
  if (!p) {
    if (!sim_(cfg[CFG.FORA_LISTA])) return { ok: false, codigo: 'FORA_DA_LISTA', mensagem: 'Este CPF não consta na lista de participantes. Procure a organização do evento.' };
    return { ok: true, caminho: 'novo' };
  }
  return { ok: true, caminho: 'registrado', pedirEmail: !emailValido_(p.email), pedirLgpd: !p.lgpd, emailMascarado: mascararEmail_(p.email) };
}

function presencaDe_(cpf, diaId) { return indice_('PRESENCAS', 'chave')[cpf + '|' + diaId] || null; }

/** Se a pessoa ainda não tem senha e há e-mail, reserva o envio (feito dentro da trava) para que só um processo envie. */
function reivindicarEnvioSenha_(p) {
  if (p.hash || !emailValido_(p.email)) return false;
  var st = p.envioSenha || '';
  var velho = st.indexOf('Enviando|') === 0 && Date.now() - parseInt(st.split('|')[1], 10) > 600000;
  if (st === '' || st === 'Pendente' || velho) { p.envioSenha = 'Enviando|' + Date.now(); return true; }
  return false;
}

function registrarPresenca(d) {
  d = (d && typeof d === 'object') ? d : {};
  var FALHA = { ok: false, codigo: 'FALHA', mensagem: 'Não foi possível registrar a presença. Confira o CPF e o código da aula.' };
  var cfg = cfg_();
  if (cfg[CFG.STATUS] === 'Pendente') return { ok: false, codigo: 'EVENTO_PENDENTE', mensagem: 'O registro de presença deste evento ainda não foi aberto.' };
  var cpf = soDigitos_(d.cpf), codigo = normalizarCodigo_(d.codigo);
  if (!cpfValido_(cpf)) return { ok: false, codigo: 'CPF', mensagem: 'CPF inválido. Confira os números digitados.' };
  if (codigo.length < 4) return { ok: false, codigo: 'FORMATO', mensagem: 'Informe o código da aula, passado pelo facilitador.' };
  if (contagem_('PF_' + cpf) >= 6 || contagem_('PF_G') >= 3000) return { ok: false, codigo: 'TENTATIVAS', mensagem: 'Muitas tentativas. Aguarde alguns minutos ou procure a organização.' };
  var falhar = function () { contar_('PF_' + cpf, 600); contar_('PF_G', 600); return FALHA; };

  var dia = diaPorCodigo_(codigo);
  if (!dia) return falhar();
  var agora = Date.now(), estado = estadoDia_(dia, cfg, agora), j = janelaDia_(dia, cfg);
  if (estado === 'Cancelado') return { ok: false, codigo: 'INDISPONIVEL', mensagem: 'Este encontro não está disponível para registro.' };
  if (estado === 'Programada') return { ok: false, codigo: 'NAO_ABERTA', mensagem: 'O registro de presença ainda não abriu. Abre em ' + fmt_(j.aberturaMs, 'dd/MM') + ' às ' + fmt_(j.aberturaMs, 'HH:mm') + '.' };
  if (estado !== 'Aberta') return { ok: false, codigo: 'ENCERRADA', mensagem: 'O registro de presença deste encontro foi encerrado. Procure a organização.' };

  var resultado;
  try {
    resultado = comTrava_(function () {
      var p = indice_('PARTICIPANTES', 'cpf')[cpf], existiaAntes = !!p;
      if (!p) {
        if (!sim_(cfg[CFG.FORA_LISTA])) return { ok: false, codigo: 'FORA_DA_LISTA', mensagem: 'Este CPF não consta na lista de participantes. Procure a organização do evento.' };
        var email = String(d.email || '').trim(), email2 = String(d.email2 || '').trim();
        if (!emailValido_(email)) return { ok: false, codigo: 'DADOS', mensagem: 'Informe um e-mail válido.' };
        if (email.toLowerCase() !== email2.toLowerCase()) return { ok: false, codigo: 'DADOS', mensagem: 'Os dois e-mails digitados são diferentes.' };
        var nm = normalizarNome_(d.nome);
        if (!nm.ok) return { ok: false, codigo: 'DADOS', mensagem: nm.mensagem };
        if (!sim_(d.lgpd)) return { ok: false, codigo: 'LGPD', mensagem: 'É necessário aceitar o tratamento dos seus dados (LGPD) para registrar a presença.' };
        p = anexar_('PARTICIPANTES', { cpf: cpf, nome: nm.nome, email: email, origem: 'Portal', lgpd: agoraTxt_(), envioSenha: 'Pendente', criadoEm: agoraTxt_(), atualizadoEm: agoraTxt_() });
      } else {
        var mudou = false;
        if (!emailValido_(p.email)) {
          var em = String(d.email || '').trim(), em2 = String(d.email2 || '').trim();
          if (!emailValido_(em) || em.toLowerCase() !== em2.toLowerCase()) return { ok: false, codigo: 'DADOS', mensagem: 'Informe o seu e-mail duas vezes, igual nos dois campos.' };
          p.email = em; mudou = true;
        }
        if (!p.lgpd) {
          if (!sim_(d.lgpd)) return { ok: false, codigo: 'LGPD', mensagem: 'É necessário aceitar o tratamento dos seus dados (LGPD) para registrar a presença.' };
          p.lgpd = agoraTxt_(); mudou = true;
        }
        if (mudou) { p.atualizadoEm = agoraTxt_(); gravar_('PARTICIPANTES', p); }
      }
      var ex = presencaDe_(cpf, dia.id);
      if (ex) {
        if (ex.status === 'Valida') return { ok: true, codigo: 'JA_REGISTRADA', dia: { data: dia.data, titulo: dia.titulo, horas: dia.horas }, nome: primeiroNome_(p.nome), horario: ex.horario.substring(11, 16), mensagem: 'Sua presença neste encontro já estava registrada.' };
        return FALHA; // removida pela organização: só ela pode reativar
      }
      var quando = agoraTxt_();
      anexar_('PRESENCAS', { chave: cpf + '|' + dia.id, diaId: dia.id, cpf: cpf, horario: quando, origem: 'aluno', status: 'Valida', motivo: '', registradoPor: '', removidoEm: '', removidoPor: '' });
      var enviar = reivindicarEnvioSenha_(p);
      if (enviar) gravar_('PARTICIPANTES', p);
      return { ok: true, codigo: 'REGISTRADA', dia: { data: dia.data, titulo: dia.titulo, horas: dia.horas }, nome: primeiroNome_(p.nome), horario: quando.substring(11, 16), novoCadastro: !existiaAntes, __enviar: enviar, __email: p.email, mensagem: 'Presença registrada.' };
    }, 20000);
  } catch (e) {
    return { ok: false, codigo: 'OCUPADO', mensagem: 'Muitos registros ao mesmo tempo. Tente novamente em instantes.' };
  }
  if (!resultado.ok) return resultado.codigo === 'FALHA' ? falhar() : resultado;
  if (resultado.__enviar) {
    resultado.senhaEnviada = entregarSenhaTemporaria_(cpf, 'Acesso à sua área do participante', 'Sua presença foi registrada. Use a senha temporária abaixo para acessar a sua área, onde você acompanha suas presenças, recebe os materiais e baixa o certificado.');
    resultado.emailMascarado = mascararEmail_(resultado.__email);
  }
  delete resultado.__enviar; delete resultado.__email;
  return resultado;
}

/* ========================= presença manual e correções (equipe) ========================= */

/** Para conferir a pessoa antes de marcar presença. O facilitador vê só o primeiro nome e o e-mail mascarado. */
function buscarPessoa(token, cpf) {
  var s = exigir_(token, PAPEIS), d = soDigitos_(cpf);
  if (!cpfValido_(d)) return { ok: false, mensagem: 'CPF inválido.' };
  var p = indice_('PARTICIPANTES', 'cpf')[d];
  if (!p) return { ok: true, existe: false };
  var pres = presencasPorCpf_()[d] || {};
  return { ok: true, existe: true, nome: s.papel === 'admin' ? p.nome : primeiroNome_(p.nome), emailMascarado: mascararEmail_(p.email), temEmail: emailValido_(p.email), presencas: Object.keys(pres) };
}

function registrarPresencaManual(token, d) {
  var s = exigir_(token, PAPEIS);
  d = d || {};
  var cpf = soDigitos_(d.cpf), motivo = limitar_(d.motivo, 200);
  if (!cpfValido_(cpf)) return { ok: false, mensagem: 'CPF inválido.' };
  if (motivo.length < 5) return { ok: false, mensagem: 'Informe o motivo do registro manual.' };
  var cfg = cfg_(), dia = indice_('DIAS', 'id')[d.diaId];
  if (!dia || dia.status === 'Cancelado') return { ok: false, mensagem: 'Escolha um dia válido.' };
  if (Date.now() < msInicioDia_(dia)) return { ok: false, mensagem: 'Este encontro ainda não começou. Só é possível registrar presença de encontros já iniciados.' };
  var enviar = false, cadastrou = false;
  var r = comTrava_(function () {
    var p = indice_('PARTICIPANTES', 'cpf')[cpf];
    if (!p) {
      var nm = normalizarNome_(d.nome), email = String(d.email || '').trim();
      if (!nm.ok) return { ok: false, mensagem: 'CPF não cadastrado. Informe o nome completo para criar o cadastro. ' + nm.mensagem };
      if (!emailValido_(email)) return { ok: false, mensagem: 'CPF não cadastrado. Informe um e-mail válido para criar o cadastro.' };
      p = anexar_('PARTICIPANTES', { cpf: cpf, nome: nm.nome, email: email, origem: 'Manual (equipe)', lgpd: '', envioSenha: sim_(cfg[CFG.EMAIL_SENHA_IMPORT]) ? 'Pendente' : '', criadoEm: agoraTxt_(), atualizadoEm: agoraTxt_() });
      cadastrou = true;
    } else if (!emailValido_(p.email) && emailValido_(String(d.email || '').trim())) {
      p.email = String(d.email).trim(); p.atualizadoEm = agoraTxt_(); gravar_('PARTICIPANTES', p);
    }
    var ex = presencaDe_(cpf, dia.id);
    if (ex) return { ok: false, mensagem: ex.status === 'Valida' ? 'Esta pessoa já tem presença registrada neste dia.' : 'A presença deste dia foi removida pelo administrador. Só o administrador pode reativá-la.' };
    anexar_('PRESENCAS', { chave: cpf + '|' + dia.id, diaId: dia.id, cpf: cpf, horario: agoraTxt_(), origem: 'manual', status: 'Valida', motivo: motivo, registradoPor: s.nome || s.email, removidoEm: '', removidoPor: '' });
    if (cadastrou || (sim_(cfg[CFG.EMAIL_SENHA_IMPORT]) && !p.hash)) { enviar = reivindicarEnvioSenha_(p); if (enviar) gravar_('PARTICIPANTES', p); }
    return { ok: true, mensagem: 'Presença registrada manualmente' + (cadastrou ? ' e cadastro criado.' : '.') };
  });
  if (r.ok) {
    auditar_(s, 'Presença manual', formatarCPF_(cpf), dia.data + ' · ' + motivo);
    if (enviar) r.senhaEnviada = entregarSenhaTemporaria_(cpf, 'Acesso à sua área do participante', 'Sua presença foi registrada pela organização do evento. Use a senha temporária abaixo para acessar a sua área do participante.');
  }
  return r;
}

/** Somente administrador: remove ou reativa uma presença (fica o registro, com quem fez e o motivo). */
function corrigirPresenca(token, diaId, cpf, acao, motivo) {
  var s = exigir_(token, ['admin']);
  var d = soDigitos_(cpf);
  motivo = limitar_(motivo, 200);
  if (['remover', 'reativar'].indexOf(acao) < 0) return { ok: false, mensagem: 'Ação inválida.' };
  if (motivo.length < 5) return { ok: false, mensagem: 'Informe o motivo.' };
  return comTrava_(function () {
    var r = presencaDe_(d, diaId);
    if (!r) return { ok: false, mensagem: 'Presença não encontrada.' };
    if (acao === 'remover') {
      if (r.status !== 'Valida') return { ok: false, mensagem: 'Esta presença já estava removida.' };
      r.status = 'Removida'; r.removidoEm = agoraTxt_(); r.removidoPor = s.nome || s.email;
    } else {
      if (r.status === 'Valida') return { ok: false, mensagem: 'Esta presença já está válida.' };
      r.status = 'Valida'; r.removidoEm = ''; r.removidoPor = '';
    }
    r.motivo = (r.motivo ? r.motivo + ' | ' : '') + motivo;
    gravar_('PRESENCAS', r);
    auditar_(s, 'Presença ' + (acao === 'remover' ? 'removida' : 'reativada'), formatarCPF_(d), diaId + ' · ' + motivo);
    return { ok: true, mensagem: acao === 'remover' ? 'Presença removida.' : 'Presença reativada.' };
  });
}

/* ====================== resumo de presença de uma pessoa ====================== */

function presencasPorCpf_() {
  var ch = 'PRESENCAS|porCpf';
  if (_idx[ch]) return _idx[ch];
  var m = {};
  lerTudo_('PRESENCAS').forEach(function (r) { if (r.status === 'Valida') { m[r.cpf] = m[r.cpf] || {}; m[r.cpf][r.diaId] = r; } });
  _idx[ch] = m;
  return m;
}
/** Horas = soma da carga horária dos dias ATIVOS com presença válida. */
function resumoDe_(cpf) {
  var pres = presencasPorCpf_()[cpf] || {}, dias = diasAtivos_(), horas = 0, n = 0, tot = 0;
  dias.forEach(function (d) {
    var h = horasNum_(d.horas) || 0;
    tot += h;
    if (pres[d.id]) { horas += h; n++; }
  });
  return { horas: Math.round(horas * 100) / 100, dias: n, totalDias: dias.length, horasTotais: Math.round(tot * 100) / 100, presencas: pres };
}

/* ============================================================================
 * SEÇÃO 4 — PARTICIPANTES: CSV, senhas, área do participante e formulário de inscrição
 * e área do participante (agenda, presenças, transmissão, pesquisa, certificado).
 * SENHA TEMPORÁRIA: nunca fica guardada em texto. É gerada no momento do envio, vai por e-mail e só o hash é gravado,
 * e somente se o e-mail foi aceito. Se o envio falhar, o participante continua "Pendente" e a rotina tenta de novo.
 * ============================================================================ */

/* ============================== entrega de senha ============================== */

/** Gera a senha temporária, envia por e-mail e, se o envio funcionou, grava o hash e marca "Enviado". */
function entregarSenhaTemporaria_(cpf, titulo, intro, extraHtml) {
  var cfg = cfg_(), p = indice_('PARTICIPANTES', 'cpf')[cpf];
  if (!p || !emailValido_(p.email)) return false;
  var temp = senhaTemporaria_(), h = criarHashSenha_(temp);
  var ok = enviarEmailSenhaParticipante_(cfg, p, temp, titulo || 'Acesso à sua área do participante', intro || 'Você foi cadastrado no evento. Use a senha temporária abaixo para acessar a sua área do participante.', extraHtml);
  comTrava_(function () {
    var q = indice_('PARTICIPANTES', 'cpf')[cpf];
    if (!q) return;
    if (ok) {
      q.tempHash = h; q.tempExpira = String(Date.now() + inteiroCfg_(cfg, CFG.SENHA_DIAS, 14, 1, 90) * 86400000); q.envioSenha = 'Enviado';
    } else { q.envioSenha = 'Pendente'; }
    q.atualizadoEm = agoraTxt_();
    gravar_('PARTICIPANTES', q);
  });
  return ok;
}

/** Rotina e importação: envia as senhas que ficaram pendentes, respeitando cota e tempo. */
function processarFilaSenhas_(limiteMs) {
  var enviados = 0, restantes = 0;
  var cpfs = lerTudo_('PARTICIPANTES').filter(function (p) {
    var velho = p.envioSenha.indexOf('Enviando|') === 0 && Date.now() - parseInt(p.envioSenha.split('|')[1], 10) > 600000;
    return !p.hash && emailValido_(p.email) && (p.envioSenha === 'Pendente' || velho);
  }).map(function (p) { return p.cpf; });
  for (var i = 0; i < cpfs.length; i++) {
    if (Date.now() > limiteMs || MailApp.getRemainingDailyQuota() < 1) { restantes = cpfs.length - i; break; }
    var cpf = cpfs[i];
    var reservou = comTrava_(function () {
      var q = indice_('PARTICIPANTES', 'cpf')[cpf];
      if (q && reivindicarEnvioSenha_(q)) { gravar_('PARTICIPANTES', q); return true; }
      return false;
    });
    if (reservou && entregarSenhaTemporaria_(cpf)) enviados++;
  }
  return { enviados: enviados, restantes: restantes };
}

/* ============================== importação por CSV ============================== */

var SINONIMOS_COLUNAS_ = {
  cpf: ['cpf'],
  nome: ['nome', 'nome completo', 'participante', 'aluno', 'nome do participante'],
  email: ['e-mail', 'email', 'e mail', 'correio eletronico']
};

function parseCsv_(texto) {
  texto = String(texto || '').replace(/^\uFEFF/, '');
  var primeira = texto.split(/\r?\n/)[0] || '';
  var sep = primeira.indexOf('\t') >= 0 ? '\t' : ((primeira.split(';').length >= primeira.split(',').length && primeira.indexOf(';') >= 0) ? ';' : ',');
  var linhas = [], atual = [], campo = '', emAspas = false;
  for (var i = 0; i < texto.length; i++) {
    var ch = texto.charAt(i);
    if (emAspas) {
      if (ch === '"') { if (texto.charAt(i + 1) === '"') { campo += '"'; i++; } else emAspas = false; }
      else campo += ch;
    } else if (ch === '"') emAspas = true;
    else if (ch === sep) { atual.push(campo); campo = ''; }
    else if (ch === '\n') { atual.push(campo); linhas.push(atual); atual = []; campo = ''; }
    else if (ch !== '\r') campo += ch;
  }
  if (campo !== '' || atual.length) { atual.push(campo); linhas.push(atual); }
  return linhas.filter(function (l) { return l.some(function (c) { return String(c).trim() !== ''; }); });
}
/** O Excel costuma comer os zeros à esquerda do CPF. Se o número com zeros repostos for válido, aceita. */
function cpfDoCsv_(v) {
  var d = soDigitos_(v);
  if (d.length >= 9 && d.length < 11) { var z = ('00000000000' + d).slice(-11); if (cpfValido_(z)) return z; }
  return d;
}

/** Confere o CSV sem gravar nada e devolve um resumo (sem expor a lista inteira). */
function previaImportacao(token, texto) {
  var s = exigir_(token, ['admin']);
  var linhas = parseCsv_(texto);
  if (linhas.length < 2) return { ok: false, mensagem: 'O arquivo precisa de uma linha de cabeçalho e ao menos uma pessoa.' };
  if (linhas.length > 1501) return { ok: false, mensagem: 'Importe no máximo 1.500 pessoas por vez.' };
  var cab = linhas[0].map(chaveTexto_), col = {};
  Object.keys(SINONIMOS_COLUNAS_).forEach(function (k) {
    col[k] = -1;
    for (var i = 0; i < SINONIMOS_COLUNAS_[k].length; i++) { var j = cab.indexOf(SINONIMOS_COLUNAS_[k][i]); if (j >= 0) { col[k] = j; break; } }
  });
  if (col.cpf < 0 || col.nome < 0) return { ok: false, mensagem: 'O cabeçalho precisa ter as colunas "CPF" e "Nome". Reconhecemos também "E-mail".' };

  var existentes = indice_('PARTICIPANTES', 'cpf'), vistos = {}, validos = [], erros = [], r = { jaCadastrados: 0, duplicadosNoArquivo: 0, semEmail: 0, zerosRepostos: 0 };
  for (var n = 1; n < linhas.length; n++) {
    var l = linhas[n], num = n + 1;
    var bruto = soDigitos_(l[col.cpf]), cpf = cpfDoCsv_(l[col.cpf]);
    if (!cpfValido_(cpf)) { erros.push({ linha: num, mensagem: 'CPF inválido.' }); continue; }
    if (bruto.length < 11) r.zerosRepostos++;
    var nm = normalizarNome_(l[col.nome]);
    if (!nm.ok) { erros.push({ linha: num, mensagem: nm.mensagem }); continue; }
    var email = col.email >= 0 ? String(l[col.email] || '').trim() : '';
    if (email && !emailValido_(email)) { erros.push({ linha: num, mensagem: 'E-mail inválido.' }); continue; }
    if (vistos[cpf]) { r.duplicadosNoArquivo++; continue; }
    vistos[cpf] = true;
    if (existentes[cpf]) { r.jaCadastrados++; continue; }
    if (!email) r.semEmail++;
    validos.push({ cpf: cpf, nome: nm.nome, email: email });
  }
  var importId = novoId_('I');
  cachePutBig_('IMP_' + importId, { linhas: validos, por: s.id }, 3600);
  return {
    ok: true, importId: importId, totalLinhas: linhas.length - 1, novos: validos.length, jaCadastrados: r.jaCadastrados,
    duplicadosNoArquivo: r.duplicadosNoArquivo, semEmail: r.semEmail, zerosRepostos: r.zerosRepostos, comErro: erros.length, erros: erros.slice(0, 100),
    amostra: validos.slice(0, 5).map(function (v) { return { cpf: formatarCPF_(v.cpf).substring(0, 4) + '***.***-**', nome: v.nome, email: mascararEmail_(v.email) }; }),
    enviarSenhaPadrao: sim_(cfg_()[CFG.EMAIL_SENHA_IMPORT])
  };
}

function confirmarImportacao(token, importId, opcoes) {
  var s = exigir_(token, ['admin']);
  opcoes = opcoes || {};
  var dados = cacheGetBig_('IMP_' + String(importId || ''));
  if (!dados || dados.por !== s.id) return { ok: false, mensagem: 'A prévia expirou. Envie o arquivo de novo.' };
  var enviar = opcoes.enviarEmail === undefined ? sim_(cfg_()[CFG.EMAIL_SENHA_IMPORT]) : !!opcoes.enviarEmail;
  var res = comTrava_(function () {
    var existentes = indice_('PARTICIPANTES', 'cpf'), novos = [], ignorados = 0, agora = agoraTxt_();
    dados.linhas.forEach(function (v) {
      if (existentes[v.cpf]) { ignorados++; return; }
      novos.push({ cpf: v.cpf, nome: v.nome, email: v.email, origem: 'Importação CSV', lgpd: '', envioSenha: (enviar && v.email) ? 'Pendente' : '', criadoEm: agora, atualizadoEm: agora });
    });
    anexarLote_('PARTICIPANTES', novos);
    return { criados: novos.length, ignorados: ignorados };
  }, 30000);
  cacheDelBig_('IMP_' + importId);
  auditar_(s, 'Importação CSV', 'participantes', res.criados + ' criados, ' + res.ignorados + ' já existiam, e-mail de senha: ' + (enviar ? 'sim' : 'não'));
  var fila = enviar ? processarFilaSenhas_(Date.now() + 90000) : { enviados: 0, restantes: 0 };
  return {
    ok: true, criados: res.criados, ignorados: res.ignorados, senhasEnviadas: fila.enviados, senhasPendentes: fila.restantes,
    mensagem: res.criados + ' pessoa(s) importada(s).' + (enviar ? ' ' + fila.enviados + ' e-mail(s) com senha enviado(s)' + (fila.restantes ? '; ' + fila.restantes + ' seguem na fila e saem automaticamente nos próximos minutos.' : '.') : '')
  };
}

/* ===================== gestão de participantes (administrador) ===================== */

function situacaoSenha_(p) {
  if (p.hash) return 'Definida';
  if (!emailValido_(p.email)) return 'Sem e-mail';
  if (p.envioSenha === 'Enviado') return 'Temporária enviada';
  return 'Pendente de envio';
}
function situacaoCertificado_(p, horasAtuais) {
  if (!p.certCodigo) return 'Não emitido';
  return String(p.certHoras) === String(horasAtuais) ? 'Emitido' : 'Desatualizado';
}
function listarParticipantes(token, f) {
  exigir_(token, ['admin']);
  f = f || {};
  var busca = chaveTexto_(f.busca), buscaDig = soDigitos_(f.busca), tam = 100, pag = Math.max(1, parseInt(f.pagina, 10) || 1);
  var lista = lerTudo_('PARTICIPANTES').filter(function (p) {
    if (busca && chaveTexto_(p.nome + ' ' + p.email).indexOf(busca) < 0 && !(buscaDig && p.cpf.indexOf(buscaDig) >= 0)) return false;
    if (f.filtro === 'semPresenca') return !presencasPorCpf_()[p.cpf];
    if (f.filtro === 'comCertificado') return !!p.certCodigo;
    if (f.filtro === 'senhaPendente') return !p.hash && emailValido_(p.email) && p.envioSenha !== 'Enviado';
    if (f.filtro === 'semEmail') return !emailValido_(p.email);
    return true;
  });
  var itens = lista.slice((pag - 1) * tam, pag * tam).map(function (p) {
    var rs = resumoDe_(p.cpf);
    return {
      cpf: p.cpf, cpfFormatado: formatarCPF_(p.cpf), nome: p.nome, email: p.email, origem: p.origem, utm: p.utm, inscritoEm: p.inscritoEm, lgpd: !!p.lgpd, senha: situacaoSenha_(p),
      dias: rs.dias, horas: rs.horas, nps: p.npsNota, certificado: situacaoCertificado_(p, rs.horas), registro: p.registro
    };
  });
  return { ok: true, total: lista.length, pagina: pag, tamanho: tam, itens: itens, totalDias: diasAtivos_().length };
}
function adicionarParticipanteManual(token, d) {
  var s = exigir_(token, ['admin']);
  d = d || {};
  var cpf = soDigitos_(d.cpf), nm = normalizarNome_(d.nome), email = String(d.email || '').trim();
  if (!cpfValido_(cpf)) return { ok: false, mensagem: 'CPF inválido.' };
  if (!nm.ok) return { ok: false, mensagem: nm.mensagem };
  if (!emailValido_(email)) return { ok: false, mensagem: 'Informe um e-mail válido.' };
  var enviar = sim_(cfg_()[CFG.EMAIL_SENHA_IMPORT]);
  var r = comTrava_(function () {
    if (indice_('PARTICIPANTES', 'cpf')[cpf]) return { ok: false, mensagem: 'Este CPF já está cadastrado.' };
    anexar_('PARTICIPANTES', { cpf: cpf, nome: nm.nome, email: email, origem: 'Manual (equipe)', lgpd: '', envioSenha: enviar ? 'Pendente' : '', criadoEm: agoraTxt_(), atualizadoEm: agoraTxt_() });
    return { ok: true };
  });
  if (!r.ok) return r;
  auditar_(s, 'Participante cadastrado', formatarCPF_(cpf), 'manual');
  var envio = false;
  if (enviar) {
    var reservou = comTrava_(function () { var q = indice_('PARTICIPANTES', 'cpf')[cpf]; if (reivindicarEnvioSenha_(q)) { gravar_('PARTICIPANTES', q); return true; } return false; });
    if (reservou) envio = entregarSenhaTemporaria_(cpf);
  }
  return { ok: true, mensagem: 'Participante cadastrado.' + (enviar ? (envio ? ' Senha temporária enviada por e-mail.' : ' Não foi possível enviar o e-mail agora; a rotina tenta de novo.') : '') };
}
/** Corrige nome ou e-mail. Se já havia certificado, ele passa a constar como desatualizado e pode ser reemitido. */
function salvarParticipante(token, d) {
  var s = exigir_(token, ['admin']);
  d = d || {};
  var cpf = soDigitos_(d.cpf), nm = normalizarNome_(d.nome), email = String(d.email || '').trim();
  if (!nm.ok) return { ok: false, mensagem: nm.mensagem };
  if (email && !emailValido_(email)) return { ok: false, mensagem: 'E-mail inválido.' };
  return comTrava_(function () {
    var p = indice_('PARTICIPANTES', 'cpf')[cpf];
    if (!p) return { ok: false, mensagem: 'Participante não encontrado.' };
    var mudouNome = p.nome !== nm.nome, mudouEmail = p.email !== email;
    p.nome = nm.nome; p.email = email;
    if (mudouEmail && !p.hash) { p.envioSenha = email ? 'Pendente' : ''; p.tempHash = ''; p.tempExpira = ''; }
    if (mudouNome && p.certCodigo) p.certHoras = ''; // marca o certificado como desatualizado
    p.atualizadoEm = agoraTxt_();
    gravar_('PARTICIPANTES', p);
    auditar_(s, 'Participante alterado', formatarCPF_(cpf), (mudouNome ? 'nome ' : '') + (mudouEmail ? 'e-mail' : ''));
    return { ok: true, mensagem: 'Dados atualizados.' + (mudouNome && p.certCodigo ? ' O certificado já emitido ficou desatualizado: reemita-o.' : '') };
  });
}
function reenviarSenhaParticipante(token, cpf) {
  var s = exigir_(token, ['admin']);
  var d = soDigitos_(cpf), p = indice_('PARTICIPANTES', 'cpf')[d];
  if (!p) return { ok: false, mensagem: 'Participante não encontrado.' };
  if (!emailValido_(p.email)) return { ok: false, mensagem: 'Este cadastro não tem e-mail válido. Corrija o e-mail primeiro.' };
  var ok = entregarSenhaTemporaria_(d, 'Nova senha temporária', 'A organização do evento enviou uma nova senha temporária para a sua área do participante. A sua senha atual, se existir, continua valendo até você usar esta.');
  auditar_(s, 'Senha temporária reenviada', formatarCPF_(d), ok ? 'enviada' : 'falhou');
  return ok ? { ok: true, mensagem: 'Senha temporária enviada para ' + mascararEmail_(p.email) + '.' } : { ok: false, mensagem: 'Não foi possível enviar o e-mail agora. Tente de novo mais tarde.' };
}
function excluirParticipantes(token, cpfs) {
  var s = exigir_(token, ['admin']);
  if (!Array.isArray(cpfs) || !cpfs.length) return { ok: false, mensagem: 'Nenhum participante selecionado.' };
  var alvo = {};
  cpfs.forEach(function (c) { alvo[soDigitos_(c)] = true; });
  var codigos = [], res = comTrava_(function () {
    var linhasP = [], linhasPres = [];
    lerTudo_('PARTICIPANTES').forEach(function (p) { if (alvo[p.cpf]) { linhasP.push(p.__linha); if (p.certCodigo) codigos.push(p.certCodigo); } });
    lerTudo_('PRESENCAS').forEach(function (r) { if (alvo[r.cpf]) linhasPres.push(r.__linha); });
    apagarLinhas_('PARTICIPANTES', linhasP);
    apagarLinhas_('PRESENCAS', linhasPres);
    return { excluidos: linhasP.length, presencas: linhasPres.length };
  }, 30000);
  auditar_(s, 'Participantes excluídos', String(res.excluidos), res.presencas + ' presenças removidas junto');
  try { notificarRevogacoesRegistro_(codigos); } catch (e) { Logger.log('Registro central: ' + e); }
  return { ok: true, excluidos: res.excluidos, mensagem: res.excluidos + ' participante(s) excluído(s), com as respectivas presenças.' };
}

/* ============================ área do participante ============================ */

function npsLiberada_(cfg, agora) {
  var v = String(cfg[CFG.NPS_LIB] || 'Auto');
  if (v === 'Sim') return true;
  if (v === 'Não') return false;
  return eventoEncerrado_(cfg, agora);
}
/** Regras do certificado do participante. Devolve {liberado, motivo}. */
function elegibilidadeCertificado_(cfg, p, rs, agora) {
  if (rs.dias === 0) return { liberado: false, motivo: 'Você ainda não tem presença registrada em nenhum encontro.' };
  var lib = String(cfg[CFG.CERT_LIB] || 'Auto');
  if (lib === 'Não') return { liberado: false, motivo: 'Os certificados ainda não foram liberados pela organização.' };
  if (lib === 'Auto' && !eventoEncerrado_(cfg, agora)) return { liberado: false, motivo: 'O certificado será liberado depois do último encontro.' };
  var fmin = parseFloat(String(cfg[CFG.FREQ_MIN] || '').replace(',', '.'));
  if (!isNaN(fmin) && fmin > 0 && rs.horasTotais > 0 && (rs.horas / rs.horasTotais) * 100 < fmin) {
    return { liberado: false, motivo: 'A frequência mínima de ' + String(fmin).replace('.', ',') + '% da carga horária não foi atingida.' };
  }
  if (sim_(cfg[CFG.NPS_EXIGIR]) && p.npsNota === '') {
    return { liberado: false, motivo: npsLiberada_(cfg, agora) ? 'Responda a pesquisa de satisfação para liberar o certificado.' : 'A pesquisa de satisfação será liberada depois do último encontro.', precisaPesquisa: npsLiberada_(cfg, agora) };
  }
  return { liberado: true, motivo: '' };
}
/** Link e senha só saem do servidor dentro da janela: X minutos antes do início até o término do encontro. */
function transmissaoDoDia_(d, cfg, agora) {
  if (!sim_(cfg[CFG.TRANSMISSAO]) || d.status === 'Cancelado') return null;
  var link = d.link || cfg[CFG.ZOOM];
  if (!/^https:\/\//i.test(String(link || ''))) return null;
  var j = janelaDia_(d, cfg);
  if (j.iniMs === null || j.fimMs === null) return null;
  var libera = j.iniMs - inteiroCfg_(cfg, CFG.ZOOM_ANTECED, 20, 0, 720) * 60000;
  if (agora < libera || agora > j.fimMs) return null;
  return { link: link, senha: d.senhaSala || (d.link ? '' : cfg[CFG.ZOOM_SENHA]) || '' };
}

function obterArea(token) {
  var ctx = exigirParticipante_(token), p = ctx.p;
  var cfg = cfg_(), agora = Date.now(), rs = resumoDe_(p.cpf), hoje = hojeTxt_(), transmissoes = [];
  var dias = todosDiasOrdenados_().map(function (d, i) {
    var j = janelaDia_(d, cfg), pres = rs.presencas[d.id], estado = estadoDia_(d, cfg, agora), st;
    if (d.status === 'Cancelado') st = 'Cancelado';
    else if (pres) st = 'Presente';
    else if (estado === 'Aberta' || (d.data === hoje && j.encerraMs !== null && agora <= j.encerraMs)) st = 'Hoje';
    else if (j.encerraMs !== null && agora > j.encerraMs) st = 'Falta';
    else st = 'Programado';
    var tr = transmissaoDoDia_(d, cfg, agora);
    if (tr) transmissoes.push({ dia: d.data, titulo: d.titulo, link: tr.link, senha: tr.senha });
    return { ordem: i + 1, data: d.data, inicio: d.inicio, fim: d.fim, horas: d.horas, titulo: d.titulo, estado: st, presencaAberta: estado === 'Aberta', manual: !!pres && pres.origem === 'manual', registradoEm: pres ? pres.horario.substring(11, 16) : '' };
  });
  var cert = elegibilidadeCertificado_(cfg, p, rs, agora);
  var mats = lerMateriais_().filter(function (m) { return m.ativo && (m.quemVe === QV_AREA || p.npsNota !== ''); }).length;
  return {
    ok: true, nome: p.nome, primeiroNome: primeiroNome_(p.nome), emailMascarado: mascararEmail_(p.email), evento: cfg[CFG.NOME],
    dias: dias, horas: { acumuladas: rs.horas, totais: rs.horasTotais, diasPresentes: rs.dias, totalDias: rs.totalDias },
    transmissoes: transmissoes,
    pesquisa: { liberada: npsLiberada_(cfg, agora), respondida: p.npsNota !== '', exigida: sim_(cfg[CFG.NPS_EXIGIR]) },
    certificado: { liberado: cert.liberado, motivo: cert.motivo, emitido: !!p.certCodigo, desatualizado: !!p.certCodigo && String(p.certHoras) !== String(rs.horas), codigo: p.certCodigo || '' },
    materiaisDisponiveis: mats
  };
}

function enviarNpsParticipante(token, nota, comentario) {
  var ctx = exigirParticipante_(token), cfg = cfg_(), agora = Date.now();
  if (!npsLiberada_(cfg, agora)) return { ok: false, mensagem: 'A pesquisa de satisfação ainda não foi liberada.' };
  if (!/^(10|[0-9])$/.test(String(nota))) return { ok: false, mensagem: 'A nota deve ser um número de 0 a 10.' };
  if (resumoDe_(ctx.s.cpf).dias === 0) return { ok: false, mensagem: 'A pesquisa é destinada a quem registrou presença em ao menos um encontro.' };
  return comTrava_(function () {
    var p = indice_('PARTICIPANTES', 'cpf')[ctx.s.cpf];
    if (!p) return { ok: false, mensagem: 'Cadastro não encontrado.' };
    if (p.npsNota !== '') return { ok: false, mensagem: 'Você já respondeu a esta pesquisa. Obrigado!' };
    p.npsNota = String(parseInt(nota, 10)); p.npsComentario = limitar_(comentario, 2000); p.npsEm = agoraTxt_(); p.atualizadoEm = agoraTxt_();
    gravar_('PARTICIPANTES', p);
    return { ok: true, mensagem: 'Obrigado pela sua avaliação!', materiaisLiberados: lerMateriais_().filter(function (m) { return m.ativo && m.quemVe === QV_NPS; }).length };
  });
}

/* ===================== formulário de inscrição (opcional) ===================== */
/* Com a chave "Formulário de inscrição habilitado" em Sim, a tela inicial oferece a inscrição. CPF, nome do certificado e
   e-mail são campos FIXOS; o administrador cria os demais. As respostas ficam em uma coluna JSON da aba Participantes,
   indexadas pelo ID de cada campo (renomear um campo não perde respostas antigas). Quem se inscreve entra na lista, recebe
   a senha temporária no ato e já acessa a área do participante. */

var T_TEXTO = 'Texto livre', T_EMAIL = 'E-mail', T_TEL = 'Telefone', T_DATA = 'Data', T_SELECT = 'Seleção única', T_CHECK = 'Múltipla escolha';
var TIPOS_CAMPO = [T_TEXTO, T_EMAIL, T_TEL, T_DATA, T_SELECT, T_CHECK];
var MAX_CAMPOS_FORM = 15;
var ROTULOS_RESERVADOS_ = ['cpf', 'nome', 'nome completo', 'nome como no certificado', 'e-mail', 'email'];

function listaOpcoes_(txt) { return String(txt || '').split(',').map(function (o) { return o.trim(); }).filter(Boolean); }
function hashChave_(s) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s))).substring(0, 24); }
function respostasDe_(p) { try { var o = JSON.parse(p.respostas || '{}'); return (o && typeof o === 'object') ? o : {}; } catch (e) { return {}; } }

function camposFormulario_(incluirInativos) {
  return lerTudo_('FORMULARIO').map(function (c) {
    return { id: c.id, rotulo: c.rotulo, tipo: c.tipo, placeholder: c.placeholder, obrigatorio: sim_(c.obrigatorio), opcoes: listaOpcoes_(c.opcoes), ordem: Number(c.ordem) || 0, ativo: sim_(c.ativo) };
  }).filter(function (c) { return incluirInativos || c.ativo; }).sort(function (a, b) { return a.ordem - b.ordem; });
}
function campoPublico_(c) { return { id: c.id, rotulo: c.rotulo, tipo: c.tipo, placeholder: c.placeholder, obrigatorio: c.obrigatorio, opcoes: c.opcoes }; }

/** Regra única de "inscrições abertas": formulário ligado, evento configurado, chave aberta, prazo e evento em andamento. */
function inscricoesAbertas_(cfg, agora) {
  if (!sim_(cfg[CFG.FORM_ATIVO])) return { abertas: false, motivo: 'O formulário de inscrição não está habilitado.' };
  if (cfg[CFG.STATUS] === 'Pendente') return { abertas: false, motivo: 'O evento ainda está sendo configurado.' };
  if (!sim_(cfg[CFG.INSCR_ABERTAS])) return { abertas: false, motivo: 'As inscrições estão encerradas.' };
  var ate = parseDH_(cfg[CFG.INSCR_ATE]);
  if (ate !== null && agora > ate) return { abertas: false, motivo: 'As inscrições se encerraram em ' + cfg[CFG.INSCR_ATE] + '.' };
  if (eventoEncerrado_(cfg, agora)) return { abertas: false, motivo: 'O evento já terminou.' };
  return { abertas: true, motivo: '' };
}

/** Valida uma resposta pelo tipo do campo. Devolve {valor} ou {erro}. */
function validarRespostaCampo_(c, bruto) {
  var vazio = bruto == null || (Array.isArray(bruto) ? bruto.length === 0 : String(bruto).trim() === '');
  if (vazio) return c.obrigatorio ? { erro: 'Preencha o campo "' + c.rotulo + '".' } : { valor: '' };
  if (c.tipo === T_CHECK) {
    var arr = (Array.isArray(bruto) ? bruto : String(bruto).split(',')).map(function (x) { return String(x).trim(); }).filter(Boolean), vistos = {}, unicos = [];
    for (var i = 0; i < arr.length; i++) {
      if (c.opcoes.indexOf(arr[i]) < 0) return { erro: 'Opção inválida em "' + c.rotulo + '".' };
      if (!vistos[arr[i]]) { vistos[arr[i]] = 1; unicos.push(arr[i]); }
    }
    return unicos.length ? { valor: unicos.join(', ') } : (c.obrigatorio ? { erro: 'Preencha o campo "' + c.rotulo + '".' } : { valor: '' });
  }
  var v = String(bruto).replace(/[\u0000-\u001f]/g, ' ').trim();
  if (c.tipo === T_TEXTO && v.length > 300) return { erro: 'O campo "' + c.rotulo + '" aceita até 300 caracteres.' };
  if (c.tipo === T_EMAIL && !emailValido_(v)) return { erro: 'E-mail inválido em "' + c.rotulo + '".' };
  if (c.tipo === T_TEL) { var dg = soDigitos_(v); if (dg.length < 10 || dg.length > 11) return { erro: 'Telefone inválido em "' + c.rotulo + '".' }; v = v.substring(0, 30); }
  if (c.tipo === T_DATA && (!/^\d{2}\/\d{2}\/\d{4}$/.test(v) || !dataValida_(v))) return { erro: 'Data inválida em "' + c.rotulo + '" (use DD/MM/AAAA).' };
  if (c.tipo === T_SELECT && c.opcoes.indexOf(v) < 0) return { erro: 'Opção inválida em "' + c.rotulo + '".' };
  return { valor: v };
}

/** Bloco com a agenda para o e-mail de inscrição. */
function blocoAgendaEmail_(cfg) {
  var h = '<h2 style="margin:16px 0 8px 0;font-size:16px;color:' + corHex_(cfg[CFG.COR2], '#375B95') + ';">Agenda</h2>';
  diasAtivos_().forEach(function (d) {
    h += '<p style="margin:0 0 4px 0;font-size:14px;line-height:1.5;"><strong>' + esc_(d.data) + '</strong> · ' + esc_(d.inicio) + ' às ' + esc_(d.fim) + ' · ' + esc_(horasTexto_(horasNum_(d.horas) || 0)) + ' h' + (d.titulo ? ' · ' + esc_(d.titulo) : '') + '</p>';
  });
  if (sim_(cfg[CFG.EXIBIR_LOCAL]) && cfg[CFG.LOCAL]) h += '<p style="margin:8px 0 0 0;font-size:14px;"><strong>Local:</strong> ' + esc_(cfg[CFG.LOCAL]) + '</p>';
  if (cfg[CFG.OBS]) h += '<p style="margin:8px 0 0 0;font-size:14px;line-height:1.5;"><strong>Observações:</strong> ' + esc_(cfg[CFG.OBS]).replace(/\n/g, '<br>') + '</p>';
  return h + '<p style="margin:12px 0 0 0;font-size:14px;line-height:1.5;color:#4b5563;">Nos dias do evento, o código da aula é informado pelo facilitador para você registrar a presença.</p>';
}

/** Primeira etapa da inscrição: só o CPF. Não deixa alterar cadastro existente: apenas informa que ele existe. */
function verificarCpfInscricao(cpf) {
  var d = soDigitos_(cpf);
  if (!cpfValido_(d)) return { ok: false, mensagem: 'CPF inválido. Confira os números digitados.' };
  if (contagem_('VC_' + d) >= 20 || contagem_('VC_G') >= 4000) return { ok: false, mensagem: 'Muitas consultas. Aguarde alguns minutos.' };
  contar_('VC_' + d, 600); contar_('VC_G', 600);
  var cfg = cfg_(), ab = inscricoesAbertas_(cfg, Date.now());
  if (!ab.abertas) return { ok: false, codigo: 'ENCERRADAS', mensagem: ab.motivo };
  var p = indice_('PARTICIPANTES', 'cpf')[d];
  return p ? { ok: true, caminho: 'registrado', emailMascarado: mascararEmail_(p.email) } : { ok: true, caminho: 'novo' };
}

function processarInscricao(d) {
  d = (d && typeof d === 'object') ? d : {};
  var cfg = cfg_(), agora = Date.now();
  if (!sim_(cfg[CFG.FORM_ATIVO])) return { ok: false, codigo: 'FORM_DESLIGADO', mensagem: 'As inscrições por formulário não estão habilitadas neste evento.' };
  var ab = inscricoesAbertas_(cfg, agora);
  if (!ab.abertas) return { ok: false, codigo: 'ENCERRADAS', mensagem: ab.motivo };
  if (String(d.site || d.website || '').trim() !== '') return { ok: true, mensagem: 'Inscrição recebida.' }; // campo-isca: só robôs o preenchem; não grava nada
  var cpf = soDigitos_(d.cpf);
  if (!cpfValido_(cpf)) return { ok: false, codigo: 'CPF', mensagem: 'CPF inválido. Confira os números digitados.' };
  var teto = inteiroCfg_(cfg, CFG.INSCR_TETO_HORA, 120, 1, 2000), kHora = 'IN_H_' + fmt_(agora, 'yyyyMMddHH');
  if (contagem_(kHora) >= teto) return { ok: false, codigo: 'MUITAS', mensagem: 'Há muitas inscrições neste momento. Tente novamente em alguns minutos.' };

  var nm = normalizarNome_(d.nome), email = String(d.email || '').trim(), email2 = String(d.email2 || '').trim();
  if (!nm.ok) return { ok: false, codigo: 'DADOS', mensagem: nm.mensagem };
  if (!emailValido_(email)) return { ok: false, codigo: 'DADOS', mensagem: 'Informe um e-mail válido.' };
  if (email.toLowerCase() !== email2.toLowerCase()) return { ok: false, codigo: 'DADOS', mensagem: 'Os dois e-mails digitados são diferentes.' };
  var campos = camposFormulario_(false), enviadas = (d.respostas && typeof d.respostas === 'object') ? d.respostas : {}, resp = {};
  for (var i = 0; i < campos.length; i++) {
    var v = validarRespostaCampo_(campos[i], enviadas[campos[i].id]);
    if (v.erro) return { ok: false, codigo: 'DADOS', mensagem: v.erro };
    if (v.valor !== '') resp[campos[i].id] = v.valor;
  }
  if (!sim_(d.lgpd)) return { ok: false, codigo: 'LGPD', mensagem: 'É necessário aceitar o tratamento dos seus dados (LGPD) para se inscrever.' };
  // Erro de preenchimento não conta: só submissões já válidas são limitadas por CPF (evita insistência em cadastro existente).
  if (contagem_('IN_' + cpf) >= 8) return { ok: false, codigo: 'TENTATIVAS', mensagem: 'Muitas tentativas. Aguarde alguns minutos.' };
  contar_('IN_' + cpf, 600);
  var kEmail = 'IE_' + hashChave_(email.toLowerCase());
  if (contagem_(kEmail) >= 2) return { ok: false, codigo: 'EMAIL', mensagem: 'Este e-mail já recebeu mensagens da inscrição recentemente. Tente outro endereço ou procure a organização.' };
  var utm = String(d.utm || '').replace(/[^A-Za-z0-9_\-\. ]/g, '').substring(0, 100);

  var r = comTrava_(function () {
    if (indice_('PARTICIPANTES', 'cpf')[cpf]) return { ok: false, codigo: 'JA_CADASTRADO', mensagem: 'Este CPF já está cadastrado. Volte à tela inicial para registrar presença ou acessar a sua área.' };
    var p = anexar_('PARTICIPANTES', { cpf: cpf, nome: nm.nome, email: email, origem: 'Inscrição', utm: utm, inscritoEm: agoraTxt_(), lgpd: agoraTxt_(), respostas: JSON.stringify(resp), envioSenha: '', criadoEm: agoraTxt_(), atualizadoEm: agoraTxt_() });
    if (reivindicarEnvioSenha_(p)) gravar_('PARTICIPANTES', p);
    return { ok: true };
  });
  if (!r.ok) return r;
  contar_(kHora, 3700); contar_(kEmail, 21600);
  var enviado = entregarSenhaTemporaria_(cpf, 'Inscrição confirmada', 'Sua inscrição está confirmada. Use a senha temporária abaixo para acessar a sua área do participante, onde você acompanha a agenda, as presenças, os materiais e, ao final, baixa o certificado.', blocoAgendaEmail_(cfg));
  return { ok: true, mensagem: 'Inscrição confirmada!' + (enviado ? '' : ' Não foi possível enviar o e-mail agora; tentaremos novamente nos próximos minutos.'), senhaEnviada: enviado, emailMascarado: mascararEmail_(email) };
}

/* ---- construtor do formulário (administrador) ---- */

function obterFormularioAdmin(token) {
  exigir_(token, ['admin']);
  var cfg = cfg_();
  return { ok: true, ativo: sim_(cfg[CFG.FORM_ATIVO]), abertas: sim_(cfg[CFG.INSCR_ABERTAS]), ate: cfg[CFG.INSCR_ATE], campos: camposFormulario_(false), tipos: TIPOS_CAMPO, maximo: MAX_CAMPOS_FORM,
    fixos: [{ rotulo: 'CPF', tipo: 'CPF' }, { rotulo: 'Nome como será impresso no certificado', tipo: 'Nome' }, { rotulo: 'E-mail', tipo: 'E-mail' }] };
}
function temRespostas_(id) {
  var marca = '"' + id + '":';
  return lerTudo_('PARTICIPANTES').some(function (p) { return p.respostas.indexOf(marca) >= 0; });
}
/** Salva a lista completa de campos extras (na ordem recebida). Campos que sumiram da lista são ocultados; as respostas antigas ficam gravadas. */
function salvarFormulario(token, campos) {
  var s = exigir_(token, ['admin']);
  if (!Array.isArray(campos)) return { ok: false, mensagem: 'Dados inválidos.' };
  if (campos.length > MAX_CAMPOS_FORM) return { ok: false, mensagem: 'O formulário aceita até ' + MAX_CAMPOS_FORM + ' campos além dos fixos.' };
  var nomes = {}, saida = [];
  for (var i = 0; i < campos.length; i++) {
    var c = campos[i] || {}, rot = limitar_(c.rotulo, 80), tipo = String(c.tipo || ''), ch = chaveTexto_(rot);
    if (!rot) return { ok: false, mensagem: 'O campo #' + (i + 1) + ' está sem nome.' };
    if (ROTULOS_RESERVADOS_.indexOf(ch) >= 0) return { ok: false, mensagem: '"' + rot + '" já existe como campo fixo do formulário.' };
    if (nomes[ch]) return { ok: false, mensagem: 'Nome de campo repetido: "' + rot + '".' };
    nomes[ch] = 1;
    if (TIPOS_CAMPO.indexOf(tipo) < 0) return { ok: false, mensagem: 'Tipo inválido no campo "' + rot + '".' };
    var ops = [];
    if (tipo === T_SELECT || tipo === T_CHECK) {
      var vistos = {};
      listaOpcoes_(Array.isArray(c.opcoes) ? c.opcoes.join(',') : c.opcoes).forEach(function (o) { if (!vistos[chaveTexto_(o)]) { vistos[chaveTexto_(o)] = 1; ops.push(o); } });
      if (ops.length < 1 || ops.length > 30) return { ok: false, mensagem: 'O campo "' + rot + '" precisa de 1 a 30 opções.' };
      if (ops.some(function (o) { return o.length > 60; })) return { ok: false, mensagem: 'As opções de "' + rot + '" aceitam até 60 caracteres cada.' };
    }
    saida.push({ id: /^F[A-F0-9]{10}$/.test(String(c.id || '')) ? c.id : '', rotulo: rot, tipo: tipo, placeholder: limitar_(c.placeholder, 120), obrigatorio: !!c.obrigatorio, opcoes: ops.join(', ') });
  }
  return comTrava_(function () {
    var existentes = lerTudo_('FORMULARIO'), porId = {};
    existentes.forEach(function (x) { porId[x.id] = x; });
    for (var k = 0; k < saida.length; k++) {
      var ant = saida[k].id && porId[saida[k].id];
      if (ant && ant.tipo !== saida[k].tipo && temRespostas_(ant.id)) return { ok: false, mensagem: 'Não dá para mudar o tipo do campo "' + ant.rotulo + '" porque já existem respostas. Crie um campo novo.' };
    }
    var usados = {};
    saida.forEach(function (c, idx) {
      var o = c.id ? porId[c.id] : null;
      if (!o) o = { id: novoId_('F') };
      o.rotulo = c.rotulo; o.tipo = c.tipo; o.placeholder = c.placeholder; o.obrigatorio = c.obrigatorio ? 'Sim' : 'Não'; o.opcoes = c.opcoes; o.ordem = String(idx + 1); o.ativo = 'Sim';
      if (o.__linha) gravar_('FORMULARIO', o); else anexar_('FORMULARIO', o);
      usados[o.id] = 1;
    });
    existentes.forEach(function (x) { if (!usados[x.id] && sim_(x.ativo)) { x.ativo = 'Não'; gravar_('FORMULARIO', x); } });
    auditar_(s, 'Formulário de inscrição salvo', 'formulário', saida.length + ' campo(s) extra(s)');
    return { ok: true, mensagem: 'Formulário salvo.' };
  });
}

/** Para o resumo do administrador: nos campos de seleção, quantos se inscreveram e quantos têm presença. */
function analiseCampos_() {
  var campos = camposFormulario_(false).filter(function (c) { return c.tipo === T_SELECT || c.tipo === T_CHECK; });
  if (!campos.length) return [];
  var pres = presencasPorCpf_(), todos = lerTudo_('PARTICIPANTES');
  return campos.map(function (c) {
    var cont = {};
    todos.forEach(function (p) {
      var v = respostasDe_(p)[c.id];
      if (!v) return;
      (c.tipo === T_CHECK ? String(v).split(', ') : [v]).forEach(function (x) {
        cont[x] = cont[x] || { valor: x, inscritos: 0, comPresenca: 0 };
        cont[x].inscritos++;
        if (pres[p.cpf]) cont[x].comPresenca++;
      });
    });
    return { id: c.id, rotulo: c.rotulo, valores: Object.keys(cont).map(function (k) { return cont[k]; }).sort(function (a, b) { return b.inscritos - a.inscritos; }).slice(0, 15) };
  });
}

/* ============================================================================
 * SEÇÃO 5 — CERTIFICADOS e registro central
 * HORAS NO CERTIFICADO = soma da carga horária dos dias com presença válida. Se as presenças ou o nome mudarem depois da emissão,
 * o certificado passa a constar como "Desatualizado" e é regerado com o MESMO código (a central atualiza o registro, não duplica).
 * MARCADORES aceitos no template (caixas de texto do Slides):
 *   {{NOME}} {{CPF}} {{HORAS}} {{CODIGO}} {{QRCODE}} {{EVENTO}} {{PERIODO}} {{DIAS_PRESENTES}} {{DATA_EMISSAO}}
 * Trechos de QR Code e de comunicação assinada com o registro central vêm do webinário (já em produção).
 * ============================================================================ */

function extrairIdDrive_(link) {
  var s = String(link || '').trim();
  if (!s) return '';
  var m = s.match(/\/d\/([a-zA-Z0-9_-]{15,})/) || s.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{15,}$/.test(s) ? s : '';
}
function pastaDaPlanilha_(nome) {
  var arquivo = DriveApp.getFileById(ss_().getId()), pais = arquivo.getParents();
  var pasta = pais.hasNext() ? pais.next() : DriveApp.getRootFolder();
  var it = pasta.getFoldersByName(nome);
  return it.hasNext() ? it.next() : pasta.createFolder(nome);
}
function obterPastaCertificados() { return pastaDaPlanilha_(NOME_PASTA_CERT); }

/** O QR Code leva ao endereço principal (Netlify, quando informado) com ?cert=CODIGO. */
function montarUrlValidacao_(cfg, codigo) {
  var u = getUrlApp_(cfg);
  return u + (u.indexOf('?') > -1 ? '&' : '?') + 'cert=' + encodeURIComponent(codigo);
}

function coletarShapes_(elementos, saida) {
  elementos.forEach(function (el) {
    var tipo = el.getPageElementType();
    if (tipo === SlidesApp.PageElementType.SHAPE) saida.push(el.asShape());
    else if (tipo === SlidesApp.PageElementType.GROUP) coletarShapes_(el.asGroup().getChildren(), saida);
  });
}

/** Substitui a caixa {{QRCODE}} pela imagem do QR (QuickChart) na mesma posição. */
function inserirQRCode_(apresentacao, urlValidacao) {
  var qrUrl = 'https://quickchart.io/qr?text=' + encodeURIComponent(urlValidacao) + '&size=500&margin=1&format=png';
  var resp = UrlFetchApp.fetch(qrUrl, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    throw new Error('Não foi possível gerar o QR Code (HTTP ' + resp.getResponseCode() + ').');
  }
  var qrBlob = resp.getBlob().setName('qrcode.png');
  var inseriu = false;

  apresentacao.getSlides().forEach(function (slide) {
    var shapes = [];
    coletarShapes_(slide.getPageElements(), shapes);
    shapes.forEach(function (shape) {
      var texto = '';
      try { texto = shape.getText().asString(); } catch (e) { return; }
      if (texto.indexOf('{{QRCODE}}') < 0) return;
      var esq = shape.getLeft(), topo = shape.getTop(), larg = shape.getWidth(), alt = shape.getHeight();
      var lado = Math.min(larg, alt);
      shape.remove();
      slide.insertImage(qrBlob, esq + (larg - lado) / 2, topo + (alt - lado) / 2, lado, lado);
      inseriu = true;
    });
  });

  if (!inseriu) {
    throw new Error('O template do certificado não possui uma caixa de texto com a marcação {{QRCODE}}.');
  }
}

function textoPresencas_(rs) {
  return diasAtivos_().filter(function (d) { return rs.presencas[d.id]; }).map(function (d) { return d.data.substring(0, 5); }).join(', ');
}
function textoPeriodo_() {
  var d = diasAtivos_();
  if (!d.length) return '';
  return d.length === 1 ? d[0].data : d[0].data + ' a ' + d[d.length - 1].data;
}

/** Gera o PDF a partir do template e salva na pasta "Certificados Emitidos". */
function criarPDFCertificado_(cfg, dados) {
  var idTemplate = extrairIdDrive_(cfg[CFG.TEMPLATE]);
  if (!idTemplate) throw new Error('Configure o "Link do Template do Certificado" nas Configurações.');
  if (!/^https:\/\//i.test(getUrlApp_(cfg))) throw new Error('Configure o "Link da Aplicação" para gerar o QR Code.');
  var copia = DriveApp.getFileById(idTemplate).makeCopy('TMP_CERT_' + dados.codigo), idCopia = copia.getId();
  try {
    var apresentacao = SlidesApp.openById(idCopia);
    inserirQRCode_(apresentacao, montarUrlValidacao_(cfg, dados.codigo));
    apresentacao.replaceAllText('{{NOME}}', dados.nome);
    apresentacao.replaceAllText('{{CPF}}', dados.cpf);
    apresentacao.replaceAllText('{{CODIGO}}', dados.codigo);
    apresentacao.replaceAllText('{{HORAS}}', horasTexto_(dados.horas));
    apresentacao.replaceAllText('{{EVENTO}}', String(cfg[CFG.NOME]));
    apresentacao.replaceAllText('{{PERIODO}}', dados.periodo);
    apresentacao.replaceAllText('{{DIAS_PRESENTES}}', dados.diasPresentes);
    apresentacao.replaceAllText('{{DATA_EMISSAO}}', dados.emissao);
    apresentacao.saveAndClose();
    var nomeArquivo = 'Certificado - ' + String(dados.nome).replace(/[\\\/:*?"<>|]/g, '').trim() + '.pdf';
    var pdf = DriveApp.getFileById(idCopia).getAs(MimeType.PDF).setName(nomeArquivo);
    var arquivo = obterPastaCertificados().createFile(pdf);
    try { arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
    catch (e) { arquivo.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW); }
    return { blob: arquivo.getBlob(), url: arquivo.getUrl() };
  } finally {
    try { DriveApp.getFileById(idCopia).setTrashed(true); } catch (e2) { /* ignora */ }
  }
}
function obterBlobPorLink_(link) {
  var id = extrairIdDrive_(link);
  if (!id) return null;
  try { var f = DriveApp.getFileById(id); return f.isTrashed() ? null : f.getBlob(); } catch (e) { return null; }
}
function gerarCodigoCert_() {
  var usados = {};
  lerTudo_('PARTICIPANTES').forEach(function (p) { if (p.certCodigo) usados[p.certCodigo] = true; });
  var c;
  do { c = 'CERT-' + Utilities.getUuid().replace(/-/g, '').substring(0, 8).toUpperCase(); } while (usados[c]);
  return c;
}
function frequenciaOk_(cfg, rs) {
  var fmin = parseFloat(String(cfg[CFG.FREQ_MIN] || '').replace(',', '.'));
  return isNaN(fmin) || fmin <= 0 || rs.horasTotais <= 0 || (rs.horas / rs.horasTotais) * 100 >= fmin;
}

/**
 * Emite (ou reaproveita) o certificado de um CPF. Reaproveita o PDF só se as horas continuam as mesmas;
 * a geração pesada acontece dentro da trava para que o mesmo CPF não gere dois PDFs.
 */
function emitirCertificado_(cpf, opcoes) {
  opcoes = opcoes || {};
  var p0 = indice_('PARTICIPANTES', 'cpf')[cpf];
  if (!p0) return { ok: false, mensagem: 'Participante não encontrado.' };
  var rs0 = resumoDe_(cpf);
  if (rs0.dias === 0) return { ok: false, mensagem: 'Sem presença registrada.' };
  if (p0.certCodigo && p0.certLink && String(p0.certHoras) === String(rs0.horas) && !opcoes.refazer) {
    var existente = obterBlobPorLink_(p0.certLink);
    if (existente) return { ok: true, codigo: p0.certCodigo, link: p0.certLink, blob: existente, nome: p0.nome, email: p0.email, cfg: cfg_(), horas: rs0.horas };
  }
  return comTrava_(function () {
    var p = indice_('PARTICIPANTES', 'cpf')[cpf], cfg = cfg_(), rs = resumoDe_(cpf);
    if (!p) return { ok: false, mensagem: 'Participante não encontrado.' };
    if (rs.dias === 0) return { ok: false, mensagem: 'Sem presença registrada.' };
    var codigo = p.certCodigo || gerarCodigoCert_(), linkAntigo = p.certLink;
    var gerado = criarPDFCertificado_(cfg, { nome: p.nome, cpf: formatarCPF_(p.cpf), codigo: codigo, horas: rs.horas, periodo: textoPeriodo_(), diasPresentes: textoPresencas_(rs), emissao: hojeTxt_() });
    p.certCodigo = codigo; p.certLink = gerado.url; p.certHoras = String(rs.horas); p.certEmitidoEm = hojeTxt_();
    p.registro = registroConfig_ativo_(cfg) ? 'Pendente' : p.registro;
    p.atualizadoEm = agoraTxt_();
    gravar_('PARTICIPANTES', p);
    var idAntigo = extrairIdDrive_(linkAntigo);
    if (idAntigo && linkAntigo !== gerado.url) { try { DriveApp.getFileById(idAntigo).setTrashed(true); } catch (e) { /* ignora */ } }
    return { ok: true, codigo: codigo, link: gerado.url, blob: gerado.blob, nome: p.nome, email: p.email, cfg: cfg, horas: rs.horas };
  }, 60000);
}
function registroConfig_ativo_(cfg) { return configRegistro_(cfg).ativo; }

/** Download pelo próprio participante, depois das regras (presença, frequência, pesquisa, liberação). */
function gerarCertificadoParticipante(token) {
  var ctx = exigirParticipante_(token), cfg = cfg_(), agora = Date.now();
  var cpf = ctx.s.cpf, p = ctx.p, rs = resumoDe_(cpf);
  var el = elegibilidadeCertificado_(cfg, p, rs, agora);
  if (!el.liberado) return { ok: false, mensagem: el.motivo };
  if (contagem_('CG_' + cpf) >= 10) return { ok: false, mensagem: 'Muitos downloads seguidos. Aguarde alguns minutos.' };
  contar_('CG_' + cpf, 600);
  try {
    var r = emitirCertificado_(cpf, {});
    if (!r.ok) return { ok: false, mensagem: r.mensagem };
    try { sincronizarRegistro_(5, false, 20000); } catch (eReg) { Logger.log('Registro central: ' + eReg); }
    return { ok: true, codigo: r.codigo, nomeArquivo: 'Certificado - ' + String(r.nome).replace(/[\\\/:*?"<>|]/g, '').trim() + '.pdf', base64: Utilities.base64Encode(r.blob.getBytes()) };
  } catch (e) {
    Logger.log('Erro ao gerar certificado: ' + e);
    return { ok: false, mensagem: 'Não foi possível gerar o certificado agora. Tente novamente em instantes.' };
  }
}

function enviarEmailCertificado_(cfg, nome, email, codigo, blob) {
  if (!emailValido_(email) || MailApp.getRemainingDailyQuota() < 1) return false;
  var corpo = '<p style="margin:0 0 14px 0;font-size:15px;line-height:1.5;">Olá, <strong>' + esc_(primeiroNome_(nome)) + '</strong>! Obrigado por participar. Seu certificado está anexo a este e-mail, em PDF.</p>' +
    '<p style="margin:0;font-size:15px;"><strong>Código de validação:</strong> ' + esc_(codigo) + '</p>';
  MailApp.sendEmail({ name: NOME_REMETENTE, to: email.trim(), subject: 'Seu certificado: ' + String(cfg[CFG.NOME]), htmlBody: montarEmailHTML_(cfg, 'Seu certificado está pronto', corpo, null), body: 'Seu certificado está anexo. Código: ' + codigo, attachments: [blob] });
  return true;
}

/**
 * Emissão em lote (administrador). Não exige a pesquisa nem a data de liberação, mas respeita a frequência mínima.
 * modo "pendentes": quem tem presença e ainda não tem certificado ou tem certificado desatualizado.
 * modo "selecionados": os CPFs informados (reemite).
 */
function emitirCertificadosLote(token, modo, cpfs, opcoes) {
  var s = exigir_(token, ['admin']);
  opcoes = opcoes || {};
  var enviarEmail = opcoes.enviarEmail !== false, limite = Date.now() + LIMITE_EXECUCAO_MS, cfg = cfg_();
  var alvos = [], r = { emitidos: 0, enviados: 0, semEmail: 0, ignorados: [], falhas: [], pendentes: 0, interrompido: false };
  var cadastro = lerTudo_('PARTICIPANTES');
  if (modo === 'pendentes') {
    cadastro.forEach(function (p) {
      var rs = resumoDe_(p.cpf);
      if (rs.dias === 0) return;
      if (!frequenciaOk_(cfg, rs)) { r.ignorados.push({ nome: p.nome, motivo: 'abaixo da frequência mínima' }); return; }
      if (p.certCodigo && String(p.certHoras) === String(rs.horas)) return;
      alvos.push(p.cpf);
    });
  } else if (modo === 'selecionados') {
    if (!Array.isArray(cpfs) || !cpfs.length) return { ok: false, mensagem: 'Selecione ao menos um participante.' };
    var vistos = {};
    cpfs.forEach(function (c) {
      var d = soDigitos_(c);
      if (vistos[d]) return; vistos[d] = true;
      var p = indice_('PARTICIPANTES', 'cpf')[d], rs = p ? resumoDe_(d) : null;
      if (!p) r.ignorados.push({ nome: d, motivo: 'não encontrado' });
      else if (rs.dias === 0) r.ignorados.push({ nome: p.nome, motivo: 'sem presença' });
      else if (!frequenciaOk_(cfg, rs)) r.ignorados.push({ nome: p.nome, motivo: 'abaixo da frequência mínima' });
      else alvos.push(d);
    });
  } else return { ok: false, mensagem: 'Modo de emissão inválido.' };

  for (var n = 0; n < alvos.length; n++) {
    if (Date.now() > limite) { r.pendentes = alvos.length - n; r.interrompido = true; break; }
    var cpf = alvos[n], nomeP = (indice_('PARTICIPANTES', 'cpf')[cpf] || {}).nome || cpf;
    try {
      var e = emitirCertificado_(cpf, { refazer: modo === 'selecionados' });
      if (!e.ok) { r.falhas.push({ nome: nomeP, erro: e.mensagem }); continue; }
      r.emitidos++;
      if (!enviarEmail) continue;
      if (!emailValido_(e.email)) { r.semEmail++; continue; }
      try { if (enviarEmailCertificado_(e.cfg, e.nome, e.email, e.codigo, e.blob)) r.enviados++; else r.falhas.push({ nome: nomeP, erro: 'emitido, e-mail não enviado (cota diária esgotada)' }); }
      catch (eMail) { r.falhas.push({ nome: nomeP, erro: 'emitido, falha no e-mail: ' + eMail.message }); }
    } catch (err) { r.falhas.push({ nome: nomeP, erro: err && err.message ? err.message : String(err) }); }
  }
  try { sincronizarRegistro_(60, false, 60000); } catch (eReg) { Logger.log('Registro central: ' + eReg); }
  auditar_(s, 'Emissão de certificados em lote', modo, r.emitidos + ' emitidos, ' + r.falhas.length + ' falhas');
  r.ok = true;
  return r;
}

/** Rota pública de autenticidade (QR Code). */
function validar_certificado(codigo) {
  var cod = String(codigo || '').trim().toUpperCase();
  var invalido = { ok: true, valido: false, mensagem: 'Certificado não encontrado ou inválido.' };
  if (!/^CERT-[A-Z0-9]{6,12}$/.test(cod)) return invalido;
  if (contagem_('VCERT_G') >= 600) return { ok: false, mensagem: 'Muitas consultas. Tente novamente em alguns minutos.' };
  contar_('VCERT_G', 300);
  var p = lerTudo_('PARTICIPANTES').filter(function (x) { return x.certCodigo.toUpperCase() === cod; })[0];
  if (!p) return invalido;
  return { ok: true, valido: true, nome: p.nome, evento: cfg_()[CFG.NOME], horas: p.certHoras, periodo: textoPeriodo_(), emitidoEm: p.certEmitidoEm, codigo: cod, mensagem: 'Certificado válido e autêntico.' };
}

/* ===================== REGISTRO CENTRAL DE CERTIFICADOS ===================== */
/* Cada certificado emitido é avisado à central por HTTPS, com assinatura HMAC-SHA256 feita com a chave da fonte.
   A chave fica nas Propriedades do Script, nunca na planilha. Se a central estiver fora do ar, o certificado continua
   válido aqui e o envio é repetido pela rotina (coluna "Registro Central"). */

function configRegistro_(cfg) {
  var sp = PropertiesService.getScriptProperties(), pAtivo = sp.getProperty('REGISTRO_ATIVO');
  return {
    ativo: pAtivo !== null ? pAtivo === 'Sim' : sim_(cfg[CFG.REG_ATIVO]),
    url: String(sp.getProperty('REGISTRO_URL') || cfg[CFG.REG_URL] || '').trim(),
    fonte: String(sp.getProperty('REGISTRO_FONTE') || cfg[CFG.REG_FONTE] || '').trim(),
    chave: sp.getProperty('REGISTRO_CHAVE') || ''
  };
}

/** De onde vem cada valor em uso: propriedades do script, planilha ou nenhum. */
function origemConfigRegistro_(cfg) {
  var sp = PropertiesService.getScriptProperties();
  var de = function (prop, chaveCfg) { return sp.getProperty(prop) ? 'propriedades' : (String(cfg[chaveCfg] || '').trim() ? 'planilha' : 'não definido'); };
  return { ativo: sp.getProperty('REGISTRO_ATIVO') !== null ? 'propriedades' : (sim_(cfg[CFG.REG_ATIVO]) ? 'planilha' : 'não definido'), url: de('REGISTRO_URL', CFG.REG_URL), fonte: de('REGISTRO_FONTE', CFG.REG_FONTE), chave: sp.getProperty('REGISTRO_CHAVE') ? 'propriedades' : 'não definido' };
}

function registroPronto_(r) {
  return r.ativo && /^https:\/\/script\.google\.com\//.test(r.url) && /^[A-Za-z0-9]{3,40}$/.test(r.fonte) && r.chave.length >= 20;
}

/** O que ainda falta para o registro central funcionar, em linguagem de quem está configurando. */
function faltasRegistro_(r) {
  var f = [];
  if (!r.ativo) f.push('ativar o registro (campo "Registro Central Ativo": escolha Sim)');
  if (!r.url) f.push('o endereço do registro central');
  else if (!/^https:\/\/script\.google\.com\//.test(r.url)) f.push('corrigir o endereço (deve começar com https://script.google.com/ e terminar em /exec)');
  if (!/^[A-Za-z0-9]{3,40}$/.test(r.fonte)) f.push('o ID da fonte');
  if (r.chave.length < 20) f.push('a chave da fonte (cole e clique em "Salvar chave")');
  return f;
}
function mensagemFaltasRegistro_(r) {
  return 'Ainda falta: ' + faltasRegistro_(r).join('; ') + '. Preencha o bloco "Registro central de certificados", em Configurações, e clique em "Salvar conexão". ' +
    'O que o servidor lê agora: registro ' + (r.ativo ? 'ativo' : 'desativado') + '; endereço ' + (r.url ? 'preenchido' : 'vazio') + '; ID ' + (r.fonte ? 'preenchido' : 'vazio') + '; chave ' + (r.chave ? 'salva' : 'não salva') + '.';
}

function hexRegistro_(bytes) {
  return bytes.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length < 2 ? '0' + v : v; }).join('');
}

function assinarRegistro_(chave, fonte, ts, nonce, acao, dadosTexto) {
  return hexRegistro_(Utilities.computeHmacSha256Signature([fonte, ts, nonce, acao, dadosTexto].join('|'), chave));
}

function enviarAoRegistro_(r, acao, dados) {
  var ts = Math.floor(Date.now() / 1000);
  var nonce = Utilities.getUuid().replace(/-/g, '').substring(0, 24);
  var dadosTexto = JSON.stringify(dados);
  var corpo = { fonte: r.fonte, ts: ts, nonce: nonce, acao: acao, dadosTexto: dadosTexto, assinatura: assinarRegistro_(r.chave, r.fonte, ts, nonce, acao, dadosTexto) };
  var resp = UrlFetchApp.fetch(r.url, { method: 'post', contentType: 'text/plain; charset=utf-8', payload: JSON.stringify(corpo), muteHttpExceptions: true, followRedirects: true });
  var j;
  try { j = JSON.parse(resp.getContentText()); } catch (e) { throw new Error('Resposta inesperada do registro central (HTTP ' + resp.getResponseCode() + '). Confira o endereço e se o aplicativo está publicado para "Qualquer pessoa".'); }
  if (!j.sucesso) throw new Error(j.erro || 'O registro central recusou a mensagem.');
  return j.dados;
}

function textoCurto_(t) { return String(t == null ? '' : t).replace(/\s+/g, ' ').substring(0, 120); }

/** Dados do evento para a central. A data é a do primeiro dia, fixada no primeiro envio: a central identifica a turma por fonte + nome + data. */
function eventoParaRegistro_(cfg) {
  var sp = PropertiesService.getScriptProperties(), dias = diasAtivos_(), tot = 0;
  dias.forEach(function (d) { tot += horasNum_(d.horas) || 0; });
  var data = sp.getProperty('REGISTRO_DATA_EVENTO');
  if (!data) { data = dias.length ? dias[0].data : hojeTxt_(); sp.setProperty('REGISTRO_DATA_EVENTO', data); }
  var temLocal = sim_(cfg[CFG.EXIBIR_LOCAL]) && !!cfg[CFG.LOCAL];
  var temOnline = sim_(cfg[CFG.TRANSMISSAO]) && (/^https:\/\//i.test(cfg[CFG.ZOOM]) || dias.some(function (d) { return /^https:\/\//i.test(d.link); }));
  return { id: ss_().getId(), nome: cfg[CFG.NOME], data: data, horas: Math.round(tot * 100) / 100, local: temLocal ? cfg[CFG.LOCAL] : '', modalidade: temLocal && temOnline ? 'Híbrida' : (temOnline ? 'Remota' : 'Presencial') };
}

/** Certificados ainda não aceitos pela central: sem marca, "Pendente" ou "Erro". "Recusado" só entra se pedido. */
function listarPendentesRegistro_(incluirRecusados) {
  return lerTudo_('PARTICIPANTES').filter(function (p) {
    if (!p.certCodigo) return false;
    var reg = String(p.registro || '').trim();
    if (reg.indexOf('Enviado') === 0) return false;
    if (reg.indexOf('Recusado') === 0 && !incluirRecusados) return false;
    return true;
  });
}
function gravarMarcasRegistro_(marcas) {
  if (!Object.keys(marcas).length) return;
  comTrava_(function () {
    lerTudo_('PARTICIPANTES').forEach(function (p) {
      if (p.certCodigo && marcas[p.certCodigo] !== undefined) { p.registro = marcas[p.certCodigo]; gravar_('PARTICIPANTES', p); }
    });
  });
}
/** Envia até "max" certificados pendentes, em remessas de 25. Nunca interrompe a emissão: quem chama ignora falhas. */
function sincronizarRegistro_(max, incluirRecusados, limiteMs) {
  var cfg = cfg_(), reg = configRegistro_(cfg);
  var res = { ok: true, enviados: 0, recusados: 0, erros: 0, restantes: 0, mensagem: '' };
  if (!registroPronto_(reg)) { res.ok = false; res.mensagem = mensagemFaltasRegistro_(reg); return res; }
  var pend = listarPendentesRegistro_(incluirRecusados);
  res.restantes = pend.length;
  if (!pend.length) return res;
  var evento = eventoParaRegistro_(cfg), fila = pend.slice(0, max || 50), limite = Date.now() + (limiteMs || 240000), marcas = {};
  var agoraTxt = Utilities.formatDate(new Date(), tz_(), 'dd/MM/yyyy HH:mm');
  for (var i = 0; i < fila.length; i += 25) {
    if (Date.now() > limite) break;
    var parte = fila.slice(i, i + 25);
    var payload = { certificados: parte.map(function (p) {
      return { codigo: p.certCodigo, cpf: p.cpf, nome: p.nome, email: p.email, horas: p.certHoras, link: p.certLink, premiacao: p.certEmitidoEm || hojeTxt_(), enviado: false, evento: evento };
    }) };
    try {
      var rr = enviarAoRegistro_(reg, 'registrar', payload);
      (rr.resultados || []).forEach(function (x) {
        if (x.resultado === 'erro') { marcas[x.codigo] = 'Recusado: ' + textoCurto_(x.mensagem); res.recusados++; }
        else { marcas[x.codigo] = 'Enviado em ' + agoraTxt; res.enviados++; }
      });
    } catch (e) {
      parte.forEach(function (p) { if (!marcas[p.certCodigo]) marcas[p.certCodigo] = 'Erro: ' + textoCurto_(e && e.message ? e.message : e); });
      res.erros += parte.length; res.mensagem = e && e.message ? e.message : String(e);
      break;
    }
  }
  gravarMarcasRegistro_(marcas);
  res.restantes = Math.max(0, pend.length - res.enviados - res.recusados);
  return res;
}
/** Revogações de certificados cujo participante foi excluído. Uma tentativa por certificado, no máximo 50. */
function notificarRevogacoesRegistro_(codigos) {
  var reg = configRegistro_(cfg_());
  if (!codigos.length || !registroPronto_(reg)) return;
  codigos.slice(0, 50).forEach(function (cod) {
    try { enviarAoRegistro_(reg, 'revogar', { codigo: cod, motivo: 'inscrição excluída na aplicação de origem' }); } catch (e) { Logger.log('Revogação não enviada (' + cod + '): ' + e); }
  });
}

/* ---- funções do painel (administrador) ---- */

function salvarChaveRegistro(token, chave) {
  var s = exigir_(token, ['admin']);
  chave = String(chave == null ? '' : chave).trim();
  if (chave.length < 20) throw new Error('A chave deve ter ao menos 20 caracteres. Copie-a inteira, como mostrada pelo registro central.');
  PropertiesService.getScriptProperties().setProperty('REGISTRO_CHAVE', chave);
  auditar_(s, 'Chave do registro central salva', 'registro', '');
  return { ok: true, mensagem: 'Chave salva. Ela não será exibida de novo.' };
}
function salvarConexaoRegistro(token, d) {
  var s = exigir_(token, ['admin']);
  d = d || {};
  var ativo = simNao_(d.ativo), url = limparUrlApp_(String(d.url == null ? '' : d.url).trim()), fonte = String(d.fonte == null ? '' : d.fonte).trim(), chave = String(d.chave == null ? '' : d.chave).trim();
  var erros = [];
  if (url && !/^https:\/\/script\.google\.com\//.test(url)) erros.push('O endereço deve começar com https://script.google.com/ e terminar em /exec.');
  if (fonte && !/^[A-Za-z0-9]{3,40}$/.test(fonte)) erros.push('O ID da fonte deve ter só letras e números.');
  if (chave && chave.length < 20) erros.push('A chave parece incompleta (menos de 20 caracteres). Copie-a inteira.');
  if (erros.length) return { ok: false, mensagem: erros.join(' ') };
  var sp = PropertiesService.getScriptProperties();
  sp.setProperty('REGISTRO_ATIVO', ativo); sp.setProperty('REGISTRO_URL', url); sp.setProperty('REGISTRO_FONTE', fonte);
  if (chave) sp.setProperty('REGISTRO_CHAVE', chave);
  salvarCfg_(CFG.REG_ATIVO, ativo); salvarCfg_(CFG.REG_URL, url); salvarCfg_(CFG.REG_FONTE, fonte);
  var lido = configRegistro_(cfg_()), pronto = registroPronto_(lido);
  auditar_(s, 'Conexão com o registro central', 'registro', ativo);
  return { ok: true, pronto: pronto, faltas: pronto ? [] : faltasRegistro_(lido), mensagem: pronto ? 'Conexão salva. Agora use "Testar conexão".' : 'Conexão salva, mas ainda falta: ' + faltasRegistro_(lido).join('; ') + '.' };
}
function testarRegistro(token) {
  exigir_(token, ['admin']);
  var reg = configRegistro_(cfg_());
  if (!registroPronto_(reg)) return { ok: false, mensagem: mensagemFaltasRegistro_(reg) };
  try { var d = enviarAoRegistro_(reg, 'ping', {}); return { ok: true, mensagem: d.mensagem + ' Fonte: ' + d.fonte + '.' }; }
  catch (e) { return { ok: false, mensagem: e && e.message ? e.message : String(e) }; }
}
function statusRegistro(token) {
  exigir_(token, ['admin']);
  var t = { ok: true, certificados: 0, enviados: 0, pendentes: 0, recusados: 0, erros: 0 };
  lerTudo_('PARTICIPANTES').forEach(function (p) {
    if (!p.certCodigo) return;
    t.certificados++;
    var reg = String(p.registro || '').trim();
    if (reg.indexOf('Enviado') === 0) t.enviados++;
    else if (reg.indexOf('Recusado') === 0) t.recusados++;
    else if (reg.indexOf('Erro') === 0) { t.erros++; t.pendentes++; }
    else t.pendentes++;
  });
  var cfg = cfg_(), reg2 = configRegistro_(cfg);
  t.configurado = registroPronto_(reg2); t.faltas = t.configurado ? [] : faltasRegistro_(reg2); t.origem = origemConfigRegistro_(cfg);
  t.dataEventoNaCentral = PropertiesService.getScriptProperties().getProperty('REGISTRO_DATA_EVENTO') || '';
  return t;
}
function sincronizarRegistroAgora(token, incluirRecusados) {
  exigir_(token, ['admin']);
  var r = sincronizarRegistro_(100, !!incluirRecusados, 240000), st = statusRegistro(token);
  st.enviadosAgora = r.enviados; st.recusadosAgora = r.recusados; st.errosAgora = r.erros; st.ok = r.ok;
  st.mensagem = r.mensagem || (r.restantes ? 'Ainda há ' + r.restantes + ' certificado(s) para enviar: clique de novo.' : 'Tudo sincronizado.');
  return st;
}

/* ============================================================================
 * SEÇÃO 6 — ADMINISTRAÇÃO: configuração, banner, materiais, resumo, rotina, setup e entrada web
 * e entrada web (doGet, doPost com ponte para a Netlify).
 * ============================================================================ */

/* ================================ configuração ================================ */

function obterConfigAdmin(token) {
  exigir_(token, ['admin']);
  var cfg = cfg_(), reg = configRegistro_(cfg);
  return {
    ok: true, config: cfg, urlPadraoApp: (function () { try { return limparUrlApp_(ScriptApp.getService().getUrl()); } catch (e) { return ''; } })(),
    fusoServidor: tz_(), conexaoRegistro: { ativo: reg.ativo, url: reg.url, fonte: reg.fonte, chaveDefinida: !!reg.chave },
    chaves: CFG, padroes: CFG_PADRAO
  };
}

function listaEmailsValida_(txt) {
  var lista = String(txt || '').split(';').map(function (e) { return e.trim(); }).filter(Boolean);
  return lista.length <= 10 && lista.every(emailValido_) ? lista.join(' ; ') : null;
}
function salvarConfig(token, valores) {
  var s = exigir_(token, ['admin']);
  if (!valores || typeof valores !== 'object') throw new Error('Dados inválidos.');
  var atual = cfg_(), erros = [], aplicar = {};
  Object.keys(valores).forEach(function (k) {
    if (!(k in CFG_PADRAO)) return; // ignora chaves desconhecidas
    var v = valores[k] == null ? '' : String(valores[k]).trim();
    switch (k) {
      case CFG.STATUS: if (['Pendente', 'Homologação', 'Produção'].indexOf(v) < 0) erros.push('Status do evento inválido.'); break;
      case CFG.NOME: if (!v) erros.push('Informe o nome do evento.'); v = v.substring(0, 150); break;
      case CFG.SUBTITULO: case CFG.LOCAL: v = v.substring(0, 300); break;
      case CFG.OBS: v = v.substring(0, 2000); break;
      case CFG.EXIBIR_SUBTITULO: case CFG.EXIBIR_LOCAL: case CFG.FORA_LISTA: case CFG.CODIGO_EQUIPE: case CFG.EMAIL_SENHA_IMPORT:
      case CFG.NPS_EXIGIR: case CFG.TRANSMISSAO: case CFG.REG_ATIVO: v = simNao_(v); break;
      case CFG.NPS_LIB: case CFG.CERT_LIB: if (['Auto', 'Sim', 'Não'].indexOf(v) < 0) erros.push('Valor inválido em "' + k + '".'); break;
      case CFG.MIN_ANTES: case CFG.MIN_DEPOIS: if (!/^\d{1,3}$/.test(v) || +v > 240) erros.push('"' + k + '" aceita de 0 a 240 minutos.'); break;
      case CFG.SENHA_DIAS: if (!/^\d{1,2}$/.test(v) || +v < 1 || +v > 90) erros.push('A validade da senha temporária vai de 1 a 90 dias.'); break;
      case CFG.ZOOM_ANTECED: if (!/^\d{1,3}$/.test(v) || +v > 720) erros.push('"Liberar transmissão" aceita de 0 a 720 minutos antes do início.'); break;
      case CFG.FREQ_MIN: if (v && (!/^\d{1,3}([.,]\d)?$/.test(v) || parseFloat(v.replace(',', '.')) > 100 || parseFloat(v.replace(',', '.')) <= 0)) erros.push('A frequência mínima deve ficar entre 1 e 100, ou em branco.'); break;
      case CFG.BANNER: case CFG.ZOOM: if (v && !urlHttpsValida_(v)) erros.push('"' + k + '" deve começar com https://'); break;
      case CFG.APP: v = limparUrlApp_(v); if (v && !urlHttpsValida_(v)) erros.push('O link da aplicação deve começar com https://'); break;
      case CFG.TEMPLATE: if (v && !/^https:\/\//i.test(v) && !/^[a-zA-Z0-9_-]{15,}$/.test(v)) erros.push('Link do template inválido.'); break;
      case CFG.COR1: case CFG.COR2: if (!/^#[0-9a-fA-F]{6}$/.test(v)) erros.push('Cor inválida em "' + k + '" (use #RRGGBB).'); break;
      case CFG.ZOOM_SENHA: v = v.substring(0, 100); break;
      case CFG.FORM_ATIVO: case CFG.INSCR_ABERTAS: v = simNao_(v); break;
      case CFG.INSCR_ATE: if (v && parseDH_(v) === null) erros.push('Data limite das inscrições inválida. Use DD/MM/AAAA HH:MM.'); break;
      case CFG.META: if (v && !/^\d{1,6}$/.test(v)) erros.push('A meta de inscritos deve ser um número inteiro.'); break;
      case CFG.INSCR_TETO_HORA: if (!/^\d{1,4}$/.test(v) || +v < 1 || +v > 2000) erros.push('O teto de inscrições por hora vai de 1 a 2000.'); break;
      case CFG.EMAILS_EXTRAS: var le = listaEmailsValida_(v); if (le === null) erros.push('E-mails extras da equipe inválidos (máximo 10, separados por ;).'); else v = le; break;
      case CFG.FACILITADORES:
        var nomes = v.split(';').map(function (n) { return n.trim(); }).filter(Boolean);
        if (nomes.length > 10 || nomes.some(function (n) { return n.length > 120; })) erros.push('Informe no máximo 10 nomes de até 120 caracteres.');
        v = nomes.join(' ; '); break;
      case CFG.REG_URL: v = limparUrlApp_(v); if (v && !/^https:\/\/script\.google\.com\//.test(v)) erros.push('O endereço do registro central deve começar com https://script.google.com/'); break;
      case CFG.REG_FONTE: if (v && !/^[A-Za-z0-9]{3,40}$/.test(v)) erros.push('ID da fonte inválido (use só letras e números).'); break;
      default: v = v.substring(0, 500);
    }
    aplicar[k] = v;
  });
  if (erros.length) throw new Error(erros.join(' '));
  var mudou = [];
  comTrava_(function () {
    Object.keys(aplicar).forEach(function (k) { if (aplicar[k] !== atual[k]) { salvarCfg_(k, aplicar[k]); mudou.push(k); } });
  });
  var avisos = [];
  if (mudou.indexOf(CFG.APP) >= 0) avisos.push('Você alterou o endereço principal. QR Codes de certificados já impressos ou enviados continuam apontando para o endereço antigo.');
  auditar_(s, 'Configurações salvas', 'configuração', mudou.length + ' campo(s)');
  return { ok: true, mensagem: 'Configurações salvas.', avisos: avisos };
}

/* ================================== banner ================================== */

var MAX_BANNER_BYTES = 5 * 1024 * 1024;
function assinaturaImagemValida_(bytes, ext) {
  var b = function (i) { return (bytes[i] || 0) & 255; };
  if (ext === 'png') return b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4E && b(3) === 0x47;
  if (ext === 'jpg' || ext === 'jpeg') return b(0) === 0xFF && b(1) === 0xD8 && b(2) === 0xFF;
  if (ext === 'gif') return b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x38;
  if (ext === 'webp') return b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 && b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50;
  return false;
}
/** Recebe a imagem (base64), confere o conteúdo, guarda em pasta própria do Drive e aplica na configuração. O banner é PÚBLICO. */
function enviarBanner(token, m) {
  var s = exigir_(token, ['admin']);
  m = m || {};
  var nome = String(m.nomeArquivo || '').replace(/[\\\/:*?"<>|\r\n]/g, '').trim();
  var ext = (nome.match(/\.([A-Za-z0-9]{1,5})$/) || [])[1];
  ext = ext ? ext.toLowerCase() : '';
  var tipos = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
  if (!tipos[ext]) return { ok: false, mensagem: 'Use uma imagem JPG, PNG, WebP ou GIF.' };
  var b64 = String(m.base64 || '');
  if (!b64) return { ok: false, mensagem: 'Arquivo vazio.' };
  if (b64.length * 0.75 > MAX_BANNER_BYTES * 1.02) return { ok: false, mensagem: 'A imagem passa de 5 MB.' };
  var bytes = Utilities.base64Decode(b64);
  if (bytes.length > MAX_BANNER_BYTES) return { ok: false, mensagem: 'A imagem passa de 5 MB.' };
  if (!assinaturaImagemValida_(bytes, ext)) return { ok: false, mensagem: 'O arquivo não parece ser uma imagem ' + ext.toUpperCase() + ' válida.' };
  var pasta = pastaDaPlanilha_(NOME_PASTA_BANNER);
  var arquivo = pasta.createFile(Utilities.newBlob(bytes, tipos[ext], 'banner-' + Date.now() + '.' + ext)), publico = true;
  try { arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
  catch (e) { publico = false; try { arquivo.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW); } catch (e2) { /* mantém privado */ } }
  var it = pasta.getFiles();
  while (it.hasNext()) { var f = it.next(); if (f.getId() !== arquivo.getId()) { try { f.setTrashed(true); } catch (e3) { /* ignora */ } } }
  var url = 'https://drive.google.com/file/d/' + arquivo.getId() + '/view';
  salvarCfg_(CFG.BANNER, url);
  auditar_(s, 'Banner atualizado', 'configuração', '');
  return { ok: true, url: url, publico: publico, mensagem: publico ? 'Banner enviado e aplicado.' : 'Banner enviado, mas o domínio não permite links públicos: pessoas de fora da organização podem não vê-lo.' };
}

/* ================================== materiais ================================== */

var MAX_MATERIAL_BYTES = 20 * 1024 * 1024;
var EXT_MATERIAIS = {
  pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text', ods: 'application/vnd.oasis.opendocument.spreadsheet', odp: 'application/vnd.oasis.opendocument.presentation',
  txt: 'text/plain', csv: 'text/csv', rtf: 'application/rtf', zip: 'application/zip',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', mp3: 'audio/mpeg', mp4: 'video/mp4'
};
function lerMateriais_() {
  return lerTudo_('MATERIAIS').map(function (m) {
    return { id: m.id, titulo: m.titulo, descricao: m.descricao, tipo: m.tipo === 'Link' ? 'Link' : 'Arquivo', ref: m.ref, nomeArquivo: m.nomeArquivo, tamanho: Number(m.tamanho) || 0,
      quemVe: m.quemVe === QV_NPS ? QV_NPS : QV_AREA, ordem: Number(m.ordem) || 0, ativo: sim_(m.ativo), acessos: Number(m.acessos) || 0, criadoEm: m.criadoEm, __linha: m.__linha };
  }).sort(function (a, b) { return (a.ordem - b.ordem) || (a.__linha - b.__linha); });
}
function gravarMaterial_(m) {
  return gravar_('MATERIAIS', { __linha: m.__linha, id: m.id, titulo: m.titulo, descricao: m.descricao, tipo: m.tipo, ref: m.ref, nomeArquivo: m.nomeArquivo || '', tamanho: String(m.tamanho || 0),
    quemVe: m.quemVe, ordem: String(m.ordem), ativo: m.ativo ? 'Sim' : 'Não', acessos: String(m.acessos || 0), criadoEm: m.criadoEm });
}
function materialParaEquipe_(m) {
  return { id: m.id, titulo: m.titulo, descricao: m.descricao, tipo: m.tipo, tamanho: m.tamanho, nomeArquivo: m.nomeArquivo, quemVe: m.quemVe, ordem: m.ordem, ativo: m.ativo, acessos: m.acessos, criadoEm: m.criadoEm,
    url: m.tipo === 'Link' ? m.ref : 'https://drive.google.com/file/d/' + m.ref + '/view' };
}
function dadosMaterial_(m) {
  var titulo = limitar_(m && m.titulo, 150);
  if (!titulo) throw new Error('Informe o título do material.');
  return { titulo: titulo, descricao: limitar_(m && m.descricao, 500), quemVe: (m && m.quemVe === QV_NPS) ? QV_NPS : QV_AREA };
}
/** Administrador e facilitador gerenciam e liberam materiais. */
function listarMateriaisAdmin(token) {
  exigir_(token, PAPEIS);
  return { ok: true, materiais: lerMateriais_().map(materialParaEquipe_), limiteBytes: MAX_MATERIAL_BYTES, extensoes: Object.keys(EXT_MATERIAIS), opcoesQuemVe: [QV_AREA, QV_NPS] };
}
function salvarMaterial(token, m) {
  var s = exigir_(token, PAPEIS);
  m = m || {};
  var dados = dadosMaterial_(m);
  return comTrava_(function () {
    var lista = lerMateriais_();
    if (m.id) {
      var a = lista.filter(function (x) { return x.id === m.id; })[0];
      if (!a) return { ok: false, mensagem: 'Material não encontrado.' };
      a.titulo = dados.titulo; a.descricao = dados.descricao; a.quemVe = dados.quemVe;
      if (typeof m.ativo === 'boolean') a.ativo = m.ativo;
      if (a.tipo === 'Link' && m.url !== undefined) {
        var u = String(m.url).trim();
        if (!urlHttpsValida_(u)) return { ok: false, mensagem: 'O link deve começar com https://' };
        a.ref = u;
      }
      gravarMaterial_(a);
      auditar_(s, 'Material alterado', a.titulo, a.ativo ? 'liberado' : 'oculto');
      return { ok: true, mensagem: 'Material atualizado.' };
    }
    var url = String(m.url || '').trim();
    if (!urlHttpsValida_(url)) return { ok: false, mensagem: 'O link deve começar com https://' };
    var ordem = lista.reduce(function (mx, x) { return Math.max(mx, x.ordem); }, 0) + 1;
    anexar_('MATERIAIS', { id: 'M' + Date.now(), titulo: dados.titulo, descricao: dados.descricao, tipo: 'Link', ref: url, nomeArquivo: '', tamanho: '0', quemVe: dados.quemVe, ordem: String(ordem), ativo: 'Sim', acessos: '0', criadoEm: agoraTxt_() });
    auditar_(s, 'Material (link) adicionado', dados.titulo, '');
    return { ok: true, mensagem: 'Link adicionado.' };
  });
}
function enviarMaterialArquivo(token, m) {
  var s = exigir_(token, PAPEIS);
  m = m || {};
  var dados = dadosMaterial_(m);
  var nome = String(m.nomeArquivo || '').replace(/[\\\/:*?"<>|\r\n]/g, '').trim();
  var ext = (nome.match(/\.([A-Za-z0-9]{1,5})$/) || [])[1];
  ext = ext ? ext.toLowerCase() : '';
  if (!nome || !EXT_MATERIAIS[ext]) return { ok: false, mensagem: 'Tipo de arquivo não permitido: ' + (ext ? '.' + ext : 'sem extensão') + '.' };
  var b64 = String(m.base64 || '');
  if (!b64) return { ok: false, mensagem: 'Arquivo vazio.' };
  if (b64.length * 0.75 > MAX_MATERIAL_BYTES * 1.02) return { ok: false, mensagem: 'O arquivo passa do limite de ' + Math.round(MAX_MATERIAL_BYTES / 1048576) + ' MB. Use um link.' };
  var blob = Utilities.newBlob(Utilities.base64Decode(b64), EXT_MATERIAIS[ext], nome), tamanho = blob.getBytes().length;
  if (tamanho > MAX_MATERIAL_BYTES) return { ok: false, mensagem: 'O arquivo passa do limite de ' + Math.round(MAX_MATERIAL_BYTES / 1048576) + ' MB. Use um link.' };
  var arquivo = pastaDaPlanilha_(NOME_PASTA_MATERIAIS).createFile(blob); // criado sem compartilhamento: só o aplicativo o entrega
  return comTrava_(function () {
    var ordem = lerMateriais_().reduce(function (mx, x) { return Math.max(mx, x.ordem); }, 0) + 1;
    anexar_('MATERIAIS', { id: 'M' + Date.now(), titulo: dados.titulo, descricao: dados.descricao, tipo: 'Arquivo', ref: arquivo.getId(), nomeArquivo: nome, tamanho: String(tamanho), quemVe: dados.quemVe, ordem: String(ordem), ativo: 'Sim', acessos: '0', criadoEm: agoraTxt_() });
    auditar_(s, 'Material (arquivo) enviado', dados.titulo, nome);
    return { ok: true, mensagem: 'Arquivo enviado.', nome: nome };
  });
}
function excluirMaterial(token, id) {
  var s = exigir_(token, PAPEIS);
  return comTrava_(function () {
    var m = lerMateriais_().filter(function (x) { return x.id === id; })[0];
    if (!m) return { ok: false, mensagem: 'Material não encontrado.' };
    if (m.tipo === 'Arquivo') { try { DriveApp.getFileById(m.ref).setTrashed(true); } catch (e) { /* já removido */ } }
    apagarLinhas_('MATERIAIS', [m.__linha]);
    auditar_(s, 'Material excluído', m.titulo, '');
    return { ok: true, mensagem: 'Material excluído.' };
  });
}
function moverMaterial(token, id, direcao) {
  exigir_(token, PAPEIS);
  return comTrava_(function () {
    var lista = lerMateriais_(), i = -1;
    lista.forEach(function (x, k) { if (x.id === id) i = k; });
    var j = i + (direcao === 'subir' ? -1 : 1);
    if (i < 0 || j < 0 || j >= lista.length) return { ok: true };
    var tmp = lista[i]; lista[i] = lista[j]; lista[j] = tmp;
    lista.forEach(function (x, k) { x.ordem = k + 1; gravarMaterial_(x); });
    return { ok: true };
  });
}
/** Regra de acesso, aplicada no servidor a cada listagem e download. */
function materialLiberado_(p, m) { return m.ativo && (m.quemVe === QV_AREA || p.npsNota !== ''); }

function listarMateriaisParticipante(token) {
  var ctx = exigirParticipante_(token), p = ctx.p;
  var itens = lerMateriais_().filter(function (m) { return m.ativo; }).map(function (m) {
    var lib = materialLiberado_(p, m);
    return { id: m.id, titulo: m.titulo, tipo: m.tipo, tamanho: m.tamanho, liberado: lib, descricao: lib ? m.descricao : '', nomeArquivo: lib ? m.nomeArquivo : '', url: (lib && m.tipo === 'Link') ? m.ref : '', exigePesquisa: !lib };
  });
  return { ok: true, materiais: itens };
}
function baixarMaterialParticipante(token, id) {
  var ctx = exigirParticipante_(token), p = ctx.p;
  var m = lerMateriais_().filter(function (x) { return x.id === id && x.ativo; })[0];
  if (!m || m.tipo !== 'Arquivo') return { ok: false, mensagem: 'Material não encontrado.' };
  if (!materialLiberado_(p, m)) return { ok: false, mensagem: 'Responda a pesquisa de satisfação para liberar este material.' };
  try {
    var arquivo = DriveApp.getFileById(m.ref);
    if (arquivo.getSize() > MAX_MATERIAL_BYTES * 1.05) return { ok: false, mensagem: 'O arquivo é grande demais para ser entregue pelo portal. Procure a organização.' };
    var blob = arquivo.getBlob();
    somarAcessoMaterial_(m.id);
    return { ok: true, nomeArquivo: m.nomeArquivo || arquivo.getName(), mime: blob.getContentType() || 'application/octet-stream', base64: Utilities.base64Encode(blob.getBytes()) };
  } catch (e) {
    Logger.log('Falha ao entregar material: ' + e);
    return { ok: false, mensagem: 'Não foi possível abrir o arquivo agora. Tente novamente em instantes.' };
  }
}
function registrarAcessoMaterial(token, id) {
  var ctx = exigirParticipante_(token);
  var m = lerMateriais_().filter(function (x) { return x.id === id && x.tipo === 'Link'; })[0];
  if (!m || !materialLiberado_(ctx.p, m)) return { ok: false };
  somarAcessoMaterial_(id);
  return { ok: true };
}
function somarAcessoMaterial_(id) {
  var l = LockService.getScriptLock();
  if (!l.tryLock(3000)) return;
  try {
    _mem = {}; _idx = {};
    var m = lerMateriais_().filter(function (x) { return x.id === id; })[0];
    if (m) { m.acessos += 1; gravarMaterial_(m); }
  } finally { l.releaseLock(); }
}

/* ============================ resumo e exportação ============================ */

/** Administrador e facilitador veem a contagem por dia. Só o administrador vê totais de pessoas, pesquisa e certificados. */
function obterResumo(token) {
  var s = exigir_(token, PAPEIS), cfg = cfg_(), agora = Date.now(), cont = contagemPresencasPorDia_();
  var dias = todosDiasOrdenados_().map(function (d) { var x = descreverDiaEquipe_(d, cfg, agora, cont); return { id: x.id, data: x.data, titulo: x.titulo, estado: x.estado, presencas: x.presencas, abreEm: x.abreEm, status: x.status }; });
  var r = { ok: true, perfil: s.papel, dias: dias };
  if (s.papel !== 'admin') return r;
  var todos = lerTudo_('PARTICIPANTES'), soma = 0, resp = 0, prom = 0, neut = 0, detr = 0, certs = 0, desat = 0, comPres = 0, semSenha = 0;
  todos.forEach(function (p) {
    var rs = resumoDe_(p.cpf);
    if (rs.dias > 0) comPres++;
    if (p.certCodigo) { certs++; if (String(p.certHoras) !== String(rs.horas)) desat++; }
    if (p.npsNota !== '' && !isNaN(Number(p.npsNota))) { var n = Number(p.npsNota); resp++; soma += n; if (n >= 9) prom++; else if (n >= 7) neut++; else detr++; }
    if (!p.hash && emailValido_(p.email) && p.envioSenha !== 'Enviado') semSenha++;
  });
  r.participantes = todos.length; r.comPresenca = comPres; r.senhasPendentes = semSenha;
  r.inscritos = todos.filter(function (p) { return p.origem === 'Inscrição'; }).length; r.meta = parseInt(cfg[CFG.META], 10) || 0; r.analiseCampos = analiseCampos_();
  r.certificados = { emitidos: certs, desatualizados: desat };
  r.nps = { respondentes: resp, media: resp ? Math.round((soma / resp) * 10) / 10 : null, promotores: prom, neutros: neut, detratores: detr, score: resp ? Math.round(((prom - detr) / resp) * 100) : null };
  return r;
}
function exportarPresencasCsv(token) {
  var s = exigir_(token, ['admin']);
  var dias = todosDiasOrdenados_(), campos = camposFormulario_(false), cab = ['CPF', 'Nome', 'E-mail', 'Origem', 'Origem (UTM)', 'Inscrito em'];
  campos.forEach(function (c) { cab.push(c.rotulo); });
  dias.forEach(function (d) { cab.push('Dia ' + d.data + (d.status === 'Cancelado' ? ' (cancelado)' : '')); });
  cab = cab.concat(['Dias presentes', 'Horas', 'NPS', 'Certificado', 'Código do certificado']);
  var linhas = [cab];
  lerTudo_('PARTICIPANTES').forEach(function (p) {
    var rs = resumoDe_(p.cpf), resp = respostasDe_(p), l = [formatarCPF_(p.cpf), p.nome, p.email, p.origem, p.utm, p.inscritoEm];
    campos.forEach(function (c) { l.push(resp[c.id] || ''); });
    dias.forEach(function (d) { var pr = rs.presencas[d.id]; l.push(pr ? (pr.origem === 'manual' ? 'Presente (manual)' : 'Presente') : 'Ausente'); });
    linhas.push(l.concat([rs.dias, horasTexto_(rs.horas), p.npsNota, situacaoCertificado_(p, rs.horas), p.certCodigo]));
  });
  auditar_(s, 'Exportação de presenças', 'csv', String(linhas.length - 1) + ' linhas');
  return { ok: true, total: linhas.length - 1, csv: '\uFEFF' + linhas.map(function (l) { return l.map(csvCel_).join(';'); }).join('\r\n') + '\r\n' };
}

/* ========================= rotina agendada (a cada 5 min) ========================= */

function destinatariosEquipe_(cfg) {
  var vistos = {}, lista = [];
  lerTudo_('USUARIOS').forEach(function (u) { if (u.status === 'Ativo' && emailValido_(u.email)) { vistos[u.email.toLowerCase()] = 1; lista.push(u.email); } });
  String(cfg[CFG.EMAILS_EXTRAS] || '').split(';').map(function (e) { return e.trim(); }).filter(emailValido_).forEach(function (e) { if (!vistos[e.toLowerCase()]) { vistos[e.toLowerCase()] = 1; lista.push(e); } });
  return lista;
}
/** Quando a presença de um dia abre, envia o código à equipe (administradores, facilitadores e e-mails extras). Nunca aos alunos. */
function enviarCodigosEquipe_() {
  var cfg = cfg_();
  if (!sim_(cfg[CFG.CODIGO_EQUIPE]) || cfg[CFG.STATUS] === 'Pendente') return 0;
  var agora = Date.now(), enviados = 0;
  diasAtivos_().forEach(function (d) {
    if (d.codigoEnviadoEm || estadoDia_(d, cfg, agora) !== 'Aberta') return;
    var para = destinatariosEquipe_(cfg), j = janelaDia_(d, cfg), ok = 0;
    if (!para.length) return;
    var corpo = '<p style="margin:0 0 12px 0;font-size:15px;line-height:1.5;">A presença do encontro de <strong>' + esc_(d.data) + (d.titulo ? ' · ' + esc_(d.titulo) : '') + '</strong> está aberta para os participantes.</p>' +
      '<p style="margin:0 0 6px 0;font-size:14px;color:#4b5563;">Código da aula (informe aos participantes durante a aula; não o envie por escrito em grupos):</p>' +
      '<p style="margin:0 0 14px 0;font-size:28px;"><strong style="font-family:monospace;letter-spacing:3px;">' + esc_(d.codigo) + '</strong></p>' +
      '<p style="margin:0;font-size:14px;line-height:1.5;color:#4b5563;">A janela fecha às ' + esc_(fmt_(j.encerraMs, 'HH:mm')) + '. Quem esquecer pode ter a presença registrada pelo painel.</p>';
    var html = montarEmailHTML_(cfg, 'Código da aula de hoje', corpo, null);
    para.forEach(function (e) { if (enviarEmail_(e, 'Código da aula (' + d.data + '): ' + String(cfg[CFG.NOME]), html)) ok++; });
    if (ok > 0) {
      comTrava_(function () { var q = indice_('DIAS', 'id')[d.id]; if (q && !q.codigoEnviadoEm) { q.codigoEnviadoEm = agoraTxt_(); gravar_('DIAS', q); } });
      enviados++;
    }
  });
  return enviados;
}
function rotina() {
  var inicio = Date.now();
  try { enviarCodigosEquipe_(); } catch (e1) { Logger.log('Código à equipe: ' + e1); }
  try { processarFilaSenhas_(inicio + 150000); } catch (e2) { Logger.log('Fila de senhas: ' + e2); }
  try { sincronizarRegistro_(100, false, 90000); } catch (e3) { Logger.log('Registro central: ' + e3); }
}
function criarTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'rotina') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('rotina').timeBased().everyMinutes(5).create();
}

/* ================================== setup ================================== */

/** Execute uma vez no editor, antes da primeira publicação. É seguro repetir: não apaga dados nem configurações. */
function setup() {
  ss_();
  Object.keys(ABAS).forEach(function (k) { aba_(k); });
  if (!lerTudo_('FORMULARIO').length) {
    anexar_('FORMULARIO', { id: novoId_('F'), rotulo: 'Telefone', tipo: T_TEL, placeholder: '(00) 00000-0000', obrigatorio: 'Não', opcoes: '', ordem: '1', ativo: 'Sim' });
    anexar_('FORMULARIO', { id: novoId_('F'), rotulo: 'Empresa ou instituição', tipo: T_TEXTO, placeholder: 'Onde você trabalha ou estuda', obrigatorio: 'Não', opcoes: '', ordem: '2', ativo: 'Sim' });
  }
  var existentes = {};
  lerTudo_('CONFIG').forEach(function (r) { existentes[r.chave] = true; });
  Object.keys(CFG_PADRAO).forEach(function (k) { if (!existentes[k]) anexar_('CONFIG', { chave: k, valor: CFG_PADRAO[k] }); });
  var info = 'Setup concluído (v' + VERSAO + '). ';
  if (!lerTudo_('USUARIOS').length) {
    var email = '', temp = senhaTemporaria_();
    try { email = Session.getEffectiveUser().getEmail(); } catch (e) { email = ''; }
    anexar_('USUARIOS', { id: novoId_('U'), nome: 'Administração', email: (email || 'admin@exemplo.com').toLowerCase(), papel: 'admin', hash: criarHashSenha_(temp), trocarSenha: 'Sim', status: 'Ativo', criadoEm: agoraTxt_(), tentativas: '0', bloqueadoAte: '' });
    info += 'PRIMEIRO ACESSO — usuário: ' + (email || 'admin@exemplo.com') + ' | senha temporária: ' + temp + ' (o sistema pede a troca no primeiro login). ';
  }
  criarTrigger_();
  obterPastaCertificados(); pastaDaPlanilha_(NOME_PASTA_BANNER); pastaDaPlanilha_(NOME_PASTA_MATERIAIS);
  info += 'Gatilho de 5 minutos ativo e pastas do Drive prontas.';
  Logger.log(info);
  return info;
}
/** Esqueceu a senha do administrador? Rode no editor; a senha temporária aparece no registro de execução. */
function redefinirSenhaAdmin() {
  var u = adminsAtivos_()[0];
  if (!u) throw new Error('Nenhum administrador ativo. Rode setup().');
  var temp = senhaTemporaria_();
  u.hash = criarHashSenha_(temp); u.trocarSenha = 'Sim'; u.tentativas = '0'; u.bloqueadoAte = ''; gravar_('USUARIOS', u);
  Logger.log('Administrador: ' + u.email + ' | senha temporária: ' + temp);
  return u.email;
}

/* ================================ entrada web ================================ */

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (String(p.ping || '') === '1') return ContentService.createTextOutput('OK - Presença CISSA - servidor ' + VERSAO + ' - ' + new Date().toISOString()).setMimeType(ContentService.MimeType.TEXT);
  try {
    var cert = String(p.cert || '').replace(/[^A-Za-z0-9\-]/g, '').substring(0, 40), pub = obterConfigPublica();
    var utm = String(p.utm_source || p.utm || p.origem || '').replace(/[^A-Za-z0-9_\-\. ]/g, '').substring(0, 100);
    var tpl = HtmlService.createTemplateFromFile('index');
    // Os parâmetros da URL vêm do servidor porque a página roda em um iframe (location.search não os reflete).
    // "<" vira \u003c para que nenhum texto digitado pela equipe consiga fechar o <script> da página.
    tpl.params = JSON.stringify({ cert: cert, utm: utm, cfg: pub }).replace(/</g, '\\u003c');
    return tpl.evaluate().setTitle(String(pub.nome || 'Presença')).addMetaTag('viewport', 'width=device-width, initial-scale=1').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (erro) {
    var msg = String(erro && erro.message ? erro.message : erro).replace(/[<>&]/g, '');
    return HtmlService.createHtmlOutput('<div style="font-family:Arial,sans-serif;max-width:680px;margin:40px auto;padding:0 16px"><h2>Não foi possível montar a interface</h2><p>Servidor ' + VERSAO + '. Confira se o projeto tem um arquivo HTML chamado exatamente "index" e se o setup() foi executado.</p><p style="color:#666;font-size:13px">' + msg + '</p></div>');
  }
}

/**
 * Funções que a página pode chamar. É a MESMA lista usada via google.script.run, só que explícita:
 * qualquer outro nome é recusado. Cada função valida sessão e perfil sozinha.
 * Se criar uma função nova que a página chama, acrescente o nome aqui.
 */
var _tabelaApi = null;
function tabelaApi_() {
  if (_tabelaApi) return _tabelaApi;
  _tabelaApi = {
    obterConfigPublica: obterConfigPublica, verificarCpf: verificarCpf, registrarPresenca: registrarPresenca, validar_certificado: validar_certificado,
    entrarParticipante: entrarParticipante, sairParticipante: sairParticipante, trocarSenhaParticipante: trocarSenhaParticipante, esqueciSenha: esqueciSenha,
    obterArea: obterArea, enviarNpsParticipante: enviarNpsParticipante, gerarCertificadoParticipante: gerarCertificadoParticipante,
    listarMateriaisParticipante: listarMateriaisParticipante, baixarMaterialParticipante: baixarMaterialParticipante, registrarAcessoMaterial: registrarAcessoMaterial,
    entrar: entrar, sair: sair, trocarSenha: trocarSenha, eu: eu,
    listarUsuarios: listarUsuarios, salvarUsuario: salvarUsuario, redefinirSenhaUsuario: redefinirSenhaUsuario, listarAuditoria: listarAuditoria,
    listarDias: listarDias, salvarDia: salvarDia, excluirDia: excluirDia, alterarJanelaDia: alterarJanelaDia,
    buscarPessoa: buscarPessoa, registrarPresencaManual: registrarPresencaManual, corrigirPresenca: corrigirPresenca,
    previaImportacao: previaImportacao, confirmarImportacao: confirmarImportacao, listarParticipantes: listarParticipantes,
    adicionarParticipanteManual: adicionarParticipanteManual, salvarParticipante: salvarParticipante, reenviarSenhaParticipante: reenviarSenhaParticipante, excluirParticipantes: excluirParticipantes,
    verificarCpfInscricao: verificarCpfInscricao, processarInscricao: processarInscricao, obterFormularioAdmin: obterFormularioAdmin, salvarFormulario: salvarFormulario,
    emitirCertificadosLote: emitirCertificadosLote, obterConfigAdmin: obterConfigAdmin, salvarConfig: salvarConfig, enviarBanner: enviarBanner,
    listarMateriaisAdmin: listarMateriaisAdmin, salvarMaterial: salvarMaterial, enviarMaterialArquivo: enviarMaterialArquivo, excluirMaterial: excluirMaterial, moverMaterial: moverMaterial,
    obterResumo: obterResumo, exportarPresencasCsv: exportarPresencasCsv,
    salvarChaveRegistro: salvarChaveRegistro, salvarConexaoRegistro: salvarConexaoRegistro, testarRegistro: testarRegistro, statusRegistro: statusRegistro, sincronizarRegistroAgora: sincronizarRegistroAgora
  };
  return _tabelaApi;
}

/**
 * Ponte para a Netlify. Recebe { fn, args, segredo } da função da Netlify e devolve { sucesso, resultado } ou { sucesso:false, erro }.
 * Dois modos, ambos desligados por padrão (o uso direto pelo Apps Script continua funcionando sem eles):
 * - Netlify: propriedade SEGREDO_PONTE; a função da Netlify envia o segredo.
 * - GitHub Pages: propriedade API_DIRETA = Sim; o navegador chama o /exec sem segredo (um segredo em página estática seria público).
 * O segredo impede chamadas diretas ao doPost por terceiros, mas NÃO protege as funções em si: quem abre o endereço /exec
 * ainda consegue chamá-las pelo navegador. A proteção real está na validação de sessão, perfil e limites dentro de cada função.
 */
function doPost(e) {
  var saida = function (o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); };
  try {
    var props = PropertiesService.getScriptProperties(), segredo = props.getProperty('SEGREDO_PONTE'), direta = props.getProperty('API_DIRETA') === 'Sim';
    var corpo = JSON.parse((e && e.postData && e.postData.contents) || '{}'), enviado = corpo.segredo == null ? '' : String(corpo.segredo);
    if (enviado) { // chamada pela função da Netlify: o segredo precisa existir aqui e ser igual
      if (!segredo || !iguais_(enviado, segredo)) return saida({ sucesso: false, erro: 'ACESSO_NEGADO_PONTE: segredo da ponte inválido.' });
    } else if (!direta) { // chamada direta do navegador (GitHub Pages): só com API_DIRETA = Sim
      return saida({ sucesso: false, erro: segredo ? 'ACESSO_NEGADO_PONTE: segredo da ponte ausente.' : 'PONTE_DESATIVADA: defina SEGREDO_PONTE (Netlify) ou API_DIRETA = Sim (GitHub Pages).' });
    }
    var nome = String(corpo.fn || ''), tabela = tabelaApi_();
    if (!Object.prototype.hasOwnProperty.call(tabela, nome)) return saida({ sucesso: false, erro: 'FUNCAO_DESCONHECIDA: ' + nome.substring(0, 60) });
    var args = Array.isArray(corpo.args) ? corpo.args : [];
    if (args.length > 8) return saida({ sucesso: false, erro: 'ARGUMENTOS_DEMAIS' });
    var r = tabela[nome].apply(null, args);
    return saida({ sucesso: true, resultado: r === undefined ? null : r });
  } catch (err) {
    return saida({ sucesso: false, erro: String(err && err.message ? err.message : err).substring(0, 500) });
  }
}
