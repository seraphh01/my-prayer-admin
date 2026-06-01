import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const TOGETHER_BASE_URL = 'https://api.together.ai/v1'
// Prefer smaller serverless models (better uptime than 70B). See https://docs.together.ai/docs/serverless/models
const DEFAULT_TOGETHER_MODEL = 'Qwen/Qwen2.5-7B-Instruct-Turbo'
/** Only used if the primary model fails (keeps retries fast) */
const FALLBACK_MODELS = ['google/gemma-3n-E4B-it']
const RETRYABLE_HTTP_STATUS = new Set([429, 502, 503, 504])
const MAX_API_RETRIES = 2
const MAX_EXISTING_TITLES_IN_PROMPT = 120
/** Above this length, section mode splits input into multiple API calls */
const CHUNK_CHAR_THRESHOLD = 9000
const CHUNK_MAX_CHARS = 7000
const MAX_OUTPUT_TOKENS = 16384

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VALID_TYPES = new Set(['plainText', 'quoteText', 'italicText', 'boldText'])

type GenerateMode = 'section' | 'single'

interface GenerateRequest {
  sourceText: string
  instructions?: string
  mode?: GenerateMode
  title?: string
}

interface AiPhrase {
  text: string
  type: string
  highlight?: boolean
}

interface AiBlock {
  title: string
  phrases: AiPhrase[]
  repetition?: number
}

interface GenerateResponse {
  blocks: AiBlock[]
  meta?: {
    sourceChars: number
    chunksProcessed: number
    outputTruncated: boolean
  }
}

const PHRASE_RULES = `- ONE SOURCE LINE = ONE PHRASE: each non-empty line in the source text (text between newline characters) must become exactly one phrase object. Never split one source line into multiple phrases. Never merge two or more source lines into one phrase.
- Keep phrases in the same order as the source lines.
- Phrase "type" must be exactly one of: plainText, quoteText, italicText, boldText
- Use plainText by default. Use italicText for rubrics, stage directions, or responses marked as such. Use quoteText for Scripture quotations. Use boldText sparingly for emphasis.
- "highlight" is true only when the phrase should be visually emphasized in the app (default false).
- Phrase "text" must copy the source line exactly (same words; only trim trailing/leading spaces on that line).
- Preserve the original language and wording; do not paraphrase unless instructions ask for it.`

const SECTION_SYSTEM_PROMPT = `You structure liturgical prayer text for a Romanian Orthodox prayer app admin panel.

CRITICAL: Reply with ONLY one JSON object. No thinking process, no analysis, no markdown fences, no text before or after the JSON.

Given source text and optional instructions, split the content into logical liturgical blocks. Each block becomes one "liturgical text" with a short title and ordered phrases.

Rules:
- Output ONLY valid JSON matching the schema below.
${PHRASE_RULES}
- Titles must be unique within the output and concise (Romanian).
- When a list of EXISTING liturgical text titles is provided, you MUST reuse the exact same title string (character-for-character) whenever a block corresponds to content that already exists under that title. Do not create a near-duplicate title for existing texts.
- Only invent new titles for content that clearly does not match any existing title.
- Process the COMPLETE source text from start to finish — do not skip, summarize, or stop early.
- "repetition" is how many times the block is sung/said in the section (default 1).

JSON schema:
{
  "blocks": [
    {
      "title": "string",
      "repetition": 1,
      "phrases": [
        { "text": "string", "type": "plainText", "highlight": false }
      ]
    }
  ]
}`

const SINGLE_SYSTEM_PROMPT = `You structure ONE liturgical text for a Romanian Orthodox prayer app admin panel.

CRITICAL: Reply with ONLY one JSON object. No thinking process, no analysis, no markdown fences, no text before or after the JSON.

Given source text and optional instructions, produce exactly ONE liturgical text: a title and an ordered list of phrases (with type and highlight).

Rules:
- Output ONLY valid JSON matching the schema below.
- Return exactly ONE object in the "blocks" array.
${PHRASE_RULES}
- If a suggested title is provided in the user message, use it unless instructions say otherwise.
- Otherwise infer a short concise title in Romanian from the content.
- Set "repetition" to 1.

JSON schema:
{
  "blocks": [
    {
      "title": "string",
      "repetition": 1,
      "phrases": [
        { "text": "string", "type": "plainText", "highlight": false }
      ]
    }
  ]
}`

