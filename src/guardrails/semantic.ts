let pipeline: unknown = null;
let loading: Promise<unknown> | null = null;

async function getEmbedder(): Promise<unknown> {
  if (pipeline) return pipeline;
  if (loading) return loading;

  loading = (async () => {
    try {
      // @ts-ignore — optional peer dependency
      const mod = await import("@xenova/transformers");
      const create = (mod as any).pipeline;
      pipeline = await create("feature-extraction", "Xenova/all-MiniLM-L6-v2");
      return pipeline;
    } catch {
      throw new Error(
        "Semantic matching requires @xenova/transformers: npm install @xenova/transformers"
      );
    }
  })();

  pipeline = await loading;
  loading = null;
  return pipeline;
}

async function embed(text: string): Promise<number[]> {
  const embedder = await getEmbedder() as any;
  const output = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const exampleEmbeddingCache = new Map<string, number[]>();

async function getOrEmbedExample(text: string): Promise<number[]> {
  if (exampleEmbeddingCache.has(text)) return exampleEmbeddingCache.get(text)!;
  const vec = await embed(text);
  exampleEmbeddingCache.set(text, vec);
  return vec;
}

export async function semanticMatch(
  input: string,
  examples: string[],
  threshold = 0.72
): Promise<{ matched: boolean; topScore: number; topExample: string }> {
  const [inputVec, ...exampleVecs] = await Promise.all([
    embed(input),
    ...examples.map(getOrEmbedExample),
  ]);

  let topScore = 0;
  let topExample = "";
  for (let i = 0; i < exampleVecs.length; i++) {
    const score = cosine(inputVec, exampleVecs[i]);
    if (score > topScore) {
      topScore = score;
      topExample = examples[i];
    }
  }

  return { matched: topScore >= threshold, topScore, topExample };
}
