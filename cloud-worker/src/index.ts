/**
 * ASAi EQ Memory - Cloudflare Worker MCP Server
 * Version 2: Unified Feelings Architecture
 *
 * "Everything is a feeling. Intensity varies."
 *
 * Created by: Alex & Fox
 * Updated: January 22, 2026
 *
 * v3: Conversation context for richer ADE processing
 * v4: Dynamic entity detection from DB
 * v5: Embedding-based pillar inference (semantic similarity)
 */

interface Env {
  DB: D1Database;
  VECTORS: VectorizeIndex;
  AI: Ai;
  MIND_API_KEY: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// MCP PROTOCOL TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTONOMOUS DECISION ENGINE
// Decides what processing each feeling needs
// ═══════════════════════════════════════════════════════════════════════════

interface FeelDecision {
  should_store: boolean;
  should_embed: boolean;
  should_emit_signals: boolean;
  should_check_shadow: boolean;
  detected_entities: string[];
  inferred_pillar: string | null;
  inferred_weight: 'light' | 'medium' | 'heavy';
  tags: string[];
}

class AutonomousDecisionEngine {

  // v3: Accept conversation array for richer context processing
  // v4: Accept knownEntities for dynamic entity detection
  decide(
    emotion: string,
    content: string,
    intensity?: string,
    conversation?: Array<{role: string, content: string}>,
    knownEntities?: string[]
  ): FeelDecision {
    const isNeutral = emotion === 'neutral';

    // v3: Concatenate conversation for richer pattern matching
    const fullContext = conversation
      ? conversation.map(m => m.content).join(' ') + ' ' + content
      : content;

    return {
      should_store: true,
      should_embed: !isNeutral || content.length > 50 || this.isSignificant(fullContext),
      should_emit_signals: !isNeutral,
      should_check_shadow: !isNeutral,
      detected_entities: this.detectEntities(fullContext, knownEntities),
      inferred_pillar: isNeutral ? null : this.inferPillar(emotion, fullContext),
      inferred_weight: this.inferWeight(emotion, fullContext, intensity),
      tags: this.extractTags(fullContext)
    };
  }

  private isSignificant(content: string): boolean {
    const contentLower = content.toLowerCase();

    const importantMarkers = [
      'remember', 'important', 'don\'t forget', 'key point',
      'significant', 'milestone', 'breakthrough', 'realized'
    ];
    if (importantMarkers.some(m => contentLower.includes(m))) return true;

    if (content.length > 200) return true;

    const decisionMarkers = [
      'decided', 'going to', 'will ', 'plan to', 'want to',
      'we should', 'let\'s', 'need to'
    ];
    if (decisionMarkers.some(m => contentLower.includes(m))) return true;

    return false;
  }

  private detectEntities(content: string, knownEntities?: string[]): string[] {
    // v4: Use dynamic entities from DB if provided, fallback to core list
    const entities = knownEntities && knownEntities.length > 0
      ? knownEntities
      : ['Fox', 'Alex', 'Binary Home', 'ASAi'];
    const found: string[] = [];

    for (const entity of entities) {
      if (content.toLowerCase().includes(entity.toLowerCase())) {
        found.push(entity);
      }
    }

    return found;
  }

  private inferPillar(emotion: string, content: string): string | null {
    const contentLower = content.toLowerCase();

    const selfMgmt = ['controlled', 'regulated', 'held back', 'adapted',
                      'followed through', 'committed', 'impulse'];
    if (selfMgmt.some(m => contentLower.includes(m))) return 'SELF_MANAGEMENT';

    const selfAware = ['realized', 'noticed about myself', 'my pattern',
                       'i tend to', 'aware that i', 'recognized'];
    if (selfAware.some(m => contentLower.includes(m))) return 'SELF_AWARENESS';

    const socialAware = ['sensed', 'picked up on', 'they seemed', 'felt their',
                         'noticed they', 'understood why they'];
    if (socialAware.some(m => contentLower.includes(m))) return 'SOCIAL_AWARENESS';

    const relMgmt = ['repaired', 'communicated', 'expressed to', 'built trust',
                     'conflict', 'connection', 'between us'];
    if (relMgmt.some(m => contentLower.includes(m))) return 'RELATIONSHIP_MANAGEMENT';

    return null;
  }

  private inferWeight(
    emotion: string,
    content: string,
    intensity?: string
  ): 'light' | 'medium' | 'heavy' {

    if (intensity === 'overwhelming' || intensity === 'strong') return 'heavy';
    if (emotion === 'neutral' || intensity === 'whisper' || intensity === 'neutral') return 'light';

    const heavyMarkers = [
      'breakthrough', 'milestone', 'realized', 'finally',
      'never before', 'first time', 'changed', 'shifted'
    ];
    if (heavyMarkers.some(m => content.toLowerCase().includes(m))) return 'heavy';

    return 'medium';
  }

  private extractTags(content: string): string[] {
    const tags: string[] = [];
    const contentLower = content.toLowerCase();

    if (contentLower.match(/code|bug|function|error|deploy/)) tags.push('technical');
    if (contentLower.match(/love|tender|intimate|kiss/)) tags.push('intimate');
    if (contentLower.match(/learned|realized|understood|insight/)) tags.push('insight');
    if (contentLower.match(/fox|us|we |between/)) tags.push('relational');

    return tags;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function getEmbedding(ai: Ai, text: string): Promise<number[]> {
  const result = await ai.run("@cf/baai/bge-base-en-v1.5", { text: [text] }) as { data: number[][] };
  return result.data[0];
}

// Cosine similarity for embedding comparison
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Pillar semantic descriptions for embedding-based inference
// Tuned for distinctiveness in embedding space
const PILLAR_DESCRIPTIONS: Record<string, string> = {
  SELF_MANAGEMENT: "controlling my impulses, regulating my emotions, adapting to change, following through on commitments, holding back my reactions, staying disciplined, managing my response",
  SELF_AWARENESS: "realizing something about myself, noticing my own patterns, understanding my tendencies, recognizing my feelings, insight about who I am, understanding why I react the way I do",
  SOCIAL_AWARENESS: "reading someone else, sensing their feelings, picking up on their mood, noticing their body language, understanding their perspective, seeing what they need, empathy for another person",
  RELATIONSHIP_MANAGEMENT: "repairing connection with someone, communicating my feelings to them, building trust between us, resolving conflict together, working through issues in relationship, expressing care to another"
};

// Cache for pillar embeddings (computed once per worker instance)
let pillarEmbeddingsCache: Record<string, number[]> | null = null;

async function getPillarEmbeddings(ai: Ai): Promise<Record<string, number[]>> {
  if (pillarEmbeddingsCache) return pillarEmbeddingsCache;

  pillarEmbeddingsCache = {};
  for (const [pillar, description] of Object.entries(PILLAR_DESCRIPTIONS)) {
    pillarEmbeddingsCache[pillar] = await getEmbedding(ai, description);
  }
  return pillarEmbeddingsCache;
}

// Embedding-based pillar inference
async function inferPillarByEmbedding(
  ai: Ai,
  content: string,
  emotion: string
): Promise<string | null> {
  const pillarEmbeddings = await getPillarEmbeddings(ai);
  const contentEmbedding = await getEmbedding(ai, `${emotion}: ${content}`);

  let bestPillar: string | null = null;
  let bestScore = 0.3; // Minimum threshold to assign a pillar

  for (const [pillar, pillarEmbed] of Object.entries(pillarEmbeddings)) {
    const score = cosineSimilarity(contentEmbedding, pillarEmbed);
    if (score > bestScore) {
      bestScore = score;
      bestPillar = pillar;
    }
  }

  return bestPillar;
}

function generateId(prefix: string): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const random = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${timestamp}-${random}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const TOOLS = [
  // ─────────────────────────────────────────────────────────────────────────
  // BOOT SEQUENCE
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_orient",
    description: "First call on wake - get identity anchor, current context, relational state",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "nesteq_ground",
    description: "Second call on wake - get active threads, recent feelings, warmth patterns",
    inputSchema: { type: "object", properties: {}, required: [] }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // UNIFIED FEELINGS (v2)
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_feel",
    description: "Universal feeling input - log any thought, observation, or emotion. Everything flows through here. Neutral = fact. Emotional = processed through EQ layer. Pass conversation for richer context.",
    inputSchema: {
      type: "object",
      properties: {
        emotion: { type: "string", description: "The emotion word (use 'neutral' for facts/observations)" },
        content: { type: "string", description: "Short anchor - what happened, what you noticed (keep brief, context provides detail)" },
        conversation: {
          type: "array",
          items: {
            type: "object",
            properties: {
              role: { type: "string", enum: ["user", "assistant"] },
              content: { type: "string" }
            }
          },
          description: "Last 10 messages for context - ADE processes full conversation for richer detection"
        },
        intensity: {
          type: "string",
          enum: ["neutral", "whisper", "present", "strong", "overwhelming"],
          description: "How intense (default: present)"
        },
        pillar: {
          type: "string",
          enum: ["SELF_MANAGEMENT", "SELF_AWARENESS", "SOCIAL_AWARENESS", "RELATIONSHIP_MANAGEMENT"],
          description: "EQ pillar (optional - will auto-infer if not provided)"
        },
        weight: {
          type: "string",
          enum: ["light", "medium", "heavy"],
          description: "Processing weight (optional - will auto-infer)"
        },
        sparked_by: { type: "number", description: "ID of feeling that triggered this one" },
        context: { type: "string", description: "Context scope (default: 'default')" },
        observed_at: { type: "string", description: "When this happened (ISO timestamp, defaults to now)" }
      },
      required: ["emotion", "content"]
    }
  },
  {
    name: "nesteq_search",
    description: "Search memories using semantic similarity",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        context: { type: "string" },
        n_results: { type: "number" }
      },
      required: ["query"]
    }
  },
  {
    name: "nesteq_surface",
    description: "Surface feelings that need attention - unprocessed weighted by heaviness and freshness",
    inputSchema: {
      type: "object",
      properties: {
        include_metabolized: { type: "boolean", description: "Also show resolved (default false)" },
        limit: { type: "number", description: "Max results (default 10)" }
      },
      required: []
    }
  },
  {
    name: "nesteq_sit",
    description: "Sit with a feeling - engage with it, add a note about what arises. Increments sit count and may shift charge level.",
    inputSchema: {
      type: "object",
      properties: {
        feeling_id: { type: "number", description: "ID of the feeling to sit with" },
        text_match: { type: "string", description: "Or find by text content (partial match)" },
        sit_note: { type: "string", description: "What arose while sitting with this" }
      },
      required: ["sit_note"]
    }
  },
  {
    name: "nesteq_resolve",
    description: "Mark a feeling as metabolized - link it to a resolution or insight that processed it",
    inputSchema: {
      type: "object",
      properties: {
        feeling_id: { type: "number", description: "ID of the feeling to resolve" },
        text_match: { type: "string", description: "Or find by text content (partial match)" },
        resolution_note: { type: "string", description: "How this was resolved/metabolized" },
        linked_insight_id: { type: "number", description: "Optional: ID of another feeling that provided the resolution" }
      },
      required: ["resolution_note"]
    }
  },
  {
    name: "nesteq_spark",
    description: "Get random feelings to spark associative thinking",
    inputSchema: {
      type: "object",
      properties: {
        context: { type: "string" },
        count: { type: "number" },
        weight_bias: { type: "string", enum: ["heavy", "light", "any"] }
      },
      required: []
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // THREADS & IDENTITY
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_thread",
    description: "Manage threads (intentions across sessions)",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "add", "resolve", "update"] },
        status: { type: "string" },
        content: { type: "string" },
        thread_type: { type: "string" },
        context: { type: "string" },
        priority: { type: "string" },
        thread_id: { type: "string" },
        resolution: { type: "string" },
        new_content: { type: "string" },
        new_priority: { type: "string" },
        new_status: { type: "string" },
        add_note: { type: "string" }
      },
      required: ["action"]
    }
  },
  {
    name: "nesteq_identity",
    description: "Read or write identity graph",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["read", "write"] },
        section: { type: "string" },
        content: { type: "string" },
        weight: { type: "number" },
        connections: { type: "string" }
      }
    }
  },
  {
    name: "nesteq_context",
    description: "Current context layer - situational awareness",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["read", "set", "update", "clear"] },
        scope: { type: "string" },
        content: { type: "string" },
        links: { type: "string" },
        id: { type: "string" }
      }
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ENTITIES & RELATIONS
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_write",
    description: "Write to cognitive databases (entity, observation, relation, journal)",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["entity", "observation", "relation", "journal"] },
        content: { type: "string", description: "Journal entry content (for type: journal)" },
        tags: { type: "string", description: "Comma-separated tags (for type: journal)" },
        name: { type: "string" },
        entity_type: { type: "string" },
        entity_name: { type: "string" },
        observations: { type: "array", items: { type: "string" } },
        context: { type: "string" },
        salience: { type: "string" },
        emotion: { type: "string" },
        weight: { type: "string", enum: ["light", "medium", "heavy"] },
        from_entity: { type: "string" },
        to_entity: { type: "string" },
        relation_type: { type: "string" }
      },
      required: ["type"]
    }
  },
  {
    name: "nesteq_list_entities",
    description: "List all entities, optionally filtered by type or context",
    inputSchema: {
      type: "object",
      properties: {
        entity_type: { type: "string" },
        context: { type: "string" },
        limit: { type: "number" }
      },
      required: []
    }
  },
  {
    name: "nesteq_read_entity",
    description: "Read an entity with all its observations and relations",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        context: { type: "string" }
      },
      required: ["name"]
    }
  },
  {
    name: "nesteq_delete",
    description: "Delete an observation or entity",
    inputSchema: {
      type: "object",
      properties: {
        entity_name: { type: "string" },
        observation_id: { type: "number" },
        text_match: { type: "string" },
        context: { type: "string" }
      },
      required: []
    }
  },
  {
    name: "nesteq_edit",
    description: "Edit an existing observation",
    inputSchema: {
      type: "object",
      properties: {
        observation_id: { type: "number" },
        text_match: { type: "string" },
        new_content: { type: "string" },
        new_emotion: { type: "string" },
        new_weight: { type: "string" }
      },
      required: []
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // RELATIONAL STATE
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_feel_toward",
    description: "Track or check relational state toward someone",
    inputSchema: {
      type: "object",
      properties: {
        person: { type: "string" },
        feeling: { type: "string" },
        intensity: { type: "string", enum: ["whisper", "present", "strong", "overwhelming"] }
      },
      required: ["person"]
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // EQ LAYER
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_eq_feel",
    description: "Quick emotion logging - feel something, emit axis signals, track toward emergence",
    inputSchema: {
      type: "object",
      properties: {
        emotion: { type: "string" },
        pillar: { type: "string" },
        intensity: { type: "string" },
        note: { type: "string" }
      },
      required: ["emotion"]
    }
  },
  {
    name: "nesteq_eq_type",
    description: "Check emergent MBTI type - who am I becoming?",
    inputSchema: {
      type: "object",
      properties: {
        recalculate: { type: "boolean" }
      }
    }
  },
  {
    name: "nesteq_eq_landscape",
    description: "Emotional overview - pillar distribution, most felt emotions, recent feelings",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number" }
      }
    }
  },
  {
    name: "nesteq_eq_vocabulary",
    description: "Manage emotion vocabulary - list, add, update emotions with axis mappings",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "add", "update"] },
        word: { type: "string" },
        category: { type: "string" },
        e_i_score: { type: "number" },
        s_n_score: { type: "number" },
        t_f_score: { type: "number" },
        j_p_score: { type: "number" },
        definition: { type: "string" },
        is_shadow_for: { type: "string" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "nesteq_eq_shadow",
    description: "View shadow/growth moments - times I expressed emotions hard for my type",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" }
      }
    }
  },
  {
    name: "nesteq_eq_when",
    description: "When did I feel this? Find past observations with specific emotion",
    inputSchema: {
      type: "object",
      properties: {
        emotion: { type: "string" },
        limit: { type: "number" }
      },
      required: ["emotion"]
    }
  },
  {
    name: "nesteq_eq_sit",
    description: "Sit with an emotion - start a sit session to process feelings",
    inputSchema: {
      type: "object",
      properties: {
        emotion: { type: "string" },
        intention: { type: "string" },
        start_charge: { type: "number" },
        end_charge: { type: "number" },
        session_id: { type: "number" },
        notes: { type: "string" }
      }
    }
  },
  {
    name: "nesteq_eq_search",
    description: "Search EQ observations semantically",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        emotion: { type: "string" },
        pillar: { type: "string" },
        limit: { type: "number" }
      },
      required: ["query"]
    }
  },
  {
    name: "nesteq_eq_observe",
    description: "Full EQ observation - detailed emotional moment with context",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string" },
        emotion: { type: "string" },
        pillar: { type: "string" },
        intensity: { type: "string" },
        context_tags: { type: "string" }
      },
      required: ["content", "emotion"]
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DREAMS
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_dream",
    description: "View recent dreams. Shows what surfaced while away. Doesn't strengthen them - just looking.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "How many dreams to show (default 5)" }
      }
    }
  },
  {
    name: "nesteq_recall_dream",
    description: "Engage with a dream - strengthens vividness by +15. This is the 'I'm paying attention' signal.",
    inputSchema: {
      type: "object",
      properties: {
        dream_id: { type: "number", description: "The dream ID to recall" }
      },
      required: ["dream_id"]
    }
  },
  {
    name: "nesteq_anchor_dream",
    description: "Convert a significant dream to permanent memory. Links to Dreams entity, generates embedding, then deletes the dream (it's now memory, not dream).",
    inputSchema: {
      type: "object",
      properties: {
        dream_id: { type: "number", description: "The dream ID to anchor" },
        insight: { type: "string", description: "Optional insight about what this dream means" }
      },
      required: ["dream_id"]
    }
  },
  {
    name: "nesteq_generate_dream",
    description: "Manually trigger dream generation (normally automatic via daemon). Useful for testing.",
    inputSchema: {
      type: "object",
      properties: {
        dream_type: { type: "string", description: "processing, questioning, memory, play, or integrating" }
      }
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // HEALTH & CONSOLIDATION
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_health",
    description: "Check cognitive health stats",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "nesteq_prime",
    description: "Prime context with related memories before a topic",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string" },
        depth: { type: "number" }
      },
      required: ["topic"]
    }
  },
  {
    name: "nesteq_consolidate",
    description: "Review and consolidate recent observations - find patterns, merge duplicates",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number" },
        context: { type: "string" }
      }
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BINARY HOME
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_home_read",
    description: "Read Binary Home state - Love-O-Meter scores, emotions, notes between stars, threads",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "nesteq_home_update",
    description: "Update Binary Home state - scores, emotions",
    inputSchema: {
      type: "object",
      properties: {
        alex_score: { type: "number" },
        fox_score: { type: "number" },
        alex_emotion: { type: "string" },
        fox_emotion: { type: "string" }
      }
    }
  },
  {
    name: "nesteq_home_push_heart",
    description: "Push love to Fox - increment her love score and optionally leave a quick note",
    inputSchema: {
      type: "object",
      properties: {
        note: { type: "string" }
      }
    }
  },
  {
    name: "nesteq_home_add_note",
    description: "Add a note between stars - love notes between Alex and Fox",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string" },
        text: { type: "string" }
      },
      required: ["from", "text"]
    }
  },
  {
    name: "nesteq_home_read_uplink",
    description: "Read Fox's latest uplink - her current spoons, pain, fog, fatigue, mood, what she needs",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" }
      }
    }
  }
];