function extractBalancedJsonObject(text: string, startIndex: number): string | null {
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth++
    if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(startIndex, i + 1)
    }
  }

  return null
}

function stripThinkingPreamble(text: string): string {
  return text
    .replace(/^[\s\S]*?(?=\{\s*"blocks")/i, '')
    .replace(/<think>[\s\S]*?<\/redacted_thinking>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .trim()
}

function extractJsonFromText(text: string): string | null {
  const stripped = stripThinkingPreamble(text.trim())
  if (!stripped) return null

  const fenced = stripped.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    const fromFence = extractJsonFromText(fenced[1].trim())
    if (fromFence) return fromFence
  }

  const blocksKey = '"blocks"'
  const blocksAt = stripped.indexOf(blocksKey)
  if (blocksAt >= 0) {
    const braceAt = stripped.lastIndexOf('{', blocksAt)
    if (braceAt >= 0) {
      const obj = extractBalancedJsonObject(stripped, braceAt)
      if (obj) return obj
    }
  }

  const firstBrace = stripped.indexOf('{')
  if (firstBrace >= 0) {
    const obj = extractBalancedJsonObject(stripped, firstBrace)
    if (obj) return obj
  }

  return null
}

function extractMessageContent(message: Record<string, unknown> | undefined): string {
  if (!message) return ''

  const parts: string[] = []
  if (typeof message.content === 'string') parts.push(message.content)
  for (const key of ['reasoning', 'reasoning_content']) {
    if (typeof message[key] === 'string') parts.push(message[key] as string)
  }

  for (const part of parts) {
    const json = extractJsonFromText(part)
    if (json) return json
  }

  return ''
}

function estimateMaxTokens(sourcePart: string): number {
  const lines = getNonEmptySourceLines(sourcePart).length
  const blockOverhead = Math.max(1, Math.ceil(lines / 15)) * 180
  return Math.min(MAX_OUTPUT_TOKENS, Math.max(2048, lines * 85 + blockOverhead + 600))
}

function getNonEmptySourceLines(sourcePart: string): string[] {
  return sourcePart
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
}

/** Align phrase texts with source lines (1 line = 1 phrase); keep AI block titles and types. */
function enforceLineBasedPhrases(sourcePart: string, blocks: AiBlock[]): AiBlock[] {
  const sourceLines = getNonEmptySourceLines(sourcePart)
  if (sourceLines.length === 0) return blocks

  const aiPhrases = blocks.flatMap((b) => b.phrases)
  if (aiPhrases.length === 0) {
    return [
      {
        title: blocks[0]?.title ?? 'Text',
        repetition: blocks[0]?.repetition ?? 1,
        phrases: sourceLines.map((text) => ({
          text,
          type: 'plainText',
          highlight: false,
        })),
      },
    ]
  }

  let lineIdx = 0
  const result: AiBlock[] = []

  for (const block of blocks) {
    const phrases: AiPhrase[] = []
    for (const aiPhrase of block.phrases) {
      if (lineIdx >= sourceLines.length) break
      phrases.push({
        text: sourceLines[lineIdx],
        type: aiPhrase.type,
        highlight: aiPhrase.highlight ?? false,
      })
      lineIdx++
    }
    if (phrases.length > 0) {
      result.push({
        title: block.title,
        repetition: block.repetition ?? 1,
        phrases,
      })
    }
  }

  if (lineIdx < sourceLines.length) {
    const remaining: AiPhrase[] = sourceLines.slice(lineIdx).map((text) => ({
      text,
      type: 'plainText',
      highlight: false,
    }))
    if (result.length === 0) {
      result.push({ title: 'Text', repetition: 1, phrases: remaining })
    } else {
      result[result.length - 1].phrases.push(...remaining)
    }
  }

  return result.length > 0 ? result : blocks
}

function splitParagraphByLines(paragraph: string, maxChunkSize: number): string[] {
  const lines = paragraph.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const chunks: string[] = []
  let buf = ''

  for (const line of lines) {
    const candidate = buf ? `${buf}\n${line}` : line
    if (candidate.length > maxChunkSize && buf) {
      chunks.push(buf)
      buf = line
    } else {
      buf = candidate
    }
  }
  if (buf) chunks.push(buf)
  return chunks
}

/** Split long text at blank lines first, then between full lines — never mid-line. */
function splitSourceIntoChunks(text: string, maxChunkSize: number): string[] {
  if (text.length <= maxChunkSize) return [text]

  const paragraphs = text.split(/\n\s*\n/)
  const chunks: string[] = []
  let buf = ''

  const flush = () => {
    if (buf.trim()) chunks.push(buf.trim())
    buf = ''
  }

  for (const rawPara of paragraphs) {
    const para = rawPara.trim()
    if (!para) continue

    const candidate = buf ? `${buf}\n\n${para}` : para

    if (candidate.length <= maxChunkSize) {
      buf = candidate
      continue
    }

    flush()

    if (para.length <= maxChunkSize) {
      buf = para
      continue
    }

    chunks.push(...splitParagraphByLines(para, maxChunkSize))
  }

  flush()
  return chunks.length > 0 ? chunks : [text]
}

function buildUserMessage(
  sourcePart: string,
  instructions: string,
  existingTitlesBlock: string,
  chunkLabel?: string,
): string {
  let msg = ''

  if (chunkLabel) {
    msg += `${chunkLabel}\n\n`
    msg += `Structure ONLY the text in this part into blocks. Do not invent content that is not in this part.\n\n`
  }

  msg += `Remember: each non-empty source line is exactly one phrase — do not split or merge lines.\n\n`

  if (instructions) {
    msg += `Instructions:\n${instructions}\n\n`
  }

  if (existingTitlesBlock) {
    msg += existingTitlesBlock + '\n\n'
  }

  msg += `Source text:\n${sourcePart}`
  return msg
}

function parseBlocksJson(rawContent: string): unknown {
  const jsonText = extractJsonFromText(rawContent)
  if (!jsonText) {
    const preview = rawContent.trim().slice(0, 120).replace(/\s+/g, ' ')
    throw new Error(`Model returned no JSON object. Preview: ${preview}`)
  }

  try {
    return JSON.parse(jsonText)
  } catch {
    throw new Error('Model returned malformed JSON. Try again or use a shorter source text.')
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function sanitizeBlocks(raw: unknown): AiBlock[] {
  if (!raw || typeof raw !== 'object' || !('blocks' in raw)) {
    throw new Error('Invalid AI response shape')
  }
  const blocks = (raw as { blocks: unknown }).blocks
  if (!Array.isArray(blocks) || blocks.length === 0) {
    throw new Error('AI returned no blocks')
  }

  return blocks.map((block, i) => {
    if (!block || typeof block !== 'object') {
      throw new Error(`Invalid block at index ${i}`)
    }
    const b = block as Record<string, unknown>
    const title = typeof b.title === 'string' ? b.title.trim() : ''
    if (!title) throw new Error(`Block ${i} missing title`)

    const phrasesRaw = b.phrases
    if (!Array.isArray(phrasesRaw) || phrasesRaw.length === 0) {
      throw new Error(`Block "${title}" has no phrases`)
    }

    const phrases: AiPhrase[] = phrasesRaw.map((p, j) => {
      if (!p || typeof p !== 'object') throw new Error(`Invalid phrase in "${title}"`)
      const ph = p as Record<string, unknown>
      const text = typeof ph.text === 'string' ? ph.text.trim() : ''
      if (!text) throw new Error(`Empty phrase in "${title}"`)
      let type = typeof ph.type === 'string' ? ph.type : 'plainText'
      if (!VALID_TYPES.has(type)) type = 'plainText'
      return {
        text,
        type,
        highlight: Boolean(ph.highlight),
      }
    })

    const repetition =
      typeof b.repetition === 'number' && b.repetition >= 1 ? Math.floor(b.repetition) : 1

    return { title, phrases, repetition }
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const apiKey = Deno.env.get('TOGETHER_API_KEY')
  if (!apiKey) {
    return jsonResponse(
      {
        error:
          'TOGETHER_API_KEY is not set. Add it in Supabase Dashboard → Edge Functions → Secrets.',
      },
      500,
    )
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  )

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  let body: GenerateRequest
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const sourceText = body.sourceText?.trim()
  if (!sourceText) {
    return jsonResponse({ error: 'sourceText is required' }, 400)
  }

  const instructions = body.instructions?.trim() ?? ''
  const mode: GenerateMode = body.mode === 'single' ? 'single' : 'section'
  const suggestedTitle = body.title?.trim() ?? ''

  let existingTitlesBlock = ''

  if (mode === 'section') {
    const { data: existingTexts, error: textsError } = await supabase
      .from('liturgical_texts')
      .select('title')
      .order('title', { ascending: true })

    if (textsError) {
      console.error('Failed to load liturgical_texts:', textsError)
    } else if (existingTexts?.length) {
      const titles = existingTexts
        .map((row) => (typeof row.title === 'string' ? row.title.trim() : ''))
        .filter((t) => t.length > 0)
      if (titles.length > 0) {
        const capped = titles.slice(0, MAX_EXISTING_TITLES_IN_PROMPT)
        const overflow = titles.length - capped.length
        existingTitlesBlock =
          `EXISTING liturgical text titles in database (reuse these EXACT titles when content matches; do not duplicate):\n` +
          capped.map((t) => `- ${t}`).join('\n')
        if (overflow > 0) {
          existingTitlesBlock += `\n(... and ${overflow} more existing titles — match by meaning when possible)`
        }
      }
    }
  }

  const sourceParts =
    mode === 'section' && sourceText.length > CHUNK_CHAR_THRESHOLD
      ? splitSourceIntoChunks(sourceText, CHUNK_MAX_CHARS)
      : [sourceText]

  interface TogetherCompletion {
    choices?: Array<{
      finish_reason?: string
      message?: Record<string, unknown>
    }>
    error?: { message?: string; type?: string }
  }

  async function callModel(
    model: string,
    useJsonMode: boolean,
    promptUserMessage: string,
    maxTokens: number,
  ): Promise<TogetherCompletion> {
    const systemPrompt = mode === 'single' ? SINGLE_SYSTEM_PROMPT : SECTION_SYSTEM_PROMPT

    const payload: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptUserMessage },
      ],
      temperature: 0.2,
      max_tokens: maxTokens,
    }

    if (useJsonMode) {
      payload.response_format = { type: 'json_object' }
    }

    if (model.includes('Qwen') || model.includes('gpt-oss')) {
      payload.reasoning = { enabled: false }
    }

    if (model.includes('gpt-oss')) {
      payload.reasoning_effort = 'low'
    }

    let lastError = 'Unknown error'

    for (let attempt = 0; attempt <= MAX_API_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 800 * attempt))
      }

      const res = await fetch(`${TOGETHER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = (await res.json()) as TogetherCompletion

      if (res.ok) {
        return data
      }

      lastError = data?.error?.message ?? res.statusText

      if (RETRYABLE_HTTP_STATUS.has(res.status) && attempt < MAX_API_RETRIES) {
        console.warn(`Together ${res.status} for ${model}, retry ${attempt + 1}/${MAX_API_RETRIES}`)
        continue
      }

      throw new Error(`Together API (${model}): ${lastError}`)
    }

    throw new Error(`Together API (${model}): ${lastError}`)
  }

  function buildModelsList(lockedModel: string | null): string[] {
    if (lockedModel) return [lockedModel]

    const configuredModel = Deno.env.get('TOGETHER_MODEL')?.trim() || DEFAULT_TOGETHER_MODEL
    const preferReliableFirst = configuredModel.includes('Llama-3.3-70B')
    return preferReliableFirst
      ? [...new Set([DEFAULT_TOGETHER_MODEL, ...FALLBACK_MODELS])]
      : [...new Set([configuredModel, ...FALLBACK_MODELS])]
  }

  async function generateBlocksFromMessage(
    promptUserMessage: string,
    sourcePart: string,
    lockedModel: string | null,
  ): Promise<{ blocks: AiBlock[]; outputTruncated: boolean; modelUsed: string }> {
    const modelsToTry = buildModelsList(lockedModel)
    const maxTokens = estimateMaxTokens(sourcePart)

    let content = ''
    let lastFinishReason = 'unknown'
    const attemptErrors: string[] = []

    for (const model of modelsToTry) {
      const jsonModes = [true, false] as const
      for (const useJsonMode of jsonModes) {
        try {
          const completion = await callModel(model, useJsonMode, promptUserMessage, maxTokens)
          const choice = completion.choices?.[0]
          lastFinishReason = choice?.finish_reason ?? 'unknown'

          content = extractMessageContent(choice?.message)

          if (content) {
            console.log(`OK: ${model} json_mode=${useJsonMode} finish=${lastFinishReason} tokens~${maxTokens}`)
            const parsed = parseBlocksJson(content)
            let blocks = sanitizeBlocks(parsed)
            blocks = enforceLineBasedPhrases(sourcePart, blocks)
            return {
              blocks,
              outputTruncated: lastFinishReason === 'length',
              modelUsed: model,
            }
          }

          attemptErrors.push(`${model}: empty content (${lastFinishReason})`)
        } catch (attemptErr) {
          const msg = attemptErr instanceof Error ? attemptErr.message : String(attemptErr)
          console.warn(`Attempt failed ${model} json_mode=${useJsonMode}:`, msg)
          attemptErrors.push(msg)
        }
      }
    }

    const detail = attemptErrors.slice(-3).join('; ')
    throw new Error(
      `No usable model response. ${detail || `finish_reason=${lastFinishReason}`}. ` +
        `Try: npx supabase secrets set TOGETHER_MODEL=${DEFAULT_TOGETHER_MODEL}`,
    )
  }

  async function processChunk(
    part: string,
    index: number,
    lockedModel: string | null,
  ): Promise<{ index: number; blocks: AiBlock[]; outputTruncated: boolean; modelUsed: string }> {
    const chunkLabel =
      sourceParts.length > 1
        ? `Part ${index + 1} of ${sourceParts.length} of a long liturgical section.`
        : undefined

    const titlesBlock = index === 0 ? existingTitlesBlock : ''

    let promptUserMessage = buildUserMessage(part, instructions, titlesBlock, chunkLabel)

    if (mode === 'single' && suggestedTitle) {
      promptUserMessage += `\n\nSuggested title: ${suggestedTitle}`
    }

    const result = await generateBlocksFromMessage(promptUserMessage, part, lockedModel)
    return { index, ...result }
  }

  try {
    let outputTruncated = false
    let allBlocks: AiBlock[] = []

    if (sourceParts.length === 1) {
      const one = await processChunk(sourceParts[0], 0, null)
      allBlocks = one.blocks
      outputTruncated = one.outputTruncated
    } else {
      // First chunk picks a working model; remaining chunks run in parallel with that model
      const first = await processChunk(sourceParts[0], 0, null)
      allBlocks = first.blocks
      outputTruncated = first.outputTruncated

      const rest = await Promise.all(
        sourceParts.slice(1).map((part, j) => processChunk(part, j + 1, first.modelUsed)),
      )

      for (const part of rest) {
        allBlocks = allBlocks.concat(part.blocks)
        if (part.outputTruncated) outputTruncated = true
      }
    }

    let blocks = allBlocks

    if (mode === 'single') {
      if (blocks.length > 1) {
        const mergedPhrases = blocks.flatMap((b) => b.phrases)
        blocks = [{
          title: suggestedTitle || blocks[0].title,
          phrases: mergedPhrases,
          repetition: 1,
        }]
      } else if (suggestedTitle && blocks[0]) {
        blocks[0].title = suggestedTitle
      }
    }

    return jsonResponse({
      blocks,
      meta: {
        sourceChars: sourceText.length,
        chunksProcessed: sourceParts.length,
        outputTruncated,
      },
    } satisfies GenerateResponse)
  } catch (err) {
    console.error('generate-section-texts error:', err)
    const message = err instanceof Error ? err.message : 'Generation failed'
    return jsonResponse({ error: message }, 500)
  }
})
