// Funções comuns dos hooks do gestor-tokens. Só Node, sem dependências.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

function lerStdin() {
  try {
    const txt = fs.readFileSync(0, 'utf8');
    return txt.trim() ? JSON.parse(txt) : {};
  } catch {
    return {};
  }
}

function lerJsonl(arquivo) {
  if (!arquivo || !fs.existsSync(arquivo)) return [];
  const linhas = fs.readFileSync(arquivo, 'utf8').split('\n');
  const out = [];
  for (const l of linhas) {
    if (!l.trim()) continue;
    try { out.push(JSON.parse(l)); } catch { /* linha parcial: ignora */ }
  }
  return out;
}

// Contexto ocupado = tudo o que entrou na última chamada da conversa principal.
function usoDoContexto(entradas) {
  for (let i = entradas.length - 1; i >= 0; i--) {
    const e = entradas[i];
    if (e.type !== 'assistant' || e.isSidechain) continue;
    const u = e.message && e.message.usage;
    // Mensagens "<synthetic>" (erros e avisos do próprio Claude Code) vêm com uso zerado.
    if (!u || e.message.model === '<synthetic>') continue;
    const tokens = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) +
      (u.cache_read_input_tokens || 0) + (u.output_tokens || 0);
    if (!tokens) continue;
    return { tokens, modelo: e.message.model || '' };
  }
  return { tokens: 0, modelo: '' };
}

// Janela por modelo. GESTOR_JANELA sobrepõe (ex.: 200000).
function janelaDoModelo(modelo) {
  const env = parseInt(process.env.GESTOR_JANELA || '', 10);
  if (env > 0) return env;
  const m = (modelo || '').toLowerCase();
  if (m.includes('[1m]')) return 1000000;
  if (/(fable|mythos)/.test(m)) return 1000000;
  if (/claude-(opus|sonnet|haiku)-5/.test(m)) return 1000000;
  if (/claude-(opus|sonnet)-4-[678]/.test(m)) return 1000000;
  return 200000;
}

function tokensDeTexto(v) {
  if (typeof v === 'number') return v;
  const m = String(v || '').trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([km]?)$/);
  if (!m) return 0;
  return Math.round(parseFloat(m[1]) * (m[2] === 'm' ? 1e6 : m[2] === 'k' ? 1e3 : 1));
}

// Onde a compactação automática dispara: a janela do modelo ou o autoCompactWindow, o menor.
// Precedência igual à do Claude Code: variável de ambiente, depois settings local > projeto > usuário.
function limiteDeCompactacao(modelo, cwd) {
  const janela = janelaDoModelo(modelo);
  let ajuste = tokensDeTexto(process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW);
  if (!ajuste) {
    const raiz = raizDoProjeto(cwd);
    const arquivos = [
      raiz && path.join(raiz, '.claude', 'settings.local.json'),
      raiz && path.join(raiz, '.claude', 'settings.json'),
      path.join(os.homedir(), '.claude', 'settings.json'),
    ].filter(Boolean);
    for (const f of arquivos) {
      try {
        const v = tokensDeTexto(JSON.parse(fs.readFileSync(f, 'utf8')).autoCompactWindow);
        if (v) { ajuste = v; break; }
      } catch { /* arquivo ausente ou inválido */ }
    }
  }
  return ajuste ? Math.min(janela, ajuste) : janela;
}

// ---- Notas de sessão ----

function textoDoUsuario(e) {
  if (e.type !== 'user' || e.isSidechain || e.isMeta) return null;
  const c = e.message && e.message.content;
  let t = '';
  if (typeof c === 'string') t = c;
  else if (Array.isArray(c)) {
    if (c.some(b => b.type === 'tool_result')) return null;
    t = c.filter(b => b.type === 'text').map(b => b.text).join(' ');
  }
  t = t.trim();
  // Comandos de barra, avisos de sistema e saídas de hook vêm marcados com tags.
  if (!t || t.startsWith('<') || t.startsWith('[gestor-tokens]')) return null;
  return t.replace(/\s+/g, ' ');
}

function arquivosEditados(entradas, raiz) {
  const vistos = new Set();
  for (const e of entradas) {
    if (e.type !== 'assistant' || e.isSidechain) continue;
    const c = e.message && e.message.content;
    if (!Array.isArray(c)) continue;
    for (const b of c) {
      if (b.type !== 'tool_use' || !/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(b.name)) continue;
      const f = b.input && (b.input.file_path || b.input.notebook_path);
      if (!f) continue;
      const rel = path.relative(raiz, f);
      vistos.add(rel.startsWith('..') ? f : rel.split(path.sep).join('/'));
    }
  }
  return [...vistos];
}

// Existe nota (manual ou automática) gravada depois de `desdeMs`?
function notaDepoisDe(raiz, desdeMs) {
  const dir = pastaSessoes(raiz);
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') && f !== 'ULTIMA.md')
    .some(f => fs.statSync(path.join(dir, f)).mtimeMs > desdeMs);
}

