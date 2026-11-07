// Central de comando entre computadores (NB, MAC, DK...).
// Cada PC tem um nome curto. Uma pasta sincronizada (Google Drive, Dropbox, OneDrive) guarda:
//   maquinas.json                     nome de cada computador (hostname → NB/MAC/DK)
//   sessoes/<PC>.json                 inventário das sessões daquele PC
//   sessoes/projetos/<projeto>/<PC>.md  última nota de cada projeto, por PC
//   SESSOES.md                        o mapa: onde está cada sessão e onde parou cada projeto
// As sessões em si não viajam: moram no PC onde nasceram. Viajam o código (git) e as notas (aqui).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const PASTA_CENTRAL = '_CLAUDE';
const CONFIG = () => path.join(os.homedir(), '.claude', 'gestor-tokens', 'maquina.json');

function lerJson(f, padrao) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return padrao; }
}

function gravarJson(f, v) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n');
}

// Pasta central: GESTOR_CENTRAL > maquina.json > Google Drive com a pasta _CLAUDE já criada.
function acharCentral(config) {
  if (process.env.GESTOR_CENTRAL) return process.env.GESTOR_CENTRAL;
  if (config.central) return config.central;
  const candidatos = [];
  if (process.platform === 'win32') {
    for (const letra of 'GHDEFIJKLMNOPQRSTUVWXYZ') {
      candidatos.push(`${letra}:\\Meu Drive\\${PASTA_CENTRAL}`, `${letra}:\\My Drive\\${PASTA_CENTRAL}`);
    }
  } else {
    const nuvem = path.join(os.homedir(), 'Library', 'CloudStorage');
    let contas = [];
    try { contas = fs.readdirSync(nuvem).filter(d => /^GoogleDrive-/.test(d)); } catch { /* sem Drive */ }
    for (const c of contas) {
      candidatos.push(path.join(nuvem, c, 'Meu Drive', PASTA_CENTRAL), path.join(nuvem, c, 'My Drive', PASTA_CENTRAL));
    }
  }
  return candidatos.find(p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } }) || '';
}

// Quem sou eu: GESTOR_MAQUINA > maquina.json > maquinas.json da central (pelo hostname) > palpite.
function maquina() {
  const config = lerJson(CONFIG(), {});
  const host = os.hostname().replace(/\.local$/, '');
  const central = acharCentral(config);
  const mapa = central ? lerJson(path.join(central, 'maquinas.json'), {}) : {};
  const doMapa = mapa[host] || mapa[host.toUpperCase()] || {};
  let nome = process.env.GESTOR_MAQUINA || config.nome || doMapa.nome || '';
  if (!nome) nome = process.platform === 'darwin' ? 'MAC' : host;
  const descricao = config.descricao || doMapa.descricao || '';
  return { nome: String(nome).toUpperCase(), descricao, host, central, configurada: Boolean(config.nome || doMapa.nome) };
}

// Grava o nome desta máquina (local) e registra o hostname no mapa da central.
function configurar({ nome, descricao, central }) {
  const atual = lerJson(CONFIG(), {});
  const novo = { ...atual };
  if (nome) novo.nome = String(nome).toUpperCase();
  if (descricao) novo.descricao = descricao;
  if (central) novo.central = central;
  gravarJson(CONFIG(), novo);
  const m = maquina();
  if (m.central) {
    fs.mkdirSync(path.join(m.central, 'sessoes', 'projetos'), { recursive: true });
    const arq = path.join(m.central, 'maquinas.json');
    const mapa = lerJson(arq, {});
    mapa[m.host] = { nome: m.nome, descricao: m.descricao, so: process.platform };
    gravarJson(arq, mapa);
  }
  return m;
}

// Chave do projeto igual nos três PCs: o "dono/repo" do git (os caminhos mudam de PC para PC).
function chaveDoProjeto(raiz) {
  let cfg = '';
  try { cfg = fs.readFileSync(path.join(raiz, '.git', 'config'), 'utf8'); } catch { /* sem git */ }
  const bloco = cfg.split(/^\[/m).find(b => /^remote "origin"\]/.test(b)) || '';
  const url = (bloco.match(/^\s*url\s*=\s*(.+)$/m) || [])[1] || '';
  const m = url.trim().match(/[/:]([^/:]+)\/([^/]+?)(?:\.git)?\/?$/);
  const chave = m ? `${m[1]}-${m[2]}` : path.basename(raiz);
  return chave.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-');
}

function pastaDoProjeto(central, chave) {
  return path.join(central, 'sessoes', 'projetos', chave);
}

