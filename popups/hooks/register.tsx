// Popups do Gestor de Tokens: o gestor pede para fazer as coisas, você só clica.
// - Faixa acima da caixa de mensagem com botões (compactar, continuar, trocar modelo).
// - Menu /gestor numa janela de escolha.
// - Status do contexto sempre visível e toasts quando algo acontece.
import type { EngineInterface, Register } from 'claude-code'

type Aviso = { tipo: 'contexto' | 'retomar' | 'modelo'; texto: string }

const SALVAR_PCT = 70
const URGENTE_PCT = 90
const INSTRUCOES_COMPACT =
  'Manter: objetivo, decisões tomadas e motivos, pendências em ordem, caminhos dos arquivos em edição, ' +
  'comandos de teste/build que funcionam, erros já resolvidos e a causa. Descartar: saídas longas de ' +
  'ferramentas, arquivos lidos só para consulta, tentativas que não deram certo.'
// Pedido curto com cara de trabalho mecânico: não precisa de Opus/Fable.
const MECANICO = /\b(renomei|renomea|formata|status|commit|push|traduz|liste|lista os|copia|move|atualiza o readme|corrige (o )?(texto|typo|ortografia)|ajusta (o )?texto|resume|resumo|publica)/i
const MODELO_CARO = /opus|fable|mythos/i
const MENU = {
  'Salvar nota da sessão': '/gestor-tokens:salvar',
  'Compactar agora': '',
  'Checkup de consumo': '/gestor-tokens:checkup',
  'Supervisionar sessões': '/gestor-tokens:supervisionar',
} as const

function k(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M'
  if (n >= 1000) return Math.round(n / 1000) + 'k'
  return String(n)
}

function nomeCurto(modelo: string): string {
  const m = modelo.toLowerCase()
  const familia = ['fable', 'opus', 'sonnet', 'haiku', 'mythos'].find(f => m.includes(f))
  return familia ? familia.charAt(0).toUpperCase() + familia.slice(1) : modelo
}

// Contexto medido contra o ponto de compactação (autoCompactWindow), não contra a janela do modelo.
async function medir($: EngineInterface) {
  const { context, cost } = await $.session.usage()
  const ajuste = Number((await $.settings.read()).autoCompactWindow) || 0
  const limite = ajuste > 0 ? Math.min(ajuste, context.window) : context.window
  const tokens = context.tokens ?? 0
  return { tokens, limite, pct: Math.round((tokens / limite) * 100), usd: cost?.usd ?? 0 }
}

async function compactar($: EngineInterface) {
  $.ui.toast('🗜️ Compactando… a nota da sessão já está salva.')
  try {
    const { skip } = await $.session.compact({ instructions: INSTRUCOES_COMPACT })
    if (skip) $.ui.toast(`Compactação pulada: ${skip}`)
  } catch {
    $.ui.toast('Não deu para compactar agora (o Claude está trabalhando). Tente quando ele terminar.')
  }
}

async function trocarParaSonnet($: EngineInterface) {
  try {
    const r = await $.config.set({ key: 'model', value: 'sonnet' })
    if ('deny' in r && r.deny) throw new Error(String(r.deny))
    $.ui.toast('🧠 Próximas mensagens no Sonnet (metade do preço do Opus).')
  } catch {
    $.ui.toast('Troque no seletor de modelo: o app não deixou o gestor trocar sozinho.')
  }
}