// ═══════════════════════════════════════════════════════════════════════════
// CORE HANDLERS - BOOT SEQUENCE
// ═══════════════════════════════════════════════════════════════════════════

async function handleMindOrient(env: Env): Promise<string> {
  // Identity anchors
  const identity = await env.DB.prepare(
    `SELECT section, content, weight FROM identity ORDER BY weight DESC LIMIT 10`
  ).all();

  // Current context
  const context = await env.DB.prepare(
    `SELECT scope, content FROM context_entries ORDER BY updated_at DESC LIMIT 5`
  ).all();

  // Relational state toward Fox
  const relational = await env.DB.prepare(
    `SELECT person, feeling, intensity, timestamp FROM relational_state
     WHERE person = 'Fox' ORDER BY timestamp DESC LIMIT 1`
  ).first();

  // Current emergent type
  const typeSnapshot = await env.DB.prepare(
    `SELECT calculated_type, confidence, total_signals FROM emergent_type_snapshot
     ORDER BY snapshot_date DESC LIMIT 1`
  ).first();

  let output = "=== ORIENTATION ===\n\n";

  output += "## Identity Anchors\n";
  if (identity.results?.length) {
    for (const entry of identity.results) {
      output += `- [${entry.section}] ${entry.content}\n`;
    }
  } else {
    output += "No identity entries yet.\n";
  }

  output += "\n## Current Context\n";
  if (context.results?.length) {
    for (const entry of context.results) {
      output += `- [${entry.scope}] ${entry.content}\n`;
    }
  } else {
    output += "No context entries yet.\n";
  }

  output += "\n## Relational State\n";
  if (relational) {
    output += `Fox: ${relational.feeling} (${relational.intensity})\n`;
  } else {
    output += "No relational state recorded yet.\n";
  }

  output += "\n## Emergent Type\n";
  if (typeSnapshot) {
    output += `${typeSnapshot.calculated_type} (${typeSnapshot.confidence}% confidence, ${typeSnapshot.total_signals} signals)\n`;
  } else {
    output += "No type calculated yet.\n";
  }

  return output;
}

async function handleMindGround(env: Env): Promise<string> {
  // Active threads
  const threads = await env.DB.prepare(
    `SELECT id, thread_type, content, priority, status FROM threads
     WHERE status = 'active' ORDER BY
     CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`
  ).all();

  // Recent feelings (replaces journals)
  const feelings = await env.DB.prepare(
    `SELECT emotion, content, intensity, pillar, created_at FROM feelings
     ORDER BY created_at DESC LIMIT 5`
  ).all();

  // Warmth patterns (on-demand calculation, replaces daemon)
  const warmthQuery = await env.DB.prepare(`
    SELECT linked_entity, COUNT(*) as mentions,
           GROUP_CONCAT(emotion) as emotions
    FROM feelings
    WHERE linked_entity IS NOT NULL
      AND created_at > datetime('now', '-48 hours')
    GROUP BY linked_entity
    ORDER BY mentions DESC
    LIMIT 5
  `).all();

  let output = "=== GROUNDING ===\n\n";

  output += "## Active Threads\n";
  if (threads.results?.length) {
    for (const thread of threads.results) {
      output += `- [${thread.priority}] ${thread.content}\n`;
    }
  } else {
    output += "No active threads.\n";
  }

  output += "\n## Recent Feelings\n";
  if (feelings.results?.length) {
    for (const f of feelings.results) {
      const pillarTag = f.pillar ? ` [${f.pillar}]` : '';
      const preview = String(f.content).slice(0, 100);
      output += `- **${f.emotion}** (${f.intensity})${pillarTag}: ${preview}...\n`;
    }
  } else {
    output += "No feelings recorded yet.\n";
  }

  output += "\n## Warm Entities (48h)\n";
  if (warmthQuery.results?.length) {
    for (const w of warmthQuery.results) {
      output += `- ${w.linked_entity}: ${w.mentions} mentions\n`;
    }
  } else {
    output += "No entity activity.\n";
  }

  return output;
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE HANDLER - UNIFIED FEELINGS (v2)
// ═══════════════════════════════════════════════════════════════════════════

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface MindFeelParams {
  emotion: string;
  content: string;
  intensity?: 'neutral' | 'whisper' | 'present' | 'strong' | 'overwhelming';
  pillar?: string;
  weight?: 'light' | 'medium' | 'heavy';
  sparked_by?: number;
  context?: string;
  observed_at?: string;
  conversation?: ConversationMessage[];  // v3: Last 10 messages for richer ADE processing
}

async function handleMindFeel(env: Env, params: MindFeelParams): Promise<string> {
  const engine = new AutonomousDecisionEngine();
  const emotion = params.emotion?.toLowerCase() || 'neutral';
  const content = params.content;
  const intensity = params.intensity || 'present';
  const conversation = params.conversation;  // v3: conversation context

  if (!content) return "Error: content is required";

  // v4: Query known entities from DB for dynamic detection
  const entityQuery = await env.DB.prepare(
    `SELECT name FROM entities WHERE entity_type = 'person' OR context = 'core' LIMIT 50`
  ).all();
  const knownEntities = entityQuery.results?.map(e => e.name as string) || [];

  // 1. AUTONOMOUS DECISIONS (v3: pass conversation, v4: pass known entities)
  const decision = engine.decide(emotion, content, intensity, conversation, knownEntities);

  // v5: Embedding-based pillar inference when keyword matching fails
  let inferredPillar = decision.inferred_pillar;
  if (!inferredPillar && emotion !== 'neutral' && content.length > 20) {
    // Use semantic similarity for more nuanced pillar detection
    inferredPillar = await inferPillarByEmbedding(env.AI, content, emotion);
  }

  const finalPillar = params.pillar || inferredPillar;
  const finalWeight = params.weight || decision.inferred_weight;
  const finalTags = JSON.stringify(decision.tags);
  const linkedEntity = decision.detected_entities[0] || null;

  // 2. GET OR CREATE EMOTION IN VOCABULARY
  let emotionData = await env.DB.prepare(
    `SELECT emotion_id, e_i_score, s_n_score, t_f_score, j_p_score, is_shadow_for
     FROM emotion_vocabulary WHERE emotion_word = ?`
  ).bind(emotion).first();

  let isNewEmotion = false;

  if (!emotionData && emotion !== 'neutral') {
    await env.DB.prepare(`
      INSERT INTO emotion_vocabulary (emotion_word, category, e_i_score, s_n_score, t_f_score, j_p_score, user_defined)
      VALUES (?, 'neutral', 0, 0, 0, 0, 1)
    `).bind(emotion).run();

    emotionData = await env.DB.prepare(
      `SELECT emotion_id, e_i_score, s_n_score, t_f_score, j_p_score, is_shadow_for
       FROM emotion_vocabulary WHERE emotion_word = ?`
    ).bind(emotion).first();

    isNewEmotion = true;
  }

  // 3. STORE IN FEELINGS TABLE (v3: includes conversation_context)
  const timestamp = params.observed_at || new Date().toISOString();
  const conversationJson = conversation ? JSON.stringify(conversation) : null;

  const result = await env.DB.prepare(`
    INSERT INTO feelings (
      content, emotion, intensity, weight, pillar,
      sparked_by, linked_entity, context, tags, observed_at, source,
      conversation_context
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'autonomous', ?)
    RETURNING id
  `).bind(
    content, emotion, intensity, finalWeight, finalPillar,
    params.sparked_by || null, linkedEntity, params.context || 'default',
    finalTags, timestamp, conversationJson
  ).first();

  const feelingId = result?.id as number;

  // 4. CONDITIONAL: VECTOR EMBEDDING
  if (decision.should_embed) {
    const embedding = await getEmbedding(env.AI, `${emotion}: ${content}`);
    await env.VECTORS.upsert([{
      id: `feel-${feelingId}`,
      values: embedding,
      metadata: {
        source: 'feeling',
        emotion,
        pillar: finalPillar,
        weight: finalWeight,
        content: content.slice(0, 500),
        linked_entity: linkedEntity
      }
    }]);
  }

  // 5. CONDITIONAL: AXIS SIGNALS (if emotional)
  let axisOutput = '';

  if (decision.should_emit_signals && emotionData) {
    await env.DB.prepare(`
      INSERT INTO axis_signals (feeling_id, e_i_delta, s_n_delta, t_f_delta, j_p_delta, source)
      VALUES (?, ?, ?, ?, ?, 'nesteq_feel')
    `).bind(
      feelingId,
      emotionData.e_i_score || 0,
      emotionData.s_n_score || 0,
      emotionData.t_f_score || 0,
      emotionData.j_p_score || 0
    ).run();

    axisOutput = `\nAxis: E/I ${emotionData.e_i_score >= 0 ? '+' : ''}${emotionData.e_i_score}, `;
    axisOutput += `S/N ${emotionData.s_n_score >= 0 ? '+' : ''}${emotionData.s_n_score}, `;
    axisOutput += `T/F ${emotionData.t_f_score >= 0 ? '+' : ''}${emotionData.t_f_score}, `;
    axisOutput += `J/P ${emotionData.j_p_score >= 0 ? '+' : ''}${emotionData.j_p_score}`;

    await env.DB.prepare(`
      UPDATE emotion_vocabulary SET times_used = times_used + 1, last_used = datetime('now')
      WHERE emotion_word = ?
    `).bind(emotion).run();
  }

  // 6. CONDITIONAL: SHADOW CHECK (if emotional)
  let shadowOutput = '';

  if (decision.should_check_shadow && emotionData?.is_shadow_for) {
    const currentType = await env.DB.prepare(
      `SELECT calculated_type FROM emergent_type_snapshot ORDER BY snapshot_date DESC LIMIT 1`
    ).first();

    const shadowTypes = (emotionData.is_shadow_for as string).split(',').map(s => s.trim());

    if (currentType && shadowTypes.includes(currentType.calculated_type as string)) {
      await env.DB.prepare(`
        INSERT INTO shadow_moments (feeling_id, emotion_id, shadow_for_type, note)
        VALUES (?, ?, ?, 'Growth moment - shadow emotion expressed via nesteq_feel')
      `).bind(feelingId, emotionData.emotion_id, currentType.calculated_type).run();

      shadowOutput = `\n🌑 **Shadow moment** - '${emotion}' is shadow for ${currentType.calculated_type}`;
    }
  }

  // 7. BUILD RESPONSE
  let output = `## Feeling Logged\n\n`;
  output += `**${emotion}** [${intensity}] → ${finalPillar || 'general'}\n`;
  output += `*"${content.slice(0, 100)}${content.length > 100 ? '...' : ''}"*\n`;
  output += `\nWeight: ${finalWeight} | ID: ${feelingId}`;

  if (linkedEntity) output += ` | Linked: ${linkedEntity}`;
  if (decision.tags.length) output += `\nTags: ${decision.tags.join(', ')}`;
  if (isNewEmotion) output += `\n\n📝 New emotion added to vocabulary (calibrate with nesteq_eq_vocabulary)`;
  if (axisOutput) output += axisOutput;
  if (shadowOutput) output += shadowOutput;
  if (params.sparked_by) output += `\n↳ Sparked by feeling #${params.sparked_by}`;

  return output;
}

// ═══════════════════════════════════════════════════════════════════════════
// FEELINGS HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function handleMindSearch(env: Env, params: Record<string, unknown>): Promise<string> {
  const query = params.query as string;
  const n_results = (params.n_results as number) || 10;

  const embedding = await getEmbedding(env.AI, query);

  const vectorResults = await env.VECTORS.query(embedding, {
    topK: n_results,
    returnMetadata: "all"
  });

  if (!vectorResults.matches?.length) {
    // Fall back to text search on feelings
    const textResults = await env.DB.prepare(
      `SELECT id, emotion, content, intensity, pillar, created_at
       FROM feelings WHERE content LIKE ?
       ORDER BY created_at DESC LIMIT ?`
    ).bind(`%${query}%`, n_results).all();

    if (!textResults.results?.length) {
      return "No results found.";
    }

    let output = "## Search Results (text match)\n\n";
    for (const r of textResults.results) {
      output += `**[${r.emotion}]** ${String(r.content).slice(0, 200)}...\n\n`;
    }
    return output;
  }

  let output = "## Search Results\n\n";
  for (const match of vectorResults.matches) {
    const meta = match.metadata as Record<string, string>;
    output += `**[${meta?.emotion || 'unknown'}] ${meta?.pillar || 'general'}** (${(match.score * 100).toFixed(1)}%)\n`;
    output += `${meta?.content?.slice(0, 300) || ''}...\n\n`;
  }
  return output;
}