// Grava a nota automática a partir da transcrição e aponta ULTIMA.md para ela.
function escreverNotaAutomatica({ entradas, raiz, sufixo, motivo, sessionId, resumo }) {
  const pedidos = entradas.map(textoDoUsuario).filter(Boolean);
  const editados = arquivosEditados(entradas, raiz);
  const comBranch = entradas.filter(e => !e.isSidechain && e.gitBranch).pop();
  const branch = (comBranch && comBranch.gitBranch) || 'sem git';
  const modelo = usoDoContexto(entradas).modelo || '?';
  const anterior = ultimaNota(raiz);
  const c = carimbo();
  const rel = f => path.relative(raiz, f).split(path.sep).join('/');

  const linhas = [
    `# ${path.basename(raiz)} · nota automática`,
    `Data: ${c.data} ${c.hora} · Modelo: ${modelo} · Branch: ${branch} · Motivo: ${motivo}`,
    '',
    '> Gerada pelo gestor-tokens a partir da transcrição. Para uma nota completa (decisões, pendências,',
    '> próximo passo), rode `/gestor-tokens:salvar`.',
    '',
  ];
  if (resumo) linhas.push('## Resumo da compactação', '', String(resumo).slice(0, 8000).trim(), '');
  if (pedidos.length) {
    linhas.push('## Últimos pedidos', '');
    for (const p of pedidos.slice(-6)) linhas.push(`- ${p.length > 240 ? p.slice(0, 237) + '...' : p}`);
    linhas.push('');
  }
  if (editados.length) {
    linhas.push('## Arquivos editados', '');
    for (const f of editados.slice(0, 40)) linhas.push(`- \`${f}\``);
    linhas.push('');
  }
  if (anterior) linhas.push(`Nota anterior: \`${rel(anterior)}\``, '');
  if (sessionId) linhas.push(`Sessão: \`${sessionId}\` (retome com \`claude -r ${sessionId}\`)`, '');

  const dir = pastaSessoes(raiz);
  fs.mkdirSync(dir, { recursive: true });
  // Id curto da sessão no nome: duas sessões do mesmo projeto no mesmo minuto não se sobrescrevem.
  const sid = sessionId ? '-' + String(sessionId).replace(/[^\w]/g, '').slice(0, 8) : '';
  const nome = `${c.arquivo}-auto-${sufixo}${sid}.md`;
  fs.writeFileSync(path.join(dir, nome), linhas.join('\n'));
  fs.writeFileSync(path.join(dir, 'ULTIMA.md'), `@.claude/sessoes/${nome}\n`);
  return { arquivo: path.join(dir, nome), pedidos: pedidos.length, editados: editados.length };
}

// Raiz do projeto: o repositório git acima da pasta; sem git, a própria pasta se tiver .claude/ ou
// CLAUDE.md (pastas-mãe com .claude, como C:\Projetos, não contam). Senão, null.
// Worktree do app (<repo>/.claude/worktrees/<nome>) conta como o repo principal: a nota não some com o worktree.
function raizDoProjeto(cwd) {
  let inicio = path.resolve(cwd || process.cwd());
  const wt = inicio.match(/^(.*?)[\\/]\.claude[\\/]worktrees[\\/][^\\/]+/);
  if (wt && fs.existsSync(wt[1])) inicio = wt[1];
  const home = path.resolve(os.homedir());
  for (let dir = inicio; ; dir = path.dirname(dir)) {
    if (dir !== home && fs.existsSync(path.join(dir, '.git'))) return dir;
    if (path.dirname(dir) === dir) break;
  }
  if (inicio !== home && ['.claude', 'CLAUDE.md'].some(m => fs.existsSync(path.join(inicio, m)))) return inicio;
  return null;
}

function pastaSessoes(raiz) {
  return path.join(raiz, '.claude', 'sessoes');
}

// Caminho absoluto da nota apontada por ULTIMA.md (formato "@.claude/sessoes/x.md").
function ultimaNota(raiz) {
  const ponteiro = path.join(pastaSessoes(raiz), 'ULTIMA.md');
  if (!fs.existsSync(ponteiro)) return null;
  const linha = fs.readFileSync(ponteiro, 'utf8').split('\n').find(l => l.trim());
  if (!linha) return null;
  const rel = linha.trim().replace(/^@/, '');
  const abs = path.resolve(raiz, rel);
  return fs.existsSync(abs) ? abs : null;
}

// Estado por sessão (para não repetir avisos).
function arquivoEstado(sessionId) {
  const base = process.env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), 'gestor-tokens');
  const dir = path.join(base, 'estado');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${(sessionId || 'sem-id').replace(/[^\w-]/g, '')}.json`);
}

function lerEstado(sessionId) {
  try { return JSON.parse(fs.readFileSync(arquivoEstado(sessionId), 'utf8')); } catch { return {}; }
}

function gravarEstado(sessionId, estado) {
  try { fs.writeFileSync(arquivoEstado(sessionId), JSON.stringify(estado)); } catch { /* opcional */ }
}

function fmtTokens(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return String(n);
}

function carimbo(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return {
    data: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    hora: `${p(d.getHours())}:${p(d.getMinutes())}`,
    arquivo: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`,
  };
}

function responder(obj) {
  process.stdout.write(JSON.stringify(obj));
}

module.exports = {
  lerStdin, lerJsonl, usoDoContexto, janelaDoModelo, limiteDeCompactacao, raizDoProjeto, pastaSessoes,
  ultimaNota, lerEstado, gravarEstado, fmtTokens, carimbo, responder,
  textoDoUsuario, arquivosEditados, notaDepoisDe, escreverNotaAutomatica,
};