// Copia a nota para a central como "a última deste projeto neste PC".
function publicarNota(raiz, notaAbs, m = maquina()) {
  if (!m.central || !notaAbs || !fs.existsSync(notaAbs)) return null;
  const dir = pastaDoProjeto(m.central, chaveDoProjeto(raiz));
  fs.mkdirSync(dir, { recursive: true });
  const destino = path.join(dir, `${m.nome}.md`);
  const quando = fs.statSync(notaAbs).mtime;
  const texto = fs.readFileSync(notaAbs, 'utf8');
  const cabecalho = `<!-- gestor-tokens · PC: ${m.nome} · projeto: ${path.basename(raiz)} · nota: ` +
    `${path.basename(notaAbs)} · gravada: ${quando.toISOString()} -->\n`;
  fs.writeFileSync(destino, cabecalho + texto.replace(/^<!-- gestor-tokens ·.*-->\n/, ''));
  fs.utimesSync(destino, quando, quando); // a data da cópia é a data da nota
  return destino;
}

// Notas deste projeto gravadas nos outros PCs, a mais nova primeiro.
function notasDosOutros(raiz, m = maquina()) {
  if (!m.central) return [];
  const dir = pastaDoProjeto(m.central, chaveDoProjeto(raiz));
  let arquivos = [];
  try { arquivos = fs.readdirSync(dir).filter(f => f.endsWith('.md')); } catch { return []; }
  return arquivos
    .map(f => ({ pc: f.replace(/\.md$/, ''), arquivo: path.join(dir, f), mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .filter(n => n.pc !== m.nome)
    .sort((a, b) => b.mtime - a.mtime);
}

// Atualiza (ou acrescenta) sessões no inventário deste PC. `todas` = substitui a lista inteira.
function gravarInventario(sessoes, { todas = false } = {}, m = maquina()) {
  if (!m.central) return null;
  const arq = path.join(m.central, 'sessoes', `${m.nome}.json`);
  const atual = todas ? { sessoes: [] } : lerJson(arq, { sessoes: [] });
  const porId = new Map((atual.sessoes || []).map(s => [s.sessionId, s]));
  for (const s of sessoes) porId.set(s.sessionId, { ...porId.get(s.sessionId), ...s });
  const limite = Date.now() - 14 * 86400000;
  const lista = [...porId.values()]
    .filter(s => Date.parse(s.ultimaAtividade) >= limite)
    .sort((a, b) => Date.parse(b.ultimaAtividade) - Date.parse(a.ultimaAtividade));
  gravarJson(arq, { pc: m.nome, descricao: m.descricao, host: m.host, atualizado: new Date().toISOString(), sessoes: lista });
  return arq;
}

// Nome legível do projeto mesmo sem raiz (pasta movida, worktree do app, pasta temporária).
function nomeDaPasta(cwd) {
  if (!cwd) return '?';
  if (/[\\/]scratch-workspaces[\\/]/.test(cwd)) return '(sem pasta)';
  if (path.resolve(cwd) === path.resolve(os.homedir())) return '(pasta pessoal)';
  const wt = cwd.match(/^(.*?)[\\/]\.claude[\\/]worktrees[\\/]/);
  return path.basename(wt ? wt[1] : cwd);
}

// Só o que ajuda a achar a sessão; nada do conteúdo da conversa vai para a nuvem.
function resumoDaSessao(s, raiz) {
  return {
    sessionId: s.sessionId,
    projeto: raiz ? path.basename(raiz) : nomeDaPasta(s.cwd),
    chave: raiz ? chaveDoProjeto(raiz) : '',
    pastaExiste: s.cwd ? fs.existsSync(s.cwd) : false,
    titulo: s.titulo || '',
    pasta: s.cwd || '',
    ultimaAtividade: s.ultimaAtividade,
    tokens: s.tokens,
    pct: s.pct,
    modelo: (s.modelo || '').replace('claude-', ''),
    pedidos: s.pedidos,
    temNota: s.temNota,
  };
}

function ha(ms) {
  const min = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (min < 60) return `${min}min`;
  if (min < 1440) return `${Math.round(min / 60)}h`;
  return `${Math.round(min / 1440)}d`;
}

function celula(t) {
  return String(t || '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
}

// Remonta SESSOES.md a partir dos inventários de todos os PCs.
function gerarMapa(m = maquina()) {
  if (!m.central) return null;
  const dirSessoes = path.join(m.central, 'sessoes');
  const nomes = lerJson(path.join(m.central, 'maquinas.json'), {});
  const descricoes = Object.fromEntries(Object.values(nomes).map(v => [v.nome, v.descricao || '']));
  let pcs = [];
  try {
    pcs = fs.readdirSync(dirSessoes).filter(f => f.endsWith('.json')).map(f => lerJson(path.join(dirSessoes, f), null)).filter(Boolean);
  } catch { /* central vazia */ }
  pcs.sort((a, b) => a.pc.localeCompare(b.pc));

  const L = [
    `# Sessões do Claude Code — ${pcs.map(p => p.pc).join(' · ') || m.nome}`,
    `Atualizado em ${new Date().toLocaleString('pt-BR')} pelo **${m.nome}**. Gerado pelo gestor-tokens: não edite à mão.`,
    '',
    '> Cada sessão mora no PC onde nasceu (não é compartilhada). O que passa de um PC para outro é o',
    '> código (git) e a nota da sessão (`sessoes/projetos/`). Para continuar em outro PC: abra o mesmo',
    '> projeto lá e diga "continua" — o gestor carrega a nota mais nova, venha de qual PC vier.',
    '',
    '## Computadores',
    '',
    '| PC | o que é | última sincronia | sessões (14 dias) | pesadas (≥150k) |',
    '|---|---|---|---|---|',
  ];
  for (const p of pcs) {
    const pesadas = p.sessoes.filter(s => s.tokens >= 150000).length;
    L.push(`| **${p.pc}** | ${celula(p.descricao || descricoes[p.pc])} | há ${ha(Date.parse(p.atualizado))} | ${p.sessoes.length} | ${pesadas} |`);
  }

  // Projetos: em que PCs têm sessão, onde foi a última atividade e de onde é a nota mais nova.
  const projetos = new Map();
  for (const p of pcs) {
    for (const s of p.sessoes) {
      const k = String(s.projeto).toLowerCase();
      const pr = projetos.get(k) || { nome: s.projeto, chaves: new Set(), pcs: {}, ultima: null };
      if (s.chave) pr.chaves.add(s.chave);
      pr.pcs[p.pc] = (pr.pcs[p.pc] || 0) + 1;
      if (!pr.ultima || Date.parse(s.ultimaAtividade) > Date.parse(pr.ultima.ultimaAtividade)) pr.ultima = { ...s, pc: p.pc };
      projetos.set(k, pr);
    }
  }
  L.push('', '## Projetos', '', '| projeto | sessões por PC | última atividade | nota mais nova |', '|---|---|---|---|');
  const ordem = [...projetos.entries()].sort((a, b) => Date.parse(b[1].ultima.ultimaAtividade) - Date.parse(a[1].ultima.ultimaAtividade));
  for (const [, pr] of ordem) {
    const porPc = Object.entries(pr.pcs).map(([pc, n]) => `${pc} (${n})`).join(', ');
    let nota = '—';
    try {
      const n = [...pr.chaves].flatMap(k => {
        const dir = pastaDoProjeto(m.central, k);
        try { return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => path.join(dir, f)); } catch { return []; }
      })
        .map(f => ({ pc: path.basename(f, '.md'), t: fs.statSync(f).mtimeMs, f }))
        .sort((a, b) => b.t - a.t)[0];
      if (n) {
        const titulo = (fs.readFileSync(n.f, 'utf8').split('\n').find(l => l.startsWith('# ')) || '').slice(2);
        nota = `${n.pc}, há ${ha(n.t)}: ${celula(titulo).slice(0, 60)}`;
      }
    } catch { /* sem nota */ }
    L.push(`| ${celula(pr.nome)} | ${porPc} | ${pr.ultima.pc}, há ${ha(Date.parse(pr.ultima.ultimaAtividade))} | ${nota} |`);
  }

  for (const p of pcs) {
    L.push('', `## ${p.pc}${p.descricao ? ' — ' + celula(p.descricao) : ''}`, '');
    if (!p.sessoes.length) { L.push('Nenhuma sessão nos últimos 14 dias.'); continue; }
    L.push('| sessão | projeto | parada há | contexto | modelo | id |', '|---|---|---|---|---|---|');
    for (const s of p.sessoes.slice(0, 40)) {
      const ctx = s.tokens ? `${Math.round(s.tokens / 1000)}k (${s.pct}%)` : '—';
      const aviso = s.pastaExiste === false ? ' ⚠️ pasta não existe mais' : '';
      L.push(`| ${celula(s.titulo) || '(sem título)'} | ${celula(s.projeto)}${aviso} | ${ha(Date.parse(s.ultimaAtividade))} | ${ctx} | ${celula(s.modelo)} | \`${String(s.sessionId).slice(0, 8)}\` |`);
    }
  }
  const arq = path.join(m.central, 'SESSOES.md');
  fs.writeFileSync(arq, L.join('\n') + '\n');
  return arq;
}

module.exports = {
  maquina, configurar, chaveDoProjeto, publicarNota, notasDosOutros, gravarInventario, resumoDaSessao, gerarMapa, ha,
};