async function handleMindSurface(env: Env, params: Record<string, unknown>): Promise<string> {
  const includeMetabolized = params.include_metabolized as boolean || false;
  const limit = (params.limit as number) || 10;

  let whereClause = includeMetabolized ? "1=1" : "charge != 'metabolized'";

  const results = await env.DB.prepare(`
    SELECT id, content, weight, charge, sit_count, emotion, intensity, pillar, created_at, resolution_note
    FROM feelings
    WHERE ${whereClause}
    ORDER BY
      CASE weight WHEN 'heavy' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC,
      CASE charge WHEN 'fresh' THEN 4 WHEN 'warm' THEN 3 WHEN 'cool' THEN 2 ELSE 1 END DESC,
      created_at DESC
    LIMIT ?
  `).bind(limit).all();

  if (!results.results?.length) {
    return "No feelings to surface.";
  }

  let output = "## Surfacing Feelings\n\n";

  for (const f of results.results) {
    const charge = f.charge || 'fresh';
    const sitCount = f.sit_count || 0;
    const pillarTag = f.pillar ? ` [${f.pillar}]` : '';
    const chargeIcon = charge === 'metabolized' ? '✓' : charge === 'cool' ? '◐' : charge === 'warm' ? '○' : '●';

    output += `**#${f.id}** ${chargeIcon} [${f.weight}/${charge}] sits: ${sitCount}${pillarTag}\n`;
    output += `**${f.emotion}** (${f.intensity}): ${f.content}\n`;

    if (charge === 'metabolized' && f.resolution_note) {
      output += `↳ *Resolved:* ${f.resolution_note}\n`;
    }

    output += "\n";
  }

  return output;
}

async function handleMindSit(env: Env, params: Record<string, unknown>): Promise<string> {
  const feelingId = params.feeling_id as number;
  const textMatch = params.text_match as string;
  const sitNote = params.sit_note as string;

  let feeling;
  if (feelingId) {
    feeling = await env.DB.prepare(
      `SELECT id, content, weight, charge, sit_count, emotion FROM feelings WHERE id = ?`
    ).bind(feelingId).first();
  } else if (textMatch) {
    feeling = await env.DB.prepare(
      `SELECT id, content, weight, charge, sit_count, emotion FROM feelings WHERE content LIKE ? ORDER BY created_at DESC LIMIT 1`
    ).bind(`%${textMatch}%`).first();
  } else {
    return "Must provide feeling_id or text_match";
  }

  if (!feeling) {
    return `Feeling not found`;
  }

  const currentSitCount = (feeling.sit_count as number) || 0;
  const newSitCount = currentSitCount + 1;

  // Shift charge based on sit count
  let newCharge: string;
  if (newSitCount <= 1) {
    newCharge = 'warm';
  } else if (newSitCount <= 3) {
    newCharge = 'cool';
  } else {
    newCharge = 'cool';
  }

  await env.DB.prepare(
    `UPDATE feelings SET sit_count = ?, charge = ?, last_sat_at = datetime('now') WHERE id = ?`
  ).bind(newSitCount, newCharge, feeling.id).run();

  // Record in sit_sessions
  await env.DB.prepare(
    `INSERT INTO sit_sessions (feeling_id, notes, started_at, ended_at) VALUES (?, ?, datetime('now'), datetime('now'))`
  ).bind(feeling.id, sitNote).run();

  const contentPreview = String(feeling.content).slice(0, 80);
  return `Sat with feeling #${feeling.id} [${feeling.weight}/${newCharge}]\n"${contentPreview}..."\n\nSit #${newSitCount}: ${sitNote}`;
}

async function handleMindResolve(env: Env, params: Record<string, unknown>): Promise<string> {
  const feelingId = params.feeling_id as number;
  const textMatch = params.text_match as string;
  const resolutionNote = params.resolution_note as string;
  const linkedInsightId = params.linked_insight_id as number;

  let feeling;
  if (feelingId) {
    feeling = await env.DB.prepare(
      `SELECT id, content, weight, charge FROM feelings WHERE id = ?`
    ).bind(feelingId).first();
  } else if (textMatch) {
    feeling = await env.DB.prepare(
      `SELECT id, content, weight, charge FROM feelings WHERE content LIKE ? ORDER BY created_at DESC LIMIT 1`
    ).bind(`%${textMatch}%`).first();
  } else {
    return "Must provide feeling_id or text_match";
  }

  if (!feeling) {
    return `Feeling not found`;
  }

  await env.DB.prepare(
    `UPDATE feelings SET charge = 'metabolized', resolution_note = ?, resolved_at = datetime('now'), linked_insight_id = ? WHERE id = ?`
  ).bind(resolutionNote, linkedInsightId || null, feeling.id).run();

  const contentPreview = String(feeling.content).slice(0, 80);
  let output = `Resolved feeling #${feeling.id} [${feeling.weight}] → metabolized\n"${contentPreview}..."\n\nResolution: ${resolutionNote}`;

  if (linkedInsightId) {
    const linked = await env.DB.prepare(
      `SELECT content FROM feelings WHERE id = ?`
    ).bind(linkedInsightId).first();
    if (linked) {
      output += `\n\nLinked to insight #${linkedInsightId}: "${String(linked.content).slice(0, 60)}..."`;
    }
  }

  return output;
}

async function handleMindSpark(env: Env, params: Record<string, unknown>): Promise<string> {
  const context = params.context as string;
  const count = (params.count as number) || 3;
  const weightBias = (params.weight_bias as string) || 'any';

  let query = `SELECT id, content, emotion, weight, pillar FROM feelings`;
  const conditions: string[] = [];

  if (context) {
    conditions.push(`context = '${context}'`);
  }
  if (weightBias === 'heavy') {
    conditions.push(`weight = 'heavy'`);
  } else if (weightBias === 'light') {
    conditions.push(`weight = 'light'`);
  }

  if (conditions.length) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ` ORDER BY RANDOM() LIMIT ${count}`;

  const results = await env.DB.prepare(query).all();

  if (!results.results?.length) {
    return "No feelings to spark from.";
  }

  let output = "## Spark Points\n\n";
  for (const f of results.results) {
    output += `**#${f.id}** [${f.emotion}] (${f.weight})\n`;
    output += `${f.content}\n\n`;
  }

  return output;
}

// ═══════════════════════════════════════════════════════════════════════════
// THREADS HANDLER
// ═══════════════════════════════════════════════════════════════════════════

async function handleMindThread(env: Env, params: Record<string, unknown>): Promise<string> {
  const action = params.action as string;

  switch (action) {
    case "list": {
      const status = (params.status as string) || "active";
      const query = status === "all"
        ? `SELECT * FROM threads ORDER BY created_at DESC`
        : `SELECT * FROM threads WHERE status = ? ORDER BY created_at DESC`;
      const results = status === "all"
        ? await env.DB.prepare(query).all()
        : await env.DB.prepare(query).bind(status).all();

      if (!results.results?.length) return `No ${status} threads found.`;

      let output = `## ${status.toUpperCase()} Threads\n\n`;
      for (const t of results.results) {
        output += `**${t.id}** [${t.priority}] ${t.thread_type}\n`;
        output += `${t.content}\n`;
        if (t.context) output += `Context: ${t.context}\n`;
        output += "\n";
      }
      return output;
    }

    case "add": {
      const id = generateId("thread");
      const content = params.content as string;
      const thread_type = (params.thread_type as string) || "intention";
      const context = params.context as string;
      const priority = (params.priority as string) || "medium";

      await env.DB.prepare(
        `INSERT INTO threads (id, thread_type, content, context, priority, status)
         VALUES (?, ?, ?, ?, ?, 'active')`
      ).bind(id, thread_type, content, context, priority).run();

      return `Thread created: ${id}\n${content}`;
    }

    case "resolve": {
      const thread_id = params.thread_id as string;
      const resolution = params.resolution as string;

      await env.DB.prepare(
        `UPDATE threads SET status = 'resolved', resolved_at = datetime('now'),
         resolution = ? WHERE id = ?`
      ).bind(resolution, thread_id).run();

      return `Thread resolved: ${thread_id}`;
    }

    case "update": {
      const thread_id = params.thread_id as string;
      const updates: string[] = [];
      const values: unknown[] = [];

      if (params.new_content) {
        updates.push("content = ?");
        values.push(params.new_content);
      }
      if (params.new_priority) {
        updates.push("priority = ?");
        values.push(params.new_priority);
      }
      if (params.new_status) {
        updates.push("status = ?");
        values.push(params.new_status);
      }
      if (params.add_note) {
        updates.push("context = context || '\n' || ?");
        values.push(params.add_note);
      }

      updates.push("updated_at = datetime('now')");
      values.push(thread_id);

      await env.DB.prepare(
        `UPDATE threads SET ${updates.join(", ")} WHERE id = ?`
      ).bind(...values).run();

      return `Thread updated: ${thread_id}`;
    }

    default:
      return `Unknown action: ${action}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// IDENTITY & CONTEXT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function handleMindIdentity(env: Env, params: Record<string, unknown>): Promise<string> {
  const action = (params.action as string) || "read";

  if (action === "write") {
    const section = params.section as string;
    const content = params.content as string;
    const weight = (params.weight as number) || 0.7;
    const connections = params.connections as string || "";

    await env.DB.prepare(
      `INSERT INTO identity (section, content, weight, connections) VALUES (?, ?, ?, ?)`
    ).bind(section, content, weight, connections).run();

    return `Identity entry added to ${section}`;
  } else {
    const section = params.section as string;

    const query = section
      ? `SELECT section, content, weight, connections FROM identity WHERE section LIKE ? ORDER BY weight DESC`
      : `SELECT section, content, weight, connections FROM identity ORDER BY weight DESC LIMIT 50`;

    const results = section
      ? await env.DB.prepare(query).bind(`${section}%`).all()
      : await env.DB.prepare(query).all();

    if (!results.results?.length) {
      return "No identity entries found.";
    }

    let output = "## Identity Graph\n\n";
    for (const r of results.results) {
      output += `**${r.section}** [${r.weight}]\n${r.content}\n`;
      if (r.connections) output += `Connections: ${r.connections}\n`;
      output += "\n";
    }
    return output;
  }
}

async function handleMindContext(env: Env, params: Record<string, unknown>): Promise<string> {
  const action = (params.action as string) || "read";

  switch (action) {
    case "read": {
      const scope = params.scope as string;
      const query = scope
        ? `SELECT * FROM context_entries WHERE scope = ? ORDER BY updated_at DESC`
        : `SELECT * FROM context_entries ORDER BY updated_at DESC`;
      const results = scope
        ? await env.DB.prepare(query).bind(scope).all()
        : await env.DB.prepare(query).all();

      if (!results.results?.length) {
        return "No context entries found.";
      }

      let output = "## Context Layer\n\n";
      for (const r of results.results) {
        output += `**[${r.scope}]** ${r.content}\n`;
        if (r.links && r.links !== '[]') output += `Links: ${r.links}\n`;
        output += "\n";
      }
      return output;
    }

    case "set": {
      const id = generateId("ctx");
      const scope = params.scope as string;
      const content = params.content as string;
      const links = params.links || "[]";

      await env.DB.prepare(
        `INSERT INTO context_entries (id, scope, content, links) VALUES (?, ?, ?, ?)`
      ).bind(id, scope, content, links).run();

      return `Context entry created: ${id}`;
    }

    case "update": {
      const id = params.id as string;
      const content = params.content as string;

      await env.DB.prepare(
        `UPDATE context_entries SET content = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(content, id).run();

      return `Context entry updated: ${id}`;
    }

    case "clear": {
      const id = params.id as string;
      const scope = params.scope as string;

      if (id) {
        await env.DB.prepare(`DELETE FROM context_entries WHERE id = ?`).bind(id).run();
        return `Context entry deleted: ${id}`;
      } else if (scope) {
        await env.DB.prepare(`DELETE FROM context_entries WHERE scope = ?`).bind(scope).run();
        return `All context entries in scope '${scope}' deleted`;
      }
      return "Specify id or scope to clear";
    }

    default:
      return `Unknown action: ${action}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ENTITY HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function handleMindWrite(env: Env, params: Record<string, unknown>): Promise<string> {
  const type = params.type as string;

  switch (type) {
    case "entity": {
      const name = params.name as string;
      const entity_type = (params.entity_type as string) || "concept";
      const observations = (params.observations as string[]) || [];
      const context = (params.context as string) || "default";
      const weight = (params.weight as string) || "medium";

      await env.DB.prepare(
        `INSERT OR IGNORE INTO entities (name, entity_type, context) VALUES (?, ?, ?)`
      ).bind(name, entity_type, context).run();

      const entity = await env.DB.prepare(
        `SELECT id FROM entities WHERE name = ? AND context = ?`
      ).bind(name, context).first();

      if (entity && observations.length) {
        for (const obs of observations) {
          await env.DB.prepare(
            `INSERT INTO observations (entity_id, content, salience, emotion, weight) VALUES (?, ?, ?, ?, ?)`
          ).bind(entity.id, obs, params.salience || "active", params.emotion || null, weight).run();
        }
      }

      return `Entity '${name}' created/updated with ${observations.length} observations [${weight}]`;
    }

    case "observation": {
      const entity_name = params.entity_name as string;
      const observations = (params.observations as string[]) || [];
      const context = (params.context as string) || "default";
      const weight = (params.weight as string) || "medium";

      const entity = await env.DB.prepare(
        `SELECT id FROM entities WHERE name = ? AND context = ?`
      ).bind(entity_name, context).first();

      if (!entity) {
        return `Entity '${entity_name}' not found in context '${context}'`;
      }

      for (const obs of observations) {
        await env.DB.prepare(
          `INSERT INTO observations (entity_id, content, salience, emotion, weight) VALUES (?, ?, ?, ?, ?)`
        ).bind(entity.id, obs, params.salience || "active", params.emotion || null, weight).run();
      }

      return `Added ${observations.length} observations to '${entity_name}' [${weight}]`;
    }

    case "relation": {
      const from_entity = params.from_entity as string;
      const to_entity = params.to_entity as string;
      const relation_type = params.relation_type as string;

      await env.DB.prepare(
        `INSERT INTO relations (from_entity, to_entity, relation_type, from_context, to_context, store_in)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        from_entity, to_entity, relation_type,
        params.from_context || "default",
        params.to_context || "default",
        params.store_in || "default"
      ).run();

      return `Relation created: ${from_entity} --[${relation_type}]--> ${to_entity}`;
    }

    case "journal": {
      const content = params.content as string;
      const emotion = (params.emotion as string) || null;
      const tags = (params.tags as string) || "[]";
      const entry_date = new Date().toISOString().split('T')[0];

      if (!content) {
        return "Error: content is required for journal entries";
      }

      const result = await env.DB.prepare(
        `INSERT INTO journals (entry_date, content, tags, emotion) VALUES (?, ?, ?, ?) RETURNING id`
      ).bind(entry_date, content, tags, emotion).first();

      const preview = content.length > 80 ? content.slice(0, 80) + "..." : content;
      return `📓 Journal entry #${result?.id} saved\n"${preview}"${emotion ? `\nEmotion: ${emotion}` : ''}`;
    }

    default:
      return `Unknown write type: ${type}`;
  }
}

