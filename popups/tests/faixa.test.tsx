import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const FAIXA = { plugin: 'gestor-popups', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns: 100, scroll: { offset: 0, bodyRows: 3 }, view: {} } } as const
const FIM_DE_TURNO = { answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer', category: null, explanation: null } as const

// Cada hook aqui faz o papel do engine abaixo do plugin.
function engine(on: On, tokens: number, modelo = 'claude-sonnet-5-5') {
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens, window: 1000000, percent: Math.round(tokens / 10000) }, cost: { usd: 1.5 }, rateLimits: [] } }))
  // O engine devolve o objeto de configurações; a leitura de uma chave é a projeção dele.
  on('settings.read', () => ({ value: { autoCompactWindow: 300000 } }))
  on('session.model', () => ({ value: modelo }))
  on('turn.complete', () => ({ text: '' }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
}

test('contexto baixo: a faixa não aparece', async ($, on) => {
  engine(on, 100000)
  await $.turn.complete(FIM_DE_TURNO)
  const ui = await $.ui.mount({ ...FAIXA, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  await ui.unmount()
})

test('contexto em 73% do ponto de compactação: faixa com Compactar agora; Depois some com ela', async ($, on) => {
  engine(on, 220000)
  await $.turn.complete(FIM_DE_TURNO)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...FAIXA, surface })
    expect((await ui.find({ type: 'Text', text: /73% do ponto/ }))?.text).toMatch(/220k\/300k/)
    expect(await ui.find({ type: 'Button', key: 'compactar' })).toBeTruthy()
    await ui.unmount()
  }

  const aberta = await $.ui.mount({ ...FAIXA, surface: 'desktop' })
  await $.ui.press({ plugin: 'gestor-popups', key: 'depois', surface: 'desktop' })
  await aberta.unmount()
  const ui = await $.ui.mount({ ...FAIXA, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  await ui.unmount()

  // Já adiado nesta faixa: outro turno no mesmo nível não insiste.
  await $.turn.complete(FIM_DE_TURNO)
  const de_novo = await $.ui.mount({ ...FAIXA, surface: 'desktop' })
  expect(await de_novo.find({ type: 'Button', key: 'compactar' })).toBeFalsy()
  await de_novo.unmount()
})

test('pedido mecânico no Opus: sugere trocar para Sonnet, uma vez', async ($, on) => {
  engine(on, 50000, 'claude-opus-5-5')
  await $.prompt.submit({ text: 'renomeia os arquivos da pasta assets', wait: false, origin: { kind: 'composer' } })
  await $.turn.complete(FIM_DE_TURNO)

  const ui = await $.ui.mount({ ...FAIXA, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /Sonnet faz isso/ }))?.text).toMatch(/Opus/)
  expect(await ui.find({ type: 'Button', key: 'sonnet' })).toBeTruthy()
  await $.ui.press({ plugin: 'gestor-popups', key: 'manter', surface: 'desktop' })
  await ui.unmount()
  await $.prompt.submit({ text: 'formata o readme', wait: false, origin: { kind: 'composer' } })
  await $.turn.complete(FIM_DE_TURNO)
  const de_novo = await $.ui.mount({ ...FAIXA, surface: 'desktop' })
  expect(await de_novo.find({ type: 'Button', key: 'sonnet' })).toBeFalsy()
  await de_novo.unmount()
})
