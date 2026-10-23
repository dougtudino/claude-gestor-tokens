---
name: modelo
description: Recomenda o modelo do Claude (Haiku, Sonnet, Opus, Fable) e o nível de esforço certos para a tarefa descrita, pesando custo e qualidade. Use quando o usuário perguntar "qual modelo uso", "está caro", "vale usar Opus?", ao começar uma tarefa grande, ou quando uma tarefa simples estiver rodando num modelo caro.
argument-hint: "<descrição da tarefa>"
---

# Escolher modelo e esforço

Recomende **um** modelo e **um** esforço para a tarefa em `$ARGUMENTS` (ou a tarefa atual da
conversa). Explique em no máximo 4 linhas.

## Tabela de referência (preços da API por milhão de tokens, out/2026)

| Modelo | Entrada | Saída | Perfil |
|---|---|---|---|
| Haiku 5.5 | $0,10 | $0,50 | Rápido e barato. Tarefas mecânicas e buscas. |
| Sonnet 5.5 | $2 | $10 | Dia a dia de código: features, bugs, testes, refatoração. |
| Opus 5.5 | $4 | $20 | Raciocínio difícil, arquitetura, bugs cabeludos, agentes longos. |
| Fable 5.1 | $10 | $50 | O mais capaz. Problemas de fronteira, horas de trabalho autônomo. |

Todos com janela de 1M tokens. No plano de assinatura, o preço vira consumo do limite de uso:
a proporção entre os modelos é a mesma. Preços mudam: se a pessoa precisar do valor exato,
mande conferir em https://www.anthropic.com/pricing.

## Regra de decisão

1. **Haiku** — renomear, formatar, mover arquivos, gerar boilerplate, buscar no código,
   resumir logs, perguntas rápidas sobre a ferramenta, subagentes de leitura.
2. **Sonnet** — padrão para programar. Features com escopo claro, correção de bug com
   reprodução, testes, revisão de PR, scripts.
3. **Opus** — escopo aberto ou ambíguo, decisões de arquitetura, migração grande, bug que
   o Sonnet já errou duas vezes, plano de trabalho longo, revisão de segurança.
4. **Fable** — só quando Opus não basta: pesquisa difícil, sistemas grandes do zero,
   tarefas de várias horas sem supervisão. Custa 2,5× o Opus.

## Esforço (effort)

- `low` — perguntas, tarefas mecânicas, subagentes.
- `medium` — maior parte do trabalho do dia a dia.
- `high` / `xhigh` — código difícil, tarefas agênticas longas.
- `max` — só quando acertar vale mais que o custo.

Esforço menor num modelo maior costuma render mais que esforço máximo num modelo menor.
Antes de subir de modelo, tente subir o esforço; antes de baixar de modelo, tente baixar o esforço.

## Truques de economia que valem mais que trocar de modelo

- **Plan mode** (Shift+Tab até "plan") antes de tarefa grande: pensa sem editar, evita retrabalho.
- **Planejar no caro, executar no barato**: Opus para o plano, Sonnet para implementar.
- **Subagente com Haiku** para buscas largas: o resultado volta resumido e não enche o contexto.
- **Trocar de modelo no meio da conversa invalida o cache** do prompt: troque em pontos de
  parada (depois de `/compact` ou `/clear`), não a cada mensagem.

## Formato da resposta

```
🧠 Modelo: <nome>  ·  Esforço: <nível>
Por quê: <1–2 linhas>
Como: /model <nome>   e   /effort <nível>
💡 <um truque de economia que se aplica a esta tarefa>
```