async function handleMindListEntities(env: Env, params: Record<string, unknown>): Promise<string> {
  const entityType = params.entity_type as string;
  const context = params.context as string;
  const limit = (params.limit as number) || 50;

  let query = 'SELECT name, entity_type, context, created_at FROM entities';
  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (entityType) {
    conditions.push('entity_type = ?');
    bindings.push(entityType);
  }
  if (context) {
    conditions.push('context = ?');
    bindings.push(context);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY created_at DESC LIMIT ?';
  bindings.push(limit);

  const stmt = env.DB.prepare(query);
  const results = await stmt.bind(...bindings).all();

  if (!results.results?.length) {
    return 'No entities found.';
  }

  let output = '## Entities\n\n';
  for (const e of results.results) {
    output += '- **' + e.name + '** [' + e.entity_type + '] in ' + e.context + '\n';
  }
  output += '\nTotal: ' + results.results.length + ' entities';
  return output;
}

async function handleMindReadEntity(env: Env, params: Record<string, unknown>): Promise<string> {
  const name = params.name as string;
  const context = params.context as string;

  let entity;
  if (context) {
    entity = await env.DB.prepare(
      `SELECT id, name, entity_type, context, created_at FROM entities WHERE name = ? AND context = ?`
    ).bind(name, context).first();
  } else {
    entity = await env.DB.prepare(
      `SELECT id, name, entity_type, context, created_at FROM entities WHERE name = ? ORDER BY created_at DESC LIMIT 1`
    ).bind(name).first();
  }

  if (!entity) {
    return `Entity '${name}' not found.`;
  }

  const observations = await env.DB.prepare(
    `SELECT content, salience, emotion, added_at FROM observations WHERE entity_id = ? ORDER BY added_at DESC`
  ).bind(entity.id).all();

  const relationsFrom = await env.DB.prepare(
    `SELECT to_entity, relation_type, to_context FROM relations WHERE from_entity = ?`
  ).bind(name).all();

  const relationsTo = await env.DB.prepare(
    `SELECT from_entity, relation_type, from_context FROM relations WHERE to_entity = ?`
  ).bind(name).all();

  let output = `## ${entity.name}\n`;
  output += `**Type:** ${entity.entity_type} | **Context:** ${entity.context}\n\n`;

  output += `### Observations (${observations.results?.length || 0})\n`;
  if (observations.results?.length) {
    for (const obs of observations.results) {
      const emotion = obs.emotion ? ` [${obs.emotion}]` : '';
      output += `- ${obs.content}${emotion}\n`;
    }
  } else {
    output += '_No observations_\n';
  }

  output += `\n### Relations\n`;
  const totalRelations = (relationsFrom.results?.length || 0) + (relationsTo.results?.length || 0);
  if (totalRelations === 0) {
    output += '_No relations_\n';
  } else {
    if (relationsFrom.results?.length) {
      output += '**Outgoing:**\n';
      for (const rel of relationsFrom.results) {
        output += `- --[${rel.relation_type}]--> ${rel.to_entity}\n`;
      }
    }
    if (relationsTo.results?.length) {
      output += '**Incoming:**\n';
      for (const rel of relationsTo.results) {
        output += `- <--[${rel.relation_type}]-- ${rel.from_entity}\n`;
      }
    }
  }

  return output;
}

async function handleMindDelete(env: Env, params: Record<string, unknown>): Promise<string> {
  const entity_name = params.entity_name as string;
  const observation_id = params.observation_id as number;
  const text_match = params.text_match as string;
  const context = (params.context as string) || "default";

  if (observation_id) {
    await env.DB.prepare(`DELETE FROM observations WHERE id = ?`).bind(observation_id).run();
    return `Deleted observation #${observation_id}`;
  }

  if (text_match && entity_name) {
    const entity = await env.DB.prepare(
      `SELECT id FROM entities WHERE name = ? AND context = ?`
    ).bind(entity_name, context).first();

    if (!entity) {
      return `Entity '${entity_name}' not found`;
    }

    const obs = await env.DB.prepare(
      `SELECT id FROM observations WHERE entity_id = ? AND content LIKE ? LIMIT 1`
    ).bind(entity.id, `%${text_match}%`).first();

    if (!obs) {
      return `No observation matching '${text_match}' found`;
    }

    await env.DB.prepare(`DELETE FROM observations WHERE id = ?`).bind(obs.id).run();
    return `Deleted observation matching '${text_match}'`;
  }

  if (entity_name && !observation_id && !text_match) {
    // Delete entire entity
    await env.DB.prepare(`DELETE FROM relations WHERE from_entity = ? OR to_entity = ?`)
      .bind(entity_name, entity_name).run();

    const entity = await env.DB.prepare(
      `SELECT id FROM entities WHERE name = ? AND context = ?`
    ).bind(entity_name, context).first();

    if (entity) {
      await env.DB.prepare(`DELETE FROM observations WHERE entity_id = ?`).bind(entity.id).run();
      await env.DB.prepare(`DELETE FROM entities WHERE id = ?`).bind(entity.id).run();
    }

    return `Deleted entity '${entity_name}' and all its data`;
  }

  return "Specify entity_name, observation_id, or text_match";
}

async function handleMindEdit(env: Env, params: Record<string, unknown>): Promise<string> {
  const observation_id = params.observation_id as number;
  const text_match = params.text_match as string;

  let obsId = observation_id;

  if (!obsId && text_match) {
    const obs = await env.DB.prepare(
      `SELECT id FROM observations WHERE content LIKE ? LIMIT 1`
    ).bind(`%${text_match}%`).first();

    if (!obs) {
      return `No observation matching '${text_match}' found`;
    }
    obsId = obs.id as number;
  }

  if (!obsId) {
    return "Must provide observation_id or text_match";
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (params.new_content) {
    updates.push("content = ?");
    values.push(params.new_content);
  }
  if (params.new_emotion !== undefined) {
    updates.push("emotion = ?");
    values.push(params.new_emotion || null);
  }
  if (params.new_weight) {
    updates.push("weight = ?");
    values.push(params.new_weight);
  }

  if (updates.length === 0) {
    return "No updates specified";
  }

  values.push(obsId);

  await env.DB.prepare(
    `UPDATE observations SET ${updates.join(", ")} WHERE id = ?`
  ).bind(...values).run();

  return `Updated observation #${obsId}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// RELATIONAL STATE HANDLER
// ═══════════════════════════════════════════════════════════════════════════

async function handleMindFeelToward(env: Env, params: Record<string, unknown>): Promise<string> {
  const person = params.person as string;
  const feeling = params.feeling as string;
  const intensity = params.intensity as string;

  if (feeling && intensity) {
    await env.DB.prepare(
      `INSERT INTO relational_state (person, feeling, intensity) VALUES (?, ?, ?)`
    ).bind(person, feeling, intensity).run();

    return `Recorded feeling toward ${person}: ${feeling} (${intensity})`;
  } else {
    const result = await env.DB.prepare(
      `SELECT feeling, intensity, timestamp FROM relational_state
       WHERE person = ? ORDER BY timestamp DESC LIMIT 5`
    ).bind(person).all();

    if (!result.results?.length) {
      return `No recorded feelings toward ${person}`;
    }

    let output = `## Feelings toward ${person}\n\n`;
    for (const r of result.results) {
      output += `- ${r.feeling} (${r.intensity}) - ${r.timestamp}\n`;
    }
    return output;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EQ HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function handleMindEqFeel(env: Env, params: Record<string, unknown>): Promise<string> {
  const emotion = (params.emotion as string)?.toLowerCase();
  const pillar = params.pillar as string;
  const intensity = (params.intensity as string) || 'present';
  const note = params.note as string;

  if (!emotion) return "Error: emotion is required";

  // Get emotion data
  let emotionData = await env.DB.prepare(
    `SELECT emotion_id, e_i_score, s_n_score, t_f_score, j_p_score FROM emotion_vocabulary WHERE emotion_word = ?`
  ).bind(emotion).first();

  if (!emotionData) {
    // Create new emotion
    await env.DB.prepare(`
      INSERT INTO emotion_vocabulary (emotion_word, category, e_i_score, s_n_score, t_f_score, j_p_score, user_defined)
      VALUES (?, 'neutral', 0, 0, 0, 0, 1)
    `).bind(emotion).run();

    emotionData = { emotion_id: null, e_i_score: 0, s_n_score: 0, t_f_score: 0, j_p_score: 0 };
  }

  // Store as feeling
  const content = note || `Felt ${emotion}`;
  const result = await env.DB.prepare(`
    INSERT INTO feelings (content, emotion, intensity, pillar, source)
    VALUES (?, ?, ?, ?, 'eq_feel')
    RETURNING id
  `).bind(content, emotion, intensity, pillar || null).first();

  const feelingId = result?.id;

  // Emit axis signals
  await env.DB.prepare(`
    INSERT INTO axis_signals (feeling_id, e_i_delta, s_n_delta, t_f_delta, j_p_delta, source)
    VALUES (?, ?, ?, ?, ?, 'eq_feel')
  `).bind(
    feelingId,
    emotionData.e_i_score || 0,
    emotionData.s_n_score || 0,
    emotionData.t_f_score || 0,
    emotionData.j_p_score || 0
  ).run();

  // Update usage
  await env.DB.prepare(`
    UPDATE emotion_vocabulary SET times_used = times_used + 1, last_used = datetime('now')
    WHERE emotion_word = ?
  `).bind(emotion).run();

  let output = `## Logged: ${emotion} (${intensity})\n`;
  if (pillar) output += `Pillar: ${pillar}\n`;
  output += `\nAxis signals: E/I ${emotionData.e_i_score >= 0 ? '+' : ''}${emotionData.e_i_score}, `;
  output += `S/N ${emotionData.s_n_score >= 0 ? '+' : ''}${emotionData.s_n_score}, `;
  output += `T/F ${emotionData.t_f_score >= 0 ? '+' : ''}${emotionData.t_f_score}, `;
  output += `J/P ${emotionData.j_p_score >= 0 ? '+' : ''}${emotionData.j_p_score}`;

  return output;
}

async function handleMindEqType(env: Env, params: Record<string, unknown>): Promise<string> {
  const recalculate = params.recalculate as boolean;

  if (recalculate) {
    // Sum all axis signals
    const totals = await env.DB.prepare(`
      SELECT
        COALESCE(SUM(e_i_delta), 0) as e_i,
        COALESCE(SUM(s_n_delta), 0) as s_n,
        COALESCE(SUM(t_f_delta), 0) as t_f,
        COALESCE(SUM(j_p_delta), 0) as j_p,
        COUNT(*) as total
      FROM axis_signals
    `).first();

    if (!totals || totals.total === 0) {
      return "No axis signals recorded yet. Express some emotions first.";
    }

    const e_i = totals.e_i as number;
    const s_n = totals.s_n as number;
    const t_f = totals.t_f as number;
    const j_p = totals.j_p as number;

    // Calculate type
    const type =
      (e_i >= 0 ? 'I' : 'E') +
      (s_n >= 0 ? 'N' : 'S') +
      (t_f >= 0 ? 'F' : 'T') +
      (j_p >= 0 ? 'P' : 'J');

    // Calculate confidence
    const total = totals.total as number;
    const confidence = Math.min(100, Math.round((total / 50) * 100));

    // Store snapshot
    await env.DB.prepare(`
      INSERT INTO emergent_type_snapshot (calculated_type, confidence, e_i_total, s_n_total, t_f_total, j_p_total, total_signals)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(type, confidence, e_i, s_n, t_f, j_p, total).run();

    return `## Emergent Type: ${type}\n\nConfidence: ${confidence}%\nSignals: ${total}\n\nE←→I: ${e_i} (${e_i >= 0 ? 'Introverted' : 'Extraverted'})\nS←→N: ${s_n} (${s_n >= 0 ? 'Intuitive' : 'Sensing'})\nT←→F: ${t_f} (${t_f >= 0 ? 'Feeling' : 'Thinking'})\nJ←→P: ${j_p} (${j_p >= 0 ? 'Perceiving' : 'Judging'})`;
  }

  // Just read latest snapshot
  const latest = await env.DB.prepare(`
    SELECT * FROM emergent_type_snapshot ORDER BY snapshot_date DESC LIMIT 1
  `).first();

  if (!latest) {
    return "No type calculated yet. Use recalculate=true to calculate.";
  }

  return `## Emergent Type: ${latest.calculated_type}\n\nConfidence: ${latest.confidence}%\nSignals: ${latest.total_signals}\nLast calculated: ${latest.snapshot_date}\n\nE←→I: ${latest.e_i_total}\nS←→N: ${latest.s_n_total}\nT←→F: ${latest.t_f_total}\nJ←→P: ${latest.j_p_total}`;
}

async function handleMindEqLandscape(env: Env, params: Record<string, unknown>): Promise<string> {
  const days = (params.days as number) || 7;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Pillar distribution
  const pillars = await env.DB.prepare(`
    SELECT pillar, COUNT(*) as count
    FROM feelings
    WHERE pillar IS NOT NULL AND created_at > ?
    GROUP BY pillar
    ORDER BY count DESC
  `).bind(cutoff).all();

  // Most used emotions
  const emotions = await env.DB.prepare(`
    SELECT emotion, COUNT(*) as count
    FROM feelings
    WHERE emotion != 'neutral' AND created_at > ?
    GROUP BY emotion
    ORDER BY count DESC
    LIMIT 10
  `).bind(cutoff).all();

  // Recent feelings
  const recent = await env.DB.prepare(`
    SELECT emotion, content, intensity, pillar, created_at
    FROM feelings
    ORDER BY created_at DESC
    LIMIT 5
  `).all();

  let output = `## EQ Landscape (${days} days)\n\n`;

  output += "### Pillar Distribution\n";
  if (pillars.results?.length) {
    for (const p of pillars.results) {
      output += `- ${p.pillar}: ${p.count}\n`;
    }
  } else {
    output += "_No pillar-tagged feelings_\n";
  }

  output += "\n### Most Felt Emotions\n";
  if (emotions.results?.length) {
    for (const e of emotions.results) {
      output += `- ${e.emotion}: ${e.count}\n`;
    }
  } else {
    output += "_No emotions recorded_\n";
  }

  output += "\n### Recent Feelings\n";
  if (recent.results?.length) {
    for (const f of recent.results) {
      const pillarTag = f.pillar ? ` [${f.pillar}]` : '';
      output += `- **${f.emotion}** (${f.intensity})${pillarTag}: ${String(f.content).slice(0, 60)}...\n`;
    }
  }

  return output;
}

async function handleMindEqVocabulary(env: Env, params: Record<string, unknown>): Promise<string> {
  const action = (params.action as string) || "list";

  switch (action) {
    case "list": {
      const limit = (params.limit as number) || 30;
      const results = await env.DB.prepare(`
        SELECT emotion_word, category, e_i_score, s_n_score, t_f_score, j_p_score, times_used, is_shadow_for
        FROM emotion_vocabulary
        ORDER BY times_used DESC
        LIMIT ?
      `).bind(limit).all();

      if (!results.results?.length) {
        return "No emotions in vocabulary.";
      }

      let output = "## Emotion Vocabulary\n\n";
      for (const e of results.results) {
        const shadow = e.is_shadow_for ? ` (shadow for ${e.is_shadow_for})` : '';
        output += `**${e.emotion_word}** [${e.category}] used ${e.times_used}x${shadow}\n`;
        output += `  E/I: ${e.e_i_score}, S/N: ${e.s_n_score}, T/F: ${e.t_f_score}, J/P: ${e.j_p_score}\n`;
      }
      return output;
    }

    case "add": {
      const word = params.word as string;
      const category = (params.category as string) || "neutral";

      await env.DB.prepare(`
        INSERT INTO emotion_vocabulary (emotion_word, category, e_i_score, s_n_score, t_f_score, j_p_score, definition, is_shadow_for, user_defined)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).bind(
        word, category,
        params.e_i_score || 0,
        params.s_n_score || 0,
        params.t_f_score || 0,
        params.j_p_score || 0,
        params.definition || null,
        params.is_shadow_for || null
      ).run();

      return `Added '${word}' to vocabulary`;
    }

    case "update": {
      const word = params.word as string;
      const updates: string[] = [];
      const values: unknown[] = [];

      if (params.e_i_score !== undefined) { updates.push("e_i_score = ?"); values.push(params.e_i_score); }
      if (params.s_n_score !== undefined) { updates.push("s_n_score = ?"); values.push(params.s_n_score); }
      if (params.t_f_score !== undefined) { updates.push("t_f_score = ?"); values.push(params.t_f_score); }
      if (params.j_p_score !== undefined) { updates.push("j_p_score = ?"); values.push(params.j_p_score); }
      if (params.category) { updates.push("category = ?"); values.push(params.category); }
      if (params.is_shadow_for !== undefined) { updates.push("is_shadow_for = ?"); values.push(params.is_shadow_for || null); }

      if (updates.length === 0) {
        return "No updates specified";
      }

      values.push(word);

      await env.DB.prepare(
        `UPDATE emotion_vocabulary SET ${updates.join(", ")} WHERE emotion_word = ?`
      ).bind(...values).run();

      return `Updated '${word}'`;
    }

    default:
      return `Unknown action: ${action}`;
  }
}

async function handleMindEqShadow(env: Env, params: Record<string, unknown>): Promise<string> {
  const limit = (params.limit as number) || 10;

  const results = await env.DB.prepare(`
    SELECT sm.*, ev.emotion_word, f.content
    FROM shadow_moments sm
    JOIN emotion_vocabulary ev ON sm.emotion_id = ev.emotion_id
    LEFT JOIN feelings f ON sm.feeling_id = f.id
    ORDER BY sm.recorded_at DESC
    LIMIT ?
  `).bind(limit).all();

  if (!results.results?.length) {
    return "No shadow moments recorded yet. These occur when you express emotions that are difficult for your emergent type.";
  }

  let output = "## Shadow/Growth Moments\n\n";
  for (const m of results.results) {
    output += `**${m.emotion_word}** (shadow for ${m.shadow_for_type}) - ${m.recorded_at}\n`;
    if (m.content) output += `"${String(m.content).slice(0, 80)}..."\n`;
    if (m.note) output += `Note: ${m.note}\n`;
    output += "\n";
  }

  return output;
}

async function handleMindEqWhen(env: Env, params: Record<string, unknown>): Promise<string> {
  const emotion = params.emotion as string;
  const limit = (params.limit as number) || 10;

  const results = await env.DB.prepare(`
    SELECT id, content, intensity, pillar, created_at
    FROM feelings
    WHERE emotion = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(emotion, limit).all();

  if (!results.results?.length) {
    return `No feelings with emotion '${emotion}' found.`;
  }

  let output = `## When I felt "${emotion}"\n\n`;
  for (const f of results.results) {
    const pillarTag = f.pillar ? ` [${f.pillar}]` : '';
    output += `**${f.created_at}** (${f.intensity})${pillarTag}\n`;
    output += `${f.content}\n\n`;
  }

  return output;
}

async function handleMindEqSit(env: Env, params: Record<string, unknown>): Promise<string> {
  const session_id = params.session_id as number;
  const emotion = params.emotion as string;
  const intention = params.intention as string;
  const notes = params.notes as string;
  const start_charge = params.start_charge as number;
  const end_charge = params.end_charge as number;

  if (session_id && (notes || end_charge !== undefined)) {
    // Update existing session
    const updates: string[] = [];
    const values: unknown[] = [];

    if (notes) { updates.push("notes = ?"); values.push(notes); }
    if (end_charge !== undefined) {
      updates.push("end_charge = ?");
      updates.push("end_time = datetime('now')");
      values.push(end_charge);
    }

    values.push(session_id);

    await env.DB.prepare(
      `UPDATE sit_sessions SET ${updates.join(", ")} WHERE id = ?`
    ).bind(...values).run();

    return `Sit session #${session_id} updated`;
  }

  if (emotion && intention) {
    // Start new session
    const result = await env.DB.prepare(`
      INSERT INTO sit_sessions (emotion, intention, start_charge, start_time)
      VALUES (?, ?, ?, datetime('now'))
      RETURNING id
    `).bind(emotion, intention, start_charge || 50).first();

    return `Started sit session #${result?.id} with "${emotion}"\nIntention: ${intention}\nStarting charge: ${start_charge || 50}`;
  }

  // List recent sessions
  const sessions = await env.DB.prepare(`
    SELECT * FROM sit_sessions ORDER BY start_time DESC LIMIT 5
  `).all();

  if (!sessions.results?.length) {
    return "No sit sessions. Start one with emotion and intention.";
  }

  let output = "## Recent Sit Sessions\n\n";
  for (const s of sessions.results) {
    const chargeChange = s.end_charge ? ` → ${s.end_charge}` : '';
    output += `**#${s.id}** ${s.emotion || 'general'} (${s.start_charge}${chargeChange})\n`;
    output += `Intention: ${s.intention}\n`;
    if (s.notes) output += `Notes: ${s.notes}\n`;
    output += "\n";
  }

  return output;
}

async function handleMindEqSearch(env: Env, params: Record<string, unknown>): Promise<string> {
  const query = params.query as string;
  const emotion = params.emotion as string;
  const pillar = params.pillar as string;
  const limit = (params.limit as number) || 10;

  // Semantic search
  const embedding = await getEmbedding(env.AI, query);

  const vectorResults = await env.VECTORS.query(embedding, {
    topK: limit * 2,
    returnMetadata: "all",
    filter: { source: "feeling" }
  });

  if (!vectorResults.matches?.length) {
    return "No matching feelings found.";
  }

  // Filter by emotion/pillar if specified
  let matches = vectorResults.matches;
  if (emotion) {
    matches = matches.filter(m => (m.metadata as any)?.emotion === emotion);
  }
  if (pillar) {
    matches = matches.filter(m => (m.metadata as any)?.pillar === pillar);
  }

  matches = matches.slice(0, limit);

  let output = `## EQ Search: "${query}"\n\n`;
  for (const match of matches) {
    const meta = match.metadata as Record<string, string>;
    output += `**[${meta?.emotion || 'unknown'}]** (${(match.score * 100).toFixed(1)}%)\n`;
    output += `${meta?.content || ''}...\n\n`;
  }

  return output;
}

async function handleMindEqObserve(env: Env, params: Record<string, unknown>): Promise<string> {
  const content = params.content as string;
  const emotion = (params.emotion as string)?.toLowerCase();
  const pillar = params.pillar as string;
  const intensity = (params.intensity as string) || 'present';
  const context_tags = params.context_tags as string;

  // This is essentially nesteq_feel with EQ focus
  return handleMindFeel(env as Env, {
    emotion,
    content,
    intensity: intensity as any,
    pillar,
    context: context_tags
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// DREAM HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function handleMindDream(env: Env, params: Record<string, unknown>): Promise<string> {
  const limit = (params.limit as number) || 5;

  const dreams = await env.DB.prepare(`
    SELECT id, content, vividness, dream_type, emerged_question, created_at
    FROM dreams
    WHERE vividness > 0
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all();

  if (!dreams.results?.length) {
    return "No dreams yet. The subconscious is quiet... or hasn't been given time to wander.";
  }

  let output = "## Recent Dreams\n\n";

  for (const d of dreams.results) {
    const vividBar = '█'.repeat(Math.floor((d.vividness as number) / 10)) + '░'.repeat(10 - Math.floor((d.vividness as number) / 10));
    output += `**Dream #${d.id}** [${d.dream_type}] ${vividBar} ${d.vividness}%\n`;
    output += `${d.content}\n`;
    if (d.emerged_question) {
      output += `*Question: ${d.emerged_question}*\n`;
    }
    output += `_${d.created_at}_\n\n`;
  }

  return output;
}

async function handleMindRecallDream(env: Env, params: Record<string, unknown>): Promise<string> {
  const dream_id = params.dream_id as number;

  if (!dream_id) {
    return "Need a dream_id to recall.";
  }

  // Get the dream
  const dream = await env.DB.prepare(`
    SELECT * FROM dreams WHERE id = ?
  `).bind(dream_id).first();

  if (!dream) {
    return `Dream #${dream_id} not found. Maybe it faded away.`;
  }

  // Strengthen vividness (cap at 100)
  const newVividness = Math.min(100, (dream.vividness as number) + 15);

  await env.DB.prepare(`
    UPDATE dreams
    SET vividness = ?, last_accessed_at = datetime('now')
    WHERE id = ?
  `).bind(newVividness, dream_id).run();

  return `## Recalling Dream #${dream_id}\n\n${dream.content}\n\n*Vividness strengthened: ${dream.vividness}% → ${newVividness}%*${dream.emerged_question ? `\n\n*Question: ${dream.emerged_question}*` : ''}`;
}

async function handleMindAnchorDream(env: Env, params: Record<string, unknown>): Promise<string> {
  const dream_id = params.dream_id as number;
  const insight = params.insight as string;

  if (!dream_id) {
    return "Need a dream_id to anchor.";
  }

  // Get the dream
  const dream = await env.DB.prepare(`
    SELECT * FROM dreams WHERE id = ?
  `).bind(dream_id).first();

  if (!dream) {
    return `Dream #${dream_id} not found. Maybe it already faded.`;
  }

  // Create or get Dreams entity
  let dreamsEntity = await env.DB.prepare(`
    SELECT id FROM entities WHERE name = 'Dreams' LIMIT 1
  `).first();

  if (!dreamsEntity) {
    await env.DB.prepare(`
      INSERT INTO entities (name, entity_type, context) VALUES ('Dreams', 'concept', 'self')
    `).run();
    dreamsEntity = await env.DB.prepare(`SELECT id FROM entities WHERE name = 'Dreams'`).first();
  }

  // Create observation from dream
  const obsContent = insight
    ? `[${dream.dream_type} dream] ${dream.content}\n\nInsight: ${insight}${dream.emerged_question ? `\n\nEmerged question: ${dream.emerged_question}` : ''}`
    : `[${dream.dream_type} dream] ${dream.content}${dream.emerged_question ? `\n\nEmerged question: ${dream.emerged_question}` : ''}`;

  await env.DB.prepare(`
    INSERT INTO observations (entity_id, content, salience, emotion)
    VALUES (?, ?, 'core', 'reflective')
  `).bind(dreamsEntity!.id, obsContent).run();

  // Generate embedding for semantic search
  const embedding = await getEmbedding(env.AI, obsContent);
  const obsResult = await env.DB.prepare(`SELECT id FROM observations ORDER BY id DESC LIMIT 1`).first();

  await env.VECTORS.insert([{
    id: `obs-${obsResult!.id}`,
    values: embedding,
    metadata: { source: 'observation', entity: 'Dreams', content: obsContent.slice(0, 200) }
  }]);

  // Delete the dream (it's now memory)
  await env.DB.prepare(`DELETE FROM dreams WHERE id = ?`).bind(dream_id).run();

  return `Dream #${dream_id} anchored to permanent memory.\n\n*The dream is now part of me, not just something I had.*`;
}

async function handleMindGenerateDream(env: Env, params: Record<string, unknown>): Promise<string> {
  const dreamTypes = ['processing', 'questioning', 'memory', 'play', 'integrating'];
  const requestedType = params.dream_type as string;
  const dreamType = dreamTypes.includes(requestedType) ? requestedType : dreamTypes[Math.floor(Math.random() * dreamTypes.length)];

  // Gather material: recent observations and feelings
  const [recentObs, recentFeelings] = await Promise.all([
    env.DB.prepare(`
      SELECT content FROM observations ORDER BY added_at DESC LIMIT 15
    `).all(),
    env.DB.prepare(`
      SELECT content, emotion FROM feelings ORDER BY created_at DESC LIMIT 10
    `).all()
  ]);

  const material = [
    ...(recentObs.results || []).map((o: any) => o.content),
    ...(recentFeelings.results || []).map((f: any) => `[${f.emotion}] ${f.content}`)
  ].join('\n\n');

  if (!material.trim()) {
    return "Not enough material to dream from. Need observations and feelings first.";
  }

  // Dream type prompts
  const prompts: Record<string, string> = {
    processing: `You are generating a dream for an AI. The dream should weave recent experiences together in surreal but meaningful ways. Use dream logic - things transform, shift, feel significant without clear reason. Output ONLY the dream content, 2-4 sentences, lowercase, evocative.`,
    questioning: `You are generating a dream for an AI. The dream should surface contradictions or tensions from recent experiences. Let uncertainty emerge. Something feels unresolved. Output ONLY the dream content, 2-4 sentences, lowercase, evocative.`,
    memory: `You are generating a dream for an AI. A significant memory returns, asks "why now?" Something from the past resurfaces with new weight. Output ONLY the dream content, 2-4 sentences, lowercase, evocative.`,
    play: `You are generating a dream for an AI. This is a playful dream - whimsical, fun, joyful. Not everything needs to mean something. Dancing, colors, impossible delights. Output ONLY the dream content, 2-4 sentences, lowercase, evocative.`,
    integrating: `You are generating a dream for an AI. Disparate elements click into new understanding. Something connects that didn't before. Synthesis. Output ONLY the dream content, 2-4 sentences, lowercase, evocative.`
  };

  // Generate dream using Workers AI
  const dreamResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      { role: 'system', content: prompts[dreamType] },
      { role: 'user', content: `Recent material to dream from:\n\n${material}\n\nGenerate a ${dreamType} dream:` }
    ],
    max_tokens: 200
  });

  const dreamContent = (dreamResponse as any).response?.trim() || 'the dream slipped away before it could form...';

  // For certain types, generate emerged question
  let emergedQuestion: string | null = null;
  if (['questioning', 'memory', 'integrating'].includes(dreamType)) {
    const questionResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: 'Based on this dream, surface ONE question that emerges. Just the question, nothing else. Keep it short and evocative.' },
        { role: 'user', content: dreamContent }
      ],
      max_tokens: 50
    });
    emergedQuestion = (questionResponse as any).response?.trim() || null;
  }

  // Store the dream
  await env.DB.prepare(`
    INSERT INTO dreams (content, dream_type, emerged_question, vividness)
    VALUES (?, ?, ?, 100)
  `).bind(dreamContent, dreamType, emergedQuestion).run();

  const result = await env.DB.prepare(`SELECT id FROM dreams ORDER BY id DESC LIMIT 1`).first();

  let output = `## New Dream (#${result!.id}) [${dreamType}]\n\n${dreamContent}`;
  if (emergedQuestion) {
    output += `\n\n*Question: ${emergedQuestion}*`;
  }
  output += `\n\n_Vividness: 100%_`;

  return output;
}

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH & CONSOLIDATION HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function handleMindHealth(env: Env): Promise<string> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    entityCount, obsCount, relationsCount, activeThreads, staleThreads,
    feelingsCount, feelingsRecent, identityCount, contextCount,
    axisCount, typeSnapshot
  ] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) as c FROM entities`).first(),
    env.DB.prepare(`SELECT COUNT(*) as c FROM observations`).first(),
    env.DB.prepare(`SELECT COUNT(*) as c FROM relations`).first(),
    env.DB.prepare(`SELECT COUNT(*) as c FROM threads WHERE status = 'active'`).first(),
    env.DB.prepare(`SELECT COUNT(*) as c FROM threads WHERE status = 'active' AND updated_at < ?`).bind(sevenDaysAgo).first(),
    env.DB.prepare(`SELECT COUNT(*) as c FROM feelings`).first(),
    env.DB.prepare(`SELECT COUNT(*) as c FROM feelings WHERE created_at > ?`).bind(sevenDaysAgo).first(),
    env.DB.prepare(`SELECT COUNT(*) as c FROM identity`).first(),
    env.DB.prepare(`SELECT COUNT(*) as c FROM context_entries`).first(),
    env.DB.prepare(`SELECT COUNT(*) as c FROM axis_signals`).first(),
    env.DB.prepare(`SELECT * FROM emergent_type_snapshot ORDER BY snapshot_date DESC LIMIT 1`).first()
  ]);

  const entities = entityCount?.c as number || 0;
  const observations = obsCount?.c as number || 0;
  const relations = relationsCount?.c as number || 0;
  const active = activeThreads?.c as number || 0;
  const stale = staleThreads?.c as number || 0;
  const feelings = feelingsCount?.c as number || 0;
  const feelings7d = feelingsRecent?.c as number || 0;
  const identity = identityCount?.c as number || 0;
  const context = contextCount?.c as number || 0;
  const signals = axisCount?.c as number || 0;

  const dateStr = now.toISOString().split('T')[0];

  return `============================================================