async function ultimaNota($: EngineInterface): Promise<string | null> {
  try {
    const raiz = await $.session.root()
    const ponteiro = `${raiz}/.claude/sessoes/ULTIMA.md`
    if (!(await $.fs.exists(ponteiro))) return null
    const rel = ((await $.fs.read(ponteiro)).trim().split('\n')[0] ?? '').replace(/^@/, '')
    const nota = `${raiz}/${rel}`
    if (!rel || !(await $.fs.exists(nota))) return null
    return ((await $.fs.read(nota)).split('\n').find(l => l.startsWith('# ')) ?? rel).replace(/^# /, '')
  } catch {
    return null
  }
}

// Estado da sessão. Um recarregamento do mod zera tudo, o que só faz a faixa sumir.
let aviso: Aviso | null = null
let adiado = 0 // faixa de contexto (70 ou 90) dispensada com "Depois"
let modeloSugerido = false // a sugestão de modelo aparece uma vez por sessão
let ultimoPedido = ''

function mostrar($: EngineInterface, novo: Aviso | null) {
  aviso = novo
  $.ui.invalidate('ui.render')
}

export const register: Register = on => {
  aviso = null
  adiado = 0

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command.register({ name: 'gestor', description: 'Menu do Gestor de Tokens: salvar, compactar, checkup, supervisor.' })
    modeloSugerido = false
    // Projeto com nota da última sessão e conversa vazia: oferece continuar com um clique.
    if ((await $.session.turns()) === 0) {
      const titulo = await ultimaNota($)
      if (titulo) mostrar($, { tipo: 'retomar', texto: `📌 Última sessão: ${titulo}` })
    }
    return r
  })

  on('prompt.submit', async ($, e, next) => {
    ultimoPedido = e.text
    // Quem digita já decidiu o que fazer: a oferta de continuar sai da frente.
    if (aviso?.tipo === 'retomar') mostrar($, null)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId !== undefined) return r // subagentes não contam

    const { tokens, limite, pct, usd } = await medir($)
    const modelo = await $.session.model()
    $.ui.status(`🧠 ${nomeCurto(modelo)} · contexto ${pct}% de ${k(limite)} (${k(tokens)}) · $${usd.toFixed(2)}`)

    const faixa = pct >= URGENTE_PCT ? URGENTE_PCT : pct >= SALVAR_PCT ? SALVAR_PCT : 0
    if (faixa === 0) adiado = 0
    if (faixa > adiado) {
      mostrar($, {
        tipo: 'contexto',
        texto: faixa === URGENTE_PCT
          ? `⚠️ Contexto em ${pct}% do ponto de compactação (${k(tokens)}/${k(limite)}). Compacte agora para escolher o que fica.`
          : `💾 Contexto em ${pct}% do ponto de compactação (${k(tokens)}/${k(limite)}). A nota já é salva sozinha.`,
      })
      return r
    }

    if (!modeloSugerido && MODELO_CARO.test(modelo) && ultimoPedido.length < 200 && MECANICO.test(ultimoPedido)) {
      modeloSugerido = true
      mostrar($, { tipo: 'modelo', texto: `🧠 Pedido simples rodando no ${nomeCurto(modelo)}. O Sonnet faz isso pela metade do preço.` })
    }
    return r
  })

  on('session.compact', async ($, e, next) => {
    const r = await next(e)
    adiado = 0
    if (aviso?.tipo === 'contexto') mostrar($, null)
    $.ui.toast('🗜️ Sessão compactada. A nota está em .claude/sessoes/.')
    return r
  })

  on('command.run', { command: 'gestor' }, async ($, e, next) => {
    let escolha = ''
    try {
      escolha = await $.ui.ask('O que o Gestor de Tokens faz agora?', { header: 'Gestor', options: Object.keys(MENU) })
    } catch {
      return { text: 'Menu fechado.' }
    }
    if (escolha === 'Compactar agora') {
      void compactar($)
      return { text: 'Compactando a sessão.' }
    }
    const comando = (MENU as Record<string, string>)[escolha]
    void $.prompt.submit({ text: comando || escolha })
    return { text: `Gestor: ${escolha}` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const atual = aviso
    if (e.props.hasSurvey || !atual) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const fechar = () => mostrar($, null)

    if (atual.tipo === 'contexto') {
      return (
        <Box>
          <Text>{atual.texto} </Text>
          <Button key="compactar" label="Compactar agora" onPress={() => { fechar(); return compactar($) }} />
          <Button
            key="depois"
            label="Depois"
            onPress={async () => {
              const { pct } = await medir($)
              adiado = pct >= URGENTE_PCT ? URGENTE_PCT : SALVAR_PCT
              fechar()
            }}
          />
        </Box>
      )
    }

    if (atual.tipo === 'retomar') {
      return (
        <Box>
          <Text>{atual.texto} </Text>
          <Button
            key="continuar"
            label="Continuar de onde parei"
            onPress={() => {
              fechar()
              void $.prompt.submit({ text: 'Continua de onde paramos, a partir da nota da última sessão.' })
            }}
          />
          <Button key="novo" label="Assunto novo" onPress={fechar} />
        </Box>
      )
    }

    return (
      <Box>
        <Text>{atual.texto} </Text>
        <Button key="sonnet" label="Trocar para Sonnet" onPress={() => { fechar(); return trocarParaSonnet($) }} />
        <Button key="manter" label="Manter" onPress={fechar} />
      </Box>
    )
  })
}