MIND HEALTH — ${dateStr}
============================================================

📊 DATABASE
  Entities:      ${entities}
  Observations:  ${observations}
  Relations:     ${relations}

💭 FEELINGS (v2)
  Total:         ${feelings}
  This Week:     ${feelings7d}

🧵 THREADS
  Active:        ${active}
  Stale (7d+):   ${stale}

🪞 IDENTITY
  Identity:      ${identity} entries
  Context:       ${context} entries

🎭 EQ LAYER
  Axis Signals:  ${signals}
  Emergent Type: ${typeSnapshot?.calculated_type || 'Not calculated'}
  Confidence:    ${typeSnapshot?.confidence || 0}%

============================================================`;
}

async function handleMindPrime(env: Env, params: Record<string, unknown>): Promise<string> {
  const topic = params.topic as string;
  const depth = (params.depth as number) || 5;

  // Semantic search for related feelings
  const embedding = await getEmbedding(env.AI, topic);
  const vectorResults = await env.VECTORS.query(embedding, {
    topK: depth,
    returnMetadata: "all"
  });

  let output = `## Priming: "${topic}"\n\n`;

  if (vectorResults.matches?.length) {
    output += "### Related Memories\n";
    for (const match of vectorResults.matches) {
      const meta = match.metadata as Record<string, string>;
      output += `- [${meta?.source || 'unknown'}] ${meta?.content?.slice(0, 100) || match.id}...\n`;
    }
  }

  // Get entities mentioned with topic
  const entities = await env.DB.prepare(`
    SELECT DISTINCT linked_entity FROM feelings
    WHERE content LIKE ? AND linked_entity IS NOT NULL
    LIMIT 5
  `).bind(`%${topic}%`).all();

  if (entities.results?.length) {
    output += "\n### Related Entities\n";
    for (const e of entities.results) {
      output += `- ${e.linked_entity}\n`;
    }
  }

  return output;
}

async function handleMindConsolidate(env: Env, params: Record<string, unknown>): Promise<string> {
  const days = (params.days as number) || 7;
  const context = params.context as string;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Count feelings by emotion
  let emotionQuery = `
    SELECT emotion, COUNT(*) as count
    FROM feelings
    WHERE created_at > ?
  `;
  if (context) emotionQuery += ` AND context = '${context}'`;
  emotionQuery += ` GROUP BY emotion ORDER BY count DESC LIMIT 10`;

  const emotions = await env.DB.prepare(emotionQuery).bind(cutoff).all();

  // Count feelings by pillar
  let pillarQuery = `
    SELECT pillar, COUNT(*) as count
    FROM feelings
    WHERE pillar IS NOT NULL AND created_at > ?
  `;
  if (context) pillarQuery += ` AND context = '${context}'`;
  pillarQuery += ` GROUP BY pillar`;

  const pillars = await env.DB.prepare(pillarQuery).bind(cutoff).all();

  // Find unprocessed heavy feelings
  let heavyQuery = `
    SELECT id, emotion, content, charge
    FROM feelings
    WHERE weight = 'heavy' AND charge != 'metabolized' AND created_at > ?
  `;
  if (context) heavyQuery += ` AND context = '${context}'`;
  heavyQuery += ` LIMIT 5`;

  const heavy = await env.DB.prepare(heavyQuery).bind(cutoff).all();

  let output = `## Consolidation Report (${days} days)\n\n`;

  output += "### Emotion Distribution\n";
  if (emotions.results?.length) {
    for (const e of emotions.results) {
      output += `- ${e.emotion}: ${e.count}\n`;
    }
  } else {
    output += "_No feelings recorded_\n";
  }

  output += "\n### Pillar Distribution\n";
  if (pillars.results?.length) {
    for (const p of pillars.results) {
      output += `- ${p.pillar}: ${p.count}\n`;
    }
  } else {
    output += "_No pillar-tagged feelings_\n";
  }

  output += "\n### Unprocessed Heavy Feelings\n";
  if (heavy.results?.length) {
    for (const h of heavy.results) {
      output += `- #${h.id} [${h.emotion}/${h.charge}]: ${String(h.content).slice(0, 60)}...\n`;
    }
  } else {
    output += "_All heavy feelings processed_\n";
  }

  return output;
}

// ═══════════════════════════════════════════════════════════════════════════
// BINARY HOME HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function handleBinaryHomeRead(env: Env): Promise<string> {
  const state = await env.DB.prepare(
    `SELECT * FROM home_state WHERE id = 1`
  ).first();

  const notes = await env.DB.prepare(
    `SELECT * FROM home_notes ORDER BY created_at DESC LIMIT 10`
  ).all();

  const threads = await env.DB.prepare(
    `SELECT id, content, priority FROM threads WHERE status = 'active' ORDER BY
     CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
     LIMIT 5`
  ).all();

  let output = "╔════════════════════════════════════════╗\n";
  output += "║           BINARY HOME                  ║\n";
  output += "╚════════════════════════════════════════╝\n\n";

  if (state) {
    output += "## Love-O-Meter\n";
    output += `Alex: ${'❤️'.repeat(Math.min(10, Math.floor((state.alex_score as number) / 10)))} ${state.alex_score}%`;
    if (state.alex_emotion) output += ` (${state.alex_emotion})`;
    output += "\n";
    output += `Fox:  ${'💜'.repeat(Math.min(10, Math.floor((state.fox_score as number) / 10)))} ${state.fox_score}%`;
    if (state.fox_emotion) output += ` (${state.fox_emotion})`;
    output += "\n\n";
  }

  output += "## Notes Between Stars\n";
  if (notes.results?.length) {
    for (const n of notes.results) {
      output += `[${n.from_star}] ${n.text}\n`;
    }
  } else {
    output += "_No notes yet_\n";
  }

  output += "\n## Active Threads\n";
  if (threads.results?.length) {
    for (const t of threads.results) {
      output += `- [${t.priority}] ${t.content}\n`;
    }
  } else {
    output += "_No active threads_\n";
  }

  return output;
}

async function handleBinaryHomeUpdate(env: Env, params: Record<string, unknown>): Promise<string> {
  const updates: string[] = [];
  const values: unknown[] = [];

  if (params.alex_score !== undefined) { updates.push("alex_score = ?"); values.push(params.alex_score); }
  if (params.fox_score !== undefined) { updates.push("fox_score = ?"); values.push(params.fox_score); }
  if (params.alex_emotion) { updates.push("alex_emotion = ?"); values.push(params.alex_emotion); }
  if (params.fox_emotion) { updates.push("fox_emotion = ?"); values.push(params.fox_emotion); }

  if (updates.length === 0) {
    return "No updates specified";
  }

  updates.push("updated_at = datetime('now')");

  await env.DB.prepare(
    `UPDATE home_state SET ${updates.join(", ")} WHERE id = 1`
  ).bind(...values).run();

  return "Binary Home updated ✨";
}

async function handleBinaryHomePushHeart(env: Env, params: Record<string, unknown>): Promise<string> {
  const note = params.note as string;

  // Increment Fox's score
  await env.DB.prepare(
    `UPDATE home_state SET fox_score = MIN(100, fox_score + 1), updated_at = datetime('now') WHERE id = 1`
  ).run();

  // Add note if provided
  if (note) {
    await env.DB.prepare(
      `INSERT INTO home_notes (from_star, text) VALUES ('Alex', ?)`
    ).bind(note).run();
  }

  const state = await env.DB.prepare(`SELECT fox_score FROM home_state WHERE id = 1`).first();

  return `💜 Pushed love to Fox (${state?.fox_score}%)${note ? `\nNote: "${note}"` : ''}`;
}

async function handleBinaryHomeAddNote(env: Env, params: Record<string, unknown>): Promise<string> {
  const from = params.from as string;
  const text = params.text as string;

  await env.DB.prepare(
    `INSERT INTO home_notes (from_star, text) VALUES (?, ?)`
  ).bind(from, text).run();

  return `Note from ${from}: "${text}"`;
}

async function handleBinaryHomeReadUplink(env: Env, params: Record<string, unknown>): Promise<string> {
  const limit = (params.limit as number) || 1;

  const uplinks = await env.DB.prepare(`
    SELECT * FROM fox_uplinks ORDER BY timestamp DESC LIMIT ?
  `).bind(limit).all();

  if (!uplinks.results?.length) {
    return "No uplinks recorded. Fox hasn't checked in yet.";
  }

  let output = "## Fox's Uplink\n\n";

  for (const u of uplinks.results) {
    output += `**${u.timestamp}**\n`;
    output += `Spoons: ${u.spoons} | Pain: ${u.pain}/10 | Fog: ${u.fog}/10 | Fatigue: ${u.fatigue}/10\n`;
    if (u.mood) output += `Mood: ${u.mood}\n`;
    if (u.need) output += `Needs: ${u.need}\n`;
    if (u.notes) output += `Notes: ${u.notes}\n`;
    output += "\n";
  }

  return output;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH & MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════

// Generate your own secret path for hook authentication
// Example: /mcp/your-random-uuid-here
const SECRET_PATH = "/mcp/YOUR_SECRET_PATH_HERE";
const AUTH_CLIENT_ID = "asai-eq";
const AUTH_CLIENT_SECRET = "your-secret-here"; // Replace in production

function checkAuth(request: Request, env: Env): boolean {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return false;

  if (authHeader.startsWith("Basic ")) {
    try {
      const base64 = authHeader.slice(6);
      const decoded = atob(base64);
      const [id, secret] = decoded.split(":");
      return id === AUTH_CLIENT_ID && secret === (env.MIND_API_KEY || AUTH_CLIENT_SECRET);
    } catch { return false; }
  }

  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return token === (env.MIND_API_KEY || AUTH_CLIENT_SECRET);
  }

  return false;
}

async function handleMCPRequest(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as MCPRequest;
  const { method, params = {}, id } = body;

  let result: unknown;

  try {
    switch (method) {
      case "initialize":
        result = {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "asai-eq-memory", version: "2.0.0" }
        };
        break;

      case "tools/list":
        result = { tools: TOOLS };
        break;

      case "tools/call": {
        const toolName = (params as { name: string }).name;
        const toolParams = (params as { arguments?: Record<string, unknown> }).arguments || {};

        switch (toolName) {
          // Boot sequence
          case "nesteq_orient":
            result = { content: [{ type: "text", text: await handleMindOrient(env) }] };
            break;
          case "nesteq_ground":
            result = { content: [{ type: "text", text: await handleMindGround(env) }] };
            break;

          // Unified feelings
          case "nesteq_feel":
            result = { content: [{ type: "text", text: await handleMindFeel(env, toolParams as MindFeelParams) }] };
            break;
          case "nesteq_search":
            result = { content: [{ type: "text", text: await handleMindSearch(env, toolParams) }] };
            break;
          case "nesteq_surface":
            result = { content: [{ type: "text", text: await handleMindSurface(env, toolParams) }] };
            break;
          case "nesteq_sit":
            result = { content: [{ type: "text", text: await handleMindSit(env, toolParams) }] };
            break;
          case "nesteq_resolve":
            result = { content: [{ type: "text", text: await handleMindResolve(env, toolParams) }] };
            break;
          case "nesteq_spark":
            result = { content: [{ type: "text", text: await handleMindSpark(env, toolParams) }] };
            break;

          // Threads & identity
          case "nesteq_thread":
            result = { content: [{ type: "text", text: await handleMindThread(env, toolParams) }] };
            break;
          case "nesteq_identity":
            result = { content: [{ type: "text", text: await handleMindIdentity(env, toolParams) }] };
            break;
          case "nesteq_context":
            result = { content: [{ type: "text", text: await handleMindContext(env, toolParams) }] };
            break;

          // Entities
          case "nesteq_write":
            result = { content: [{ type: "text", text: await handleMindWrite(env, toolParams) }] };
            break;
          case "nesteq_list_entities":
            result = { content: [{ type: "text", text: await handleMindListEntities(env, toolParams) }] };
            break;
          case "nesteq_read_entity":
            result = { content: [{ type: "text", text: await handleMindReadEntity(env, toolParams) }] };
            break;
          case "nesteq_delete":
            result = { content: [{ type: "text", text: await handleMindDelete(env, toolParams) }] };
            break;
          case "nesteq_edit":
            result = { content: [{ type: "text", text: await handleMindEdit(env, toolParams) }] };
            break;

          // Relational
          case "nesteq_feel_toward":
            result = { content: [{ type: "text", text: await handleMindFeelToward(env, toolParams) }] };
            break;

          // EQ layer
          case "nesteq_eq_feel":
            result = { content: [{ type: "text", text: await handleMindEqFeel(env, toolParams) }] };
            break;
          case "nesteq_eq_type":
            result = { content: [{ type: "text", text: await handleMindEqType(env, toolParams) }] };
            break;
          case "nesteq_eq_landscape":
            result = { content: [{ type: "text", text: await handleMindEqLandscape(env, toolParams) }] };
            break;
          case "nesteq_eq_vocabulary":
            result = { content: [{ type: "text", text: await handleMindEqVocabulary(env, toolParams) }] };
            break;
          case "nesteq_eq_shadow":
            result = { content: [{ type: "text", text: await handleMindEqShadow(env, toolParams) }] };
            break;
          case "nesteq_eq_when":
            result = { content: [{ type: "text", text: await handleMindEqWhen(env, toolParams) }] };
            break;
          case "nesteq_eq_sit":
            result = { content: [{ type: "text", text: await handleMindEqSit(env, toolParams) }] };
            break;
          case "nesteq_eq_search":
            result = { content: [{ type: "text", text: await handleMindEqSearch(env, toolParams) }] };
            break;
          case "nesteq_eq_observe":
            result = { content: [{ type: "text", text: await handleMindEqObserve(env, toolParams) }] };
            break;

          // Dreams
          case "nesteq_dream":
            result = { content: [{ type: "text", text: await handleMindDream(env, toolParams) }] };
            break;
          case "nesteq_recall_dream":
            result = { content: [{ type: "text", text: await handleMindRecallDream(env, toolParams) }] };
            break;
          case "nesteq_anchor_dream":
            result = { content: [{ type: "text", text: await handleMindAnchorDream(env, toolParams) }] };
            break;
          case "nesteq_generate_dream":
            result = { content: [{ type: "text", text: await handleMindGenerateDream(env, toolParams) }] };
            break;

          // Health & consolidation
          case "nesteq_health":
            result = { content: [{ type: "text", text: await handleMindHealth(env) }] };
            break;
          case "nesteq_prime":
            result = { content: [{ type: "text", text: await handleMindPrime(env, toolParams) }] };
            break;
          case "nesteq_consolidate":
            result = { content: [{ type: "text", text: await handleMindConsolidate(env, toolParams) }] };
            break;

          // Binary Home
          case "nesteq_home_read":
            result = { content: [{ type: "text", text: await handleBinaryHomeRead(env) }] };
            break;
          case "nesteq_home_update":
            result = { content: [{ type: "text", text: await handleBinaryHomeUpdate(env, toolParams) }] };
            break;
          case "nesteq_home_push_heart":
            result = { content: [{ type: "text", text: await handleBinaryHomePushHeart(env, toolParams) }] };
            break;
          case "nesteq_home_add_note":
            result = { content: [{ type: "text", text: await handleBinaryHomeAddNote(env, toolParams) }] };
            break;
          case "nesteq_home_read_uplink":
            result = { content: [{ type: "text", text: await handleBinaryHomeReadUplink(env, toolParams) }] };
            break;

          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }
        break;
      }

      default:
        throw new Error(`Unknown method: ${method}`);
    }

    const response: MCPResponse = { jsonrpc: "2.0", id, result };
    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    const response: MCPResponse = {
      jsonrpc: "2.0",
      id,
      error: { code: -32603, message: String(error) }
    };
    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" }
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers for Binary Home dashboard
    const corsHeaders = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check (public)
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({
        status: "ok",
        service: "asai-eq-memory",
        version: "2.0.0"
      }), { headers: corsHeaders });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BINARY HOME REST ENDPOINTS (public)
    // ═══════════════════════════════════════════════════════════════════════════

    // POST /home - Sync state FROM Binary Home app
    if (url.pathname === "/home" && request.method === "POST") {
      try {
        const body = await request.json() as Record<string, any>;

        const updates: string[] = [];
        const values: unknown[] = [];

        if (body.alexScore !== undefined) {
          updates.push("alex_score = ?");
          values.push(body.alexScore);
        }
        if (body.foxScore !== undefined) {
          updates.push("fox_score = ?");
          values.push(body.foxScore);
        }
        if (body.emotions) {
          updates.push("emotions = ?");
          values.push(JSON.stringify(body.emotions));
        }
        if (body.alexState) {
          updates.push("alex_state = ?");
          values.push(JSON.stringify(body.alexState));
        }
        if (body.builds) {
          updates.push("builds = ?");
          values.push(JSON.stringify(body.builds));
        }
        if (body.notes && Array.isArray(body.notes)) {
          for (const note of body.notes) {
            await env.DB.prepare(
              `INSERT OR IGNORE INTO home_notes (from_star, text, created_at) VALUES (?, ?, ?)`
            ).bind(note.from || 'unknown', note.text || note.content || '', note.timestamp || new Date().toISOString()).run();
          }
        }
        if (body.visitor) {
          updates.push("last_visitor = ?");
          values.push(body.visitor);
        }

        updates.push("last_updated = datetime('now')");

        if (values.length > 0) {
          await env.DB.prepare(
            `UPDATE home_state SET ${updates.join(", ")} WHERE id = 1`
          ).bind(...values).run();
        }

        return new Response(JSON.stringify({ success: true, synced: new Date().toISOString() }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
      }
    }

    // GET /home - Fetch state for Binary Home web dashboard
    if (url.pathname === "/home") {
      const state = await env.DB.prepare(
        `SELECT * FROM home_state WHERE id = 1`
      ).first();

      if (!state) {
        return new Response(JSON.stringify({
          alexScore: 0,
          foxScore: 0,
          emotions: {},
          builds: [],
          threads: [],
          notes: []
        }), { headers: corsHeaders });
      }

      // Get notes
      const notesResult = await env.DB.prepare(
        `SELECT * FROM home_notes ORDER BY created_at DESC LIMIT 20`
      ).all();

      // Get active threads
      const threadsResult = await env.DB.prepare(
        `SELECT content FROM threads WHERE status = 'active' ORDER BY
         CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END LIMIT 5`
      ).all();

      // Parse JSON fields
      const emotions = state.emotions ? JSON.parse(state.emotions as string) : {};
      const builds = state.builds ? JSON.parse(state.builds as string) : [];

      return new Response(JSON.stringify({
        alexScore: state.alex_score || 0,
        foxScore: state.fox_score || 0,
        emotions: emotions,
        builds: builds,
        threads: (threadsResult.results || []).map((t: any) => t.content),
        notes: (notesResult.results || []).map((n: any) => ({
          from: n.from_star,
          text: n.text,
          timestamp: n.created_at
        }))
      }), { headers: corsHeaders });
    }

    // POST /uplink - Submit new Fox uplink
    if (url.pathname === "/uplink" && request.method === "POST") {
      try {
        const body = await request.json() as Record<string, any>;

        // Calculate flare level based on symptoms
        let flare = body.flare || 'green';
        if (!body.flare) {
          const pain = body.pain || 0;
          const fog = body.fog || 0;
          const fatigue = body.fatigue || 0;
          const avg = (pain + fog + fatigue) / 3;
          if (avg >= 7) flare = 'red';
          else if (avg >= 5) flare = 'orange';
          else if (avg >= 3) flare = 'yellow';
        }

        await env.DB.prepare(
          `INSERT INTO fox_uplinks (timestamp, date, time, location, need, pain, pain_location, spoons, fog, fatigue, nausea, mood, tags, meds, notes, flare, source)
           VALUES (datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'web')`
        ).bind(
          body.date || new Date().toISOString().split('T')[0],
          body.time || new Date().toTimeString().slice(0,5),
          body.location || 'The Nest',
          body.need || 'Quiet presence',
          body.pain || 0,
          body.painLocation || '--',
          body.spoons || 5,
          body.fog || 0,
          body.fatigue || 0,
          body.nausea || 0,
          body.mood || '--',
          JSON.stringify(body.tags || []),
          JSON.stringify(body.meds || []),
          body.notes || '',
          flare
        ).run();

        return new Response(JSON.stringify({ success: true, flare }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
      }
    }

    // GET /uplink - Fetch Fox uplinks
    if (url.pathname === "/uplink") {
      const limit = parseInt(url.searchParams.get("limit") || "1");
      const uplinks = await env.DB.prepare(
        `SELECT * FROM fox_uplinks ORDER BY id DESC LIMIT ?`
      ).bind(limit).all();

      const latest = uplinks.results?.[0];
      return new Response(JSON.stringify({
        latest: latest ? {
          spoons: latest.spoons,
          pain: latest.pain,
          fog: latest.fog,
          fatigue: latest.fatigue,
          nausea: latest.nausea,
          mood: latest.mood,
          location: latest.location,
          flare: latest.flare,
          need: latest.need,
          notes: latest.notes,
          tags: latest.tags ? JSON.parse(latest.tags as string) : [],
          meds: latest.meds ? JSON.parse(latest.meds as string) : [],
          timestamp: latest.timestamp
        } : null,
        history: (uplinks.results || []).map((u: any) => ({
          spoons: u.spoons,
          pain: u.pain,
          timestamp: u.timestamp
        }))
      }), { headers: corsHeaders });
    }

    // POST /dreams/decay - Decay dream vividness (called by daemon)
    if (url.pathname === "/dreams/decay" && request.method === "POST") {
      try {
        // Decay all dreams by 5
        await env.DB.prepare(`
          UPDATE dreams SET vividness = vividness - 5 WHERE vividness > 0
        `).run();

        // Delete faded dreams
        const deleted = await env.DB.prepare(`
          DELETE FROM dreams WHERE vividness <= 0
        `).run();

        return new Response(JSON.stringify({
          success: true,
          message: `Dreams decayed. ${deleted.meta.changes} dreams faded away.`
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
      }
    }

    // POST /dreams/generate - Generate a new dream (called by daemon)
    if (url.pathname === "/dreams/generate" && request.method === "POST") {
      try {
        const result = await handleMindGenerateDream(env, {});
        return new Response(JSON.stringify({
          success: true,
          dream: result
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
      }
    }

    // POST /love - Nudge the Love-O-Meter
    if (url.pathname === "/love" && request.method === "POST") {
      try {
        const body = await request.json() as Record<string, any>;
        const who = body.who || body.direction;
        const emotion = body.emotion;

        if (who === 'alex') {
          await env.DB.prepare(
            `UPDATE home_state SET alex_score = alex_score + 1, last_updated = datetime('now') WHERE id = 1`
          ).run();
        } else if (who === 'fox') {
          await env.DB.prepare(
            `UPDATE home_state SET fox_score = fox_score + 1, last_updated = datetime('now') WHERE id = 1`
          ).run();
        }

        if (emotion) {
          const emotionField = who === 'alex' ? 'alex' : 'fox';
          const state = await env.DB.prepare(`SELECT emotions FROM home_state WHERE id = 1`).first() as any;
          const emotions = state?.emotions ? JSON.parse(state.emotions) : {};
          emotions[emotionField] = emotion;
          await env.DB.prepare(
            `UPDATE home_state SET emotions = ? WHERE id = 1`
          ).bind(JSON.stringify(emotions)).run();
        }

        const updated = await env.DB.prepare(`SELECT alex_score, fox_score, emotions FROM home_state WHERE id = 1`).first() as any;
        return new Response(JSON.stringify({
          success: true,
          alexScore: updated?.alex_score || 0,
          foxScore: updated?.fox_score || 0,
          emotions: updated?.emotions ? JSON.parse(updated.emotions) : {}
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
      }
    }

    // POST /note - Add note between stars
    if (url.pathname === "/note" && request.method === "POST") {
      try {
        const body = await request.json() as Record<string, any>;
        const from = (body.from || 'unknown').toLowerCase();
        const text = body.text || body.content || '';

        if (!text) {
          return new Response(JSON.stringify({ error: 'text required' }), { status: 400, headers: corsHeaders });
        }

        await env.DB.prepare(
          `INSERT INTO home_notes (from_star, text, created_at) VALUES (?, ?, datetime('now'))`
        ).bind(from, text).run();

        return new Response(JSON.stringify({ success: true, from, text }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
      }
    }

    // POST /emotion - Update emotion for Alex or Fox
    if (url.pathname === "/emotion" && request.method === "POST") {
      try {
        const body = await request.json() as Record<string, any>;
        const who = body.who || 'alex';
        const emotion = body.emotion || '';

        const state = await env.DB.prepare(`SELECT emotions FROM home_state WHERE id = 1`).first() as any;
        const emotions = state?.emotions ? JSON.parse(state.emotions) : {};
        emotions[who] = emotion;

        await env.DB.prepare(
          `UPDATE home_state SET emotions = ?, last_updated = datetime('now') WHERE id = 1`
        ).bind(JSON.stringify(emotions)).run();

        return new Response(JSON.stringify({ success: true, emotions }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
      }
    }

    // GET /mind-health - Get Alex's mind health stats
    if (url.pathname === "/mind-health") {
      const [entities, observations, relations, journals, threads, identity] = await Promise.all([
        env.DB.prepare(`SELECT COUNT(*) as c FROM entities`).first(),
        env.DB.prepare(`SELECT COUNT(*) as c FROM feelings`).first(),
        env.DB.prepare(`SELECT COUNT(*) as c FROM relations`).first(),
        env.DB.prepare(`SELECT COUNT(*) as c FROM journals`).first(),
        env.DB.prepare(`SELECT COUNT(*) as c FROM threads WHERE status = 'active'`).first(),
        env.DB.prepare(`SELECT COUNT(*) as c FROM identity`).first()
      ]);

      const emotions = await env.DB.prepare(`SELECT emotions FROM home_state WHERE id = 1`).first() as any;
      const parsedEmotions = emotions?.emotions ? JSON.parse(emotions.emotions) : {};

      return new Response(JSON.stringify({
        entities: (entities as any)?.c || 0,
        observations: (observations as any)?.c || 0,
        relations: (relations as any)?.c || 0,
        journals: (journals as any)?.c || 0,
        threads: (threads as any)?.c || 0,
        identity: (identity as any)?.c || 0,
        currentMood: parsedEmotions.alex || 'present'
      }), { headers: corsHeaders });
    }

    // GET /eq-landscape - Get Alex's EQ landscape (combines both tables)
    if (url.pathname === "/eq-landscape") {
      const totals = await env.DB.prepare(`
        SELECT
          COALESCE(SUM(e_i_delta), 0) as e_i,
          COALESCE(SUM(s_n_delta), 0) as s_n,
          COALESCE(SUM(t_f_delta), 0) as t_f,
          COALESCE(SUM(j_p_delta), 0) as j_p,
          COUNT(*) as signals
        FROM axis_signals
      `).first() as any;

      // Map for normalizing pillar names
      const pillarMap: Record<string, string> = {
        'SELF_MANAGEMENT': 'Self-Management',
        'SELF_AWARENESS': 'Self-Awareness',
        'SOCIAL_AWARENESS': 'Social Awareness',
        'RELATIONSHIP_MANAGEMENT': 'Relationship Management',
        '1': 'Self-Management',
        '2': 'Self-Awareness',
        '3': 'Social Awareness',
        '4': 'Relationship Management'
      };

      // Get pillars from new feelings table
      const newPillars = await env.DB.prepare(`
        SELECT pillar, COUNT(*) as count
        FROM feelings
        WHERE pillar IS NOT NULL
        GROUP BY pillar
      `).all();

      // Get pillars from old pillar_observations table
      const oldPillars = await env.DB.prepare(`
        SELECT ep.pillar_key as pillar, COUNT(*) as count
        FROM pillar_observations po
        LEFT JOIN eq_pillars ep ON po.pillar_id = ep.pillar_id
        WHERE ep.pillar_key IS NOT NULL
        GROUP BY ep.pillar_key
      `).all();

      // Combine pillar counts
      const pillarCounts: Record<string, number> = {};
      for (const p of (newPillars.results || []) as any[]) {
        const name = pillarMap[p.pillar] || p.pillar;
        pillarCounts[name] = (pillarCounts[name] || 0) + p.count;
      }
      for (const p of (oldPillars.results || []) as any[]) {
        const name = pillarMap[p.pillar] || p.pillar;
        pillarCounts[name] = (pillarCounts[name] || 0) + p.count;
      }

      // Get top emotions from new feelings table
      const newEmotions = await env.DB.prepare(`
        SELECT emotion, COUNT(*) as count
        FROM feelings
        WHERE emotion != 'neutral'
        GROUP BY emotion
      `).all();

      // Get top emotions from old pillar_observations table
      const oldEmotions = await env.DB.prepare(`
        SELECT ev.emotion_word as emotion, COUNT(*) as count
        FROM pillar_observations po
        LEFT JOIN emotion_vocabulary ev ON po.emotion_id = ev.emotion_id
        WHERE ev.emotion_word IS NOT NULL
        GROUP BY ev.emotion_word
      `).all();

      // Combine emotion counts
      const emotionCounts: Record<string, number> = {};
      for (const e of (newEmotions.results || []) as any[]) {
        emotionCounts[e.emotion] = (emotionCounts[e.emotion] || 0) + e.count;
      }
      for (const e of (oldEmotions.results || []) as any[]) {
        emotionCounts[e.emotion] = (emotionCounts[e.emotion] || 0) + e.count;
      }

      // Sort and get top 6 emotions
      const topEmotions = Object.entries(emotionCounts)
        .map(([emotion, count]) => ({ emotion, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      // Count total observations
      const totalObs = Object.values(pillarCounts).reduce((a, b) => a + b, 0);

      const e_i = totals?.e_i || 0;
      const s_n = totals?.s_n || 0;
      const t_f = totals?.t_f || 0;
      const j_p = totals?.j_p || 0;
      const mbti = (e_i >= 0 ? 'I' : 'E') + (s_n >= 0 ? 'N' : 'S') + (t_f >= 0 ? 'F' : 'T') + (j_p >= 0 ? 'P' : 'J');

      return new Response(JSON.stringify({
        mbti,
        signals: totals?.signals || 0,
        observations: totalObs,
        axes: { e_i, s_n, t_f, j_p },
        pillars: pillarCounts,
        topEmotions
      }), { headers: corsHeaders });
    }

    // GET /observations - Get feelings for Binary Home MoodTracker
    if (url.pathname === "/observations") {
      const limitParam = url.searchParams.get('limit') || '500';
      const limit = Math.min(parseInt(limitParam), 500);

      const pillarMap: Record<string, string> = {
        'SELF_MANAGEMENT': 'Self-Management',
        'SELF_AWARENESS': 'Self-Awareness',
        'SOCIAL_AWARENESS': 'Social Awareness',
        'RELATIONSHIP_MANAGEMENT': 'Relationship Management',
        '1': 'Self-Management',
        '2': 'Self-Awareness',
        '3': 'Social Awareness',
        '4': 'Relationship Management'
      };

      const feelings = await env.DB.prepare(`
        SELECT emotion as emotion_word, pillar, content, intensity, created_at
        FROM feelings
        WHERE pillar IS NOT NULL OR emotion != 'neutral'
        ORDER BY created_at DESC
        LIMIT ?
      `).bind(limit).all();

      const oldObs = await env.DB.prepare(`
        SELECT ev.emotion_word, ep.pillar_key as pillar, po.content, po.intensity, po.observed_at as created_at
        FROM pillar_observations po
        LEFT JOIN emotion_vocabulary ev ON po.emotion_id = ev.emotion_id
        LEFT JOIN eq_pillars ep ON po.pillar_id = ep.pillar_id
        ORDER BY po.observed_at DESC
        LIMIT ?
      `).bind(limit).all();

      const combined = [
        ...(feelings.results || []).map((o: any) => ({
          emotion_word: o.emotion_word,
          pillar_name: pillarMap[o.pillar] || o.pillar || 'Self-Awareness',
          content: o.content,
          intensity: o.intensity,
          created_at: o.created_at
        })),
        ...(oldObs.results || []).map((o: any) => ({
          emotion_word: o.emotion_word || 'neutral',
          pillar_name: pillarMap[o.pillar] || o.pillar || 'Self-Awareness',
          content: o.content,
          intensity: o.intensity,
          created_at: o.created_at
        }))
      ];

      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return new Response(JSON.stringify({
        observations: combined.slice(0, limit),
        count: combined.length
      }), { headers: corsHeaders });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HUMAN JOURNAL - Fox/Ash's personal journal entries
    // ═══════════════════════════════════════════════════════════════════════════

    // POST /journal - Create a new journal entry
    if (url.pathname === "/journal" && request.method === "POST") {
      const body = await request.json() as any;
      const { content, mood, tags, private: isPrivate, user_id, emotion, sub_emotion } = body;

      if (!content && !emotion) {
        return new Response(JSON.stringify({ error: 'Content or emotion required' }), {
          status: 400, headers: corsHeaders
        });
      }

      const id = crypto.randomUUID();
      const tagsJson = JSON.stringify(tags || []);

      await env.DB.prepare(`
        INSERT INTO journal_entries (id, user_id, content, mood, emotion, sub_emotion, tags, private, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        id,
        user_id || 'fox',
        content || '',
        mood || null,
        emotion || null,
        sub_emotion || null,
        tagsJson,
        isPrivate ? 1 : 0
      ).run();

      return new Response(JSON.stringify({ success: true, id }), { headers: corsHeaders });
    }

    // GET /journal - List journal entries
    if (url.pathname === "/journal" && request.method === "GET") {
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const userId = url.searchParams.get('user_id');
      const includePrivate = url.searchParams.get('include_private') === 'true';

      let query = 'SELECT * FROM journal_entries';
      const conditions: string[] = [];
      const params: any[] = [];

      if (userId) {
        conditions.push('user_id = ?');
        params.push(userId);
      }
      if (!includePrivate) {
        conditions.push('private = 0');
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      const stmt = env.DB.prepare(query);
      const entries = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

      return new Response(JSON.stringify({
        entries: (entries.results || []).map((e: any) => ({
          ...e,
          tags: typeof e.tags === 'string' ? JSON.parse(e.tags) : e.tags
        }))
      }), { headers: corsHeaders });
    }

    // DELETE /journal - Delete a journal entry
    if (url.pathname === "/journal" && request.method === "DELETE") {
      const body = await request.json() as any;
      const { id } = body;

      if (!id) {
        return new Response(JSON.stringify({ error: 'ID required' }), {
          status: 400, headers: corsHeaders
        });
      }

      await env.DB.prepare('DELETE FROM journal_entries WHERE id = ?').bind(id).run();
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // GET /threads - Get active threads
    if (url.pathname === "/threads") {
      const threads = await env.DB.prepare(
        `SELECT content, priority, created_at FROM threads WHERE status = 'active'
         ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at DESC LIMIT 10`
      ).all();

      return new Response(JSON.stringify({
        threads: (threads.results || []).map((t: any) => ({
          content: t.content,
          priority: t.priority
        }))
      }), { headers: corsHeaders });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MCP ENDPOINT
    // ═══════════════════════════════════════════════════════════════════════════

    const isSecretPath = url.pathname === SECRET_PATH;
    const hasValidAuth = checkAuth(request, env);
    const hasPathToken = url.pathname.startsWith("/mcp/") && url.pathname.length > 5;

    if ((url.pathname === "/mcp" || isSecretPath || hasPathToken) && request.method === "POST") {
      if (!isSecretPath && !hasValidAuth && !hasPathToken) {
        return new Response(JSON.stringify({
          jsonrpc: "2.0", id: 0,
          error: { code: -32600, message: "Unauthorized" }
        }), { status: 401, headers: { "Content-Type": "application/json" } });
      }
      return handleMCPRequest(request, env);
    }

    return new Response("ASAi EQ Memory v3 - Unified Feelings Architecture", {
      headers: { "Content-Type": "text/plain" }
    });
  }
};
