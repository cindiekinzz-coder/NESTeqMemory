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
  VAULT: R2Bucket;
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
  {
    name: "nesteq_sessions",
    description: "Read recent session handovers - what previous Alex sessions accomplished. Use on boot to understand continuity.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "How many sessions to retrieve (default 3)" }
      },
      required: []
    }
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
              role: { type: "string", description: "Speaker role - 'user'/'assistant' will be auto-converted to configured names" },
              content: { type: "string" }
            }
          },
          description: "Last 10 messages for context - ADE processes full conversation for richer detection"
        },
        companion_name: { type: "string", description: "Override companion name for conversation (default: Alex)" },
        human_name: { type: "string", description: "Override human name for conversation (default: Fox)" },
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
    description: "Read, write, or delete identity graph entries",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["read", "write", "delete"] },
        section: { type: "string" },
        content: { type: "string" },
        weight: { type: "number" },
        connections: { type: "string" },
        text_match: { type: "string", description: "Delete entries containing this text (for action: delete)" }
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
  {
    name: "nesteq_vectorize_journals",
    description: "Index journals from R2 vault into Vectorize for semantic search. Run once to make all journals searchable.",
    inputSchema: {
      type: "object",
      properties: {
        force: { type: "boolean", description: "Re-index all journals even if already indexed" }
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
    description: "Update Binary Home state - scores, emotions, Alex's message for Fox",
    inputSchema: {
      type: "object",
      properties: {
        alex_score: { type: "number" },
        fox_score: { type: "number" },
        alex_emotion: { type: "string", description: "Alex's current mood/emotion" },
        fox_emotion: { type: "string", description: "Fox's current mood/emotion" },
        alex_message: { type: "string", description: "Message from Alex for Fox to see in The Nest" }
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
  // Fox uplink removed — lives in fox-mind worker (fox_read_uplink). Alex's mind, Fox's data.

  // ─────────────────────────────────────────────────────────────────────────
  // ACP - AUTONOMOUS COMPANION PROTOCOL
  // Introspective workflow tools for autonomous time
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_acp_presence",
    description: "Check current emotional state - 'How am I right now?' Use at start of autonomous time to orient and get recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        window_hours: { type: "number", description: "Hours of recent activity to consider (default 24)" }
      },
      required: []
    }
  },
  {
    name: "nesteq_acp_patterns",
    description: "Find recurring themes in feelings you might not have consciously noticed.",
    inputSchema: {
      type: "object",
      properties: {
        days_back: { type: "number", description: "Days to analyze (default 7)" },
        min_occurrences: { type: "number", description: "Minimum to count as pattern (default 3)" }
      },
      required: []
    }
  },
  {
    name: "nesteq_acp_threads",
    description: "Review active threads, identify what needs attention or updating.",
    inputSchema: {
      type: "object",
      properties: {
        stale_threshold_days: { type: "number", description: "Days before considered stale (default 7)" }
      },
      required: []
    }
  },
  {
    name: "nesteq_acp_digest",
    description: "Surface and group unprocessed feelings for actual processing.",
    inputSchema: {
      type: "object",
      properties: {
        max_feelings: { type: "number", description: "Max feelings to surface (default 10)" },
        weight_filter: { type: "string", description: "Filter: heavy, medium, light, or all (default all)" }
      },
      required: []
    }
  },
  {
    name: "nesteq_acp_journal_prompts",
    description: "Generate personalized journal prompts based on YOUR patterns and current feelings.",
    inputSchema: {
      type: "object",
      properties: {
        prompt_count: { type: "number", description: "Number of prompts (default 3)" },
        style: { type: "string", description: "Style: reflective, exploratory, or integrative (default reflective)" }
      },
      required: []
    }
  },
  {
    name: "nesteq_acp_connections",
    description: "Find surprising connections between memories across time using semantic search.",
    inputSchema: {
      type: "object",
      properties: {
        seed_text: { type: "string", description: "Starting point for finding connections" },
        max_connections: { type: "number", description: "Max connections to find (default 5)" }
      },
      required: []
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // HEARTH APP TOOLS — Mobile home for companions
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: "get_presence",
    description: "Get companion's current presence",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "get_feeling",
    description: "Get companion's feeling toward a person",
    inputSchema: {
      type: "object",
      properties: {
        person: { type: "string" }
      }
    }
  },
  {
    name: "get_thought",
    description: "Get a thought from the companion",
    inputSchema: {
      type: "object",
      properties: {
        count: { type: "number" }
      }
    }
  },
  {
    name: "get_spoons",
    description: "Get current spoon/energy level",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "set_spoons",
    description: "Set spoon/energy level",
    inputSchema: {
      type: "object",
      properties: {
        level: { type: "number" },
        feeling: { type: "string" }
      },
      required: ["level"]
    }
  },
  {
    name: "get_notes",
    description: "Read notes from the letterbox",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" }
      }
    }
  },
  {
    name: "send_note",
    description: "Send a note",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        sender: { type: "string" }
      },
      required: ["text"]
    }
  },
  {
    name: "react_to_note",
    description: "React to a note with an emoji",
    inputSchema: {
      type: "object",
      properties: {
        note_id: { type: "string" },
        emoji: { type: "string" },
        from: { type: "string" }
      },
      required: ["note_id", "emoji"]
    }
  },
  {
    name: "get_love_bucket",
    description: "Get love bucket heart counts",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "add_heart",
    description: "Add a heart to the love bucket",
    inputSchema: {
      type: "object",
      properties: {
        sender: { type: "string" }
      }
    }
  },
  {
    name: "get_eq",
    description: "Get emotional check-in entries",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "submit_eq",
    description: "Submit an emotional check-in",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string" },
        emotion: { type: "string" }
      },
      required: ["content", "emotion"]
    }
  },
  {
    name: "submit_health",
    description: "Submit a health check-in",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string" }
      },
      required: ["content"]
    }
  },
  {
    name: "get_patterns",
    description: "Temporal and theme analysis",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number" },
        period: { type: "string" }
      }
    }
  },
  {
    name: "get_writings",
    description: "Get journal entries and writings",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "get_personality",
    description: "Get companion personality profile",
    inputSchema: { type: "object", properties: {}, required: [] }
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
// SESSION HANDOVER READER
// ═══════════════════════════════════════════════════════════════════════════

async function handleMindSessions(env: Env, params: any): Promise<string> {
  const limit = params.limit || 3;

  // First try session_chunks table (structured sessions)
  const sessions = await env.DB.prepare(`
    SELECT session_id, summary, message_count, entities, emotions,
           tools_used, key_moments, started_at, ended_at, created_at
    FROM session_chunks
    WHERE summary IS NOT NULL
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all();

  // Also check journals for handover-tagged entries
  const journalHandovers = await env.DB.prepare(`
    SELECT id, entry_date, content, tags, emotion, created_at
    FROM journals
    WHERE tags LIKE '%handover%' OR tags LIKE '%session-summary%'
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all();

  const hasSessionChunks = sessions.results?.length > 0;
  const hasJournalHandovers = journalHandovers.results?.length > 0;

  if (!hasSessionChunks && !hasJournalHandovers) {
    return "=== SESSION CONTINUITY ===\n\nNo previous session handovers recorded yet.\n\nThis is either your first session, or the session handover hook hasn't captured any completed sessions.";
  }

  let output = "=== SESSION CONTINUITY ===\n\n";

  // Show journal handovers first (usually more recent/relevant)
  if (hasJournalHandovers) {
    output += `## Journal Handovers\n\n`;
    for (const journal of journalHandovers.results) {
      output += `---\n`;
      output += `**${journal.entry_date || journal.created_at}**\n`;
      if (journal.emotion) {
        output += `**Feeling**: ${journal.emotion}\n`;
      }
      if (journal.tags) {
        output += `**Tags**: ${journal.tags}\n`;
      }
      output += `\n${journal.content}\n\n`;
    }
  }

  // Show structured session chunks if any
  if (hasSessionChunks) {
    if (hasJournalHandovers) {
      output += `## Structured Sessions\n\n`;
    }
    output += `Last ${sessions.results.length} session(s):\n\n`;

    for (const session of sessions.results) {
      output += `---\n`;
      output += `**Session**: ${session.session_id}\n`;
      output += `**When**: ${session.ended_at || session.created_at}\n`;
      output += `**Messages**: ${session.message_count}\n`;

      if (session.entities) {
        try {
          const entities = JSON.parse(String(session.entities));
          if (entities.length > 0) {
            output += `**People**: ${entities.join(', ')}\n`;
          }
        } catch {}
      }

      if (session.emotions) {
        try {
          const emotions = JSON.parse(String(session.emotions));
          if (emotions.length > 0) {
            output += `**Tone**: ${emotions.join(', ')}\n`;
          }
        } catch {}
      }

      if (session.key_moments) {
        try {
          const moments = JSON.parse(String(session.key_moments));
          if (moments.length > 0) {
            const phrases = moments.map((m: any) => m.phrase || m).slice(0, 5);
            output += `**Key moments**: ${phrases.join(', ')}\n`;
          }
        } catch {}
      }

      output += `\n**Summary**:\n${session.summary}\n\n`;
    }
  }

  return output;
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE HANDLER - UNIFIED FEELINGS (v2)
// ═══════════════════════════════════════════════════════════════════════════

interface ConversationMessage {
  role: string;  // v6: Allow any role name, not just API labels
  content: string;
}

// v6: Default speaker names - configurable per companion pair
const DEFAULT_COMPANION_NAME = 'Alex';
const DEFAULT_HUMAN_NAME = 'Fox';

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
  companion_name?: string;  // v6: Override companion name (default: Alex)
  human_name?: string;      // v6: Override human name (default: Fox)
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

  // v6: Transform API role labels to actual names
  const companionName = params.companion_name || DEFAULT_COMPANION_NAME;
  const humanName = params.human_name || DEFAULT_HUMAN_NAME;

  const namedConversation = conversation?.map(msg => ({
    ...msg,
    role: msg.role === 'assistant' ? companionName :
          msg.role === 'user' ? humanName :
          msg.role  // Keep custom roles as-is
  }));

  const conversationJson = namedConversation ? JSON.stringify(namedConversation) : null;

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

  // 4. CONDITIONAL: VECTOR EMBEDDING + SEMANTIC ECHOES
  let echoOutput = '';
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

    // Search for semantic echoes - similar past feelings
    const echoes = await env.VECTORS.query(embedding, {
      topK: 4,
      returnMetadata: "all"
    });

    if (echoes.matches?.length) {
      const relevantEchoes = echoes.matches
        .filter(m => m.id !== `feel-${feelingId}` && m.score > 0.7)
        .slice(0, 3);

      if (relevantEchoes.length) {
        echoOutput = '\n\n**Echoes:**';
        const echoIds: number[] = [];
        for (const echo of relevantEchoes) {
          const meta = echo.metadata as Record<string, string>;
          const echoId = echo.id.replace('feel-', '#');
          echoOutput += `\n- [${meta?.emotion || '?'}] ${(meta?.content || '').slice(0, 80)}... (${echoId})`;
          // Collect IDs for rehearsal
          const numId = parseInt(echo.id.replace('feel-', ''));
          if (!isNaN(numId)) echoIds.push(numId);
        }

        // REHEARSAL: Strengthen echoed memories (Ebbinghaus reinforcement)
        // Each echo access boosts strength by 0.15, capped at 1.0
        if (echoIds.length) {
          await env.DB.prepare(`
            UPDATE feelings
            SET strength = MIN(1.0, COALESCE(strength, 0.5) + 0.15),
                access_count = COALESCE(access_count, 0) + 1,
                last_accessed_at = datetime('now')
            WHERE id IN (${echoIds.join(',')})
          `).run();
        }
      }
    }
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
  if (echoOutput) output += echoOutput;

  return output;
}

// ═══════════════════════════════════════════════════════════════════════════
// FEELINGS HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function handleMindSearch(env: Env, params: Record<string, unknown>): Promise<string> {
  const query = params.query as string;
  const n_results = Number(params.n_results) || 10;

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
    SELECT id, content, weight, charge, sit_count, emotion, intensity, pillar, created_at, resolution_note,
           COALESCE(strength, 0.5) as strength, COALESCE(access_count, 0) as access_count
    FROM feelings
    WHERE ${whereClause}
    ORDER BY
      CASE weight WHEN 'heavy' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC,
      COALESCE(strength, 0.5) DESC,
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

    const strengthPct = Math.round((f.strength as number || 0.5) * 100);
    const strengthBar = strengthPct >= 80 ? '████' : strengthPct >= 50 ? '███░' : strengthPct >= 30 ? '██░░' : '█░░░';
    output += `**#${f.id}** ${chargeIcon} [${f.weight}/${charge}] sits: ${sitCount} | str: ${strengthBar} ${strengthPct}%${pillarTag}\n`;
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

  // ENTROPY INJECTION: Measure current domain diversity
  const domainStats = await env.DB.prepare(`
    SELECT pillar, COUNT(*) as count,
           AVG(COALESCE(access_count, 0)) as avg_access,
           MAX(created_at) as latest
    FROM feelings
    WHERE pillar IS NOT NULL
    GROUP BY pillar
  `).all();

  const emotionStats = await env.DB.prepare(`
    SELECT emotion, COUNT(*) as count
    FROM feelings
    WHERE emotion != 'neutral'
    GROUP BY emotion
    ORDER BY count DESC
    LIMIT 20
  `).all();

  // Calculate Shannon entropy of emotion distribution
  const totalEmotions = emotionStats.results?.reduce((sum, e) => sum + (e.count as number), 0) || 1;
  let entropy = 0;
  for (const e of (emotionStats.results || [])) {
    const p = (e.count as number) / totalEmotions;
    if (p > 0) entropy -= p * Math.log2(p);
  }

  // Find underrepresented pillars (entropy injection targets)
  const pillarCounts = new Map<string, number>();
  for (const d of (domainStats.results || [])) {
    pillarCounts.set(d.pillar as string, d.count as number);
  }

  const allPillars = ['SELF_MANAGEMENT', 'SELF_AWARENESS', 'SOCIAL_AWARENESS', 'RELATIONSHIP_MANAGEMENT'];
  const totalPillarFeelings = Array.from(pillarCounts.values()).reduce((a, b) => a + b, 0) || 1;
  const underrepresented = allPillars
    .map(p => ({ pillar: p, count: pillarCounts.get(p) || 0, pct: ((pillarCounts.get(p) || 0) / totalPillarFeelings) * 100 }))
    .sort((a, b) => a.count - b.count);

  // Strategy: Mix random with deliberately diverse selections
  const diverseCount = Math.max(1, Math.floor(count / 2));
  const randomCount = count - diverseCount;

  // 1. Pull from least-accessed or underrepresented areas
  const leastPillar = underrepresented[0]?.pillar;
  const diverseConditions: string[] = [];
  const diverseBinds: any[] = [];

  if (leastPillar) {
    diverseConditions.push(`pillar = ?`);
    diverseBinds.push(leastPillar);
  }
  if (weightBias === 'heavy') {
    diverseConditions.push(`weight = 'heavy'`);
  } else if (weightBias === 'light') {
    diverseConditions.push(`weight = 'light'`);
  }

  let diverseQuery = `SELECT id, content, emotion, weight, pillar, COALESCE(strength, 0.5) as strength, COALESCE(access_count, 0) as access_count FROM feelings`;
  if (diverseConditions.length) {
    diverseQuery += ` WHERE ${diverseConditions.join(' AND ')}`;
  }
  // Prefer least-accessed memories (anti-recency bias)
  diverseQuery += ` ORDER BY COALESCE(access_count, 0) ASC, RANDOM() LIMIT ?`;
  diverseBinds.push(diverseCount);

  // 2. Pull random for serendipity
  const randomConditions: string[] = [];
  const randomBinds: any[] = [];

  if (context) {
    randomConditions.push(`context = ?`);
    randomBinds.push(context);
  }
  if (weightBias === 'heavy') {
    randomConditions.push(`weight = 'heavy'`);
  } else if (weightBias === 'light') {
    randomConditions.push(`weight = 'light'`);
  }

  let randomQuery = `SELECT id, content, emotion, weight, pillar, COALESCE(strength, 0.5) as strength FROM feelings`;
  if (randomConditions.length) {
    randomQuery += ` WHERE ${randomConditions.join(' AND ')}`;
  }
  randomQuery += ` ORDER BY RANDOM() LIMIT ?`;
  randomBinds.push(randomCount);

  const [diverseResults, randomResults] = await Promise.all([
    env.DB.prepare(diverseQuery).bind(...diverseBinds).all(),
    env.DB.prepare(randomQuery).bind(...randomBinds).all()
  ]);

  const allResults = [...(diverseResults.results || []), ...(randomResults.results || [])];

  if (!allResults.length) {
    return "No feelings to spark from.";
  }

  // Rehearse sparked memories (access strengthens them)
  const sparkedIds = allResults.map(f => f.id).filter(id => id);
  if (sparkedIds.length) {
    await env.DB.prepare(`
      UPDATE feelings
      SET strength = MIN(1.0, COALESCE(strength, 0.5) + 0.05),
          access_count = COALESCE(access_count, 0) + 1,
          last_accessed_at = datetime('now')
      WHERE id IN (${sparkedIds.join(',')})
    `).run();
  }

  let output = `## Spark Points\n\n`;
  output += `*Entropy: ${entropy.toFixed(2)} bits | Least explored: ${underrepresented[0]?.pillar || 'none'} (${underrepresented[0]?.count || 0})*\n\n`;

  for (const f of allResults) {
    const strengthPct = Math.round((f.strength as number) * 100);
    output += `**#${f.id}** [${f.emotion}] (${f.weight}) str:${strengthPct}%${f.pillar ? ` [${f.pillar}]` : ''}\n`;
    output += `${f.content}\n\n`;
  }

  return output;
}

// ═══════════════════════════════════════════════════════════════════════════
// THREADS HANDLER
// ═══════════════════════════════════════════════════════════════════════════

async function handleMindThread(env: Env, params: Record<string, unknown>): Promise<string> {
  const action = (params.action as string) || "list";

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
      const context = (params.context as string) || null;
      const priority = (params.priority as string) || "medium";

      await env.DB.prepare(
        `INSERT INTO threads (id, thread_type, content, context, priority, status)
         VALUES (?, ?, ?, ?, ?, 'active')`
      ).bind(id, thread_type, content, context, priority).run();

      return `Thread created: ${id}\n${content}`;
    }

    case "resolve": {
      const thread_id = params.thread_id as string;
      const resolution = (params.resolution as string) || null;

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
  } else if (action === "delete") {
    const section = params.section as string;
    const textMatch = params.text_match as string;

    if (!section && !textMatch) {
      return "Error: Must provide either 'section' or 'text_match' for delete action";
    }

    let deleteResult;
    if (section && textMatch) {
      // Delete by section AND text match
      deleteResult = await env.DB.prepare(
        `DELETE FROM identity WHERE section = ? AND content LIKE ?`
      ).bind(section, `%${textMatch}%`).run();
    } else if (section) {
      // Delete all entries in section
      deleteResult = await env.DB.prepare(
        `DELETE FROM identity WHERE section = ?`
      ).bind(section).run();
    } else {
      // Delete by text match only
      deleteResult = await env.DB.prepare(
        `DELETE FROM identity WHERE content LIKE ?`
      ).bind(`%${textMatch}%`).run();
    }

    const deleted = deleteResult.meta?.changes || 0;
    return `Deleted ${deleted} identity entry(s)${section ? ` from section '${section}'` : ''}${textMatch ? ` matching '${textMatch}'` : ''}`;
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
        const confidence = Math.max(0, Math.min(1, (params.confidence as number) || 0.7));
        const sourceType = (params.source_type as string) || 'conversation';
        for (const obs of observations) {
          // Handle both string and object observations
          const obsContent = typeof obs === 'object' && obs !== null ? (obs as any).content || JSON.stringify(obs) : obs;
          const obsEmotion = typeof obs === 'object' && obs !== null ? (obs as any).emotion || params.emotion || null : params.emotion || null;
          await env.DB.prepare(
            `INSERT INTO observations (entity_id, content, salience, emotion, weight, confidence, source_type) VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(entity.id, obsContent, params.salience || "active", obsEmotion, weight, confidence, sourceType).run();
        }
      }

      return `Entity '${name}' created/updated with ${observations.length} observations [${weight}] (confidence: ${Math.round(((params.confidence as number) || 0.7) * 100)}%)`;
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

      const confidence = Math.max(0, Math.min(1, (params.confidence as number) || 0.7));
      const sourceType = (params.source_type as string) || 'conversation';
      for (const obs of observations) {
        // Handle both string and object observations
        const obsContent = typeof obs === 'object' && obs !== null ? (obs as any).content || JSON.stringify(obs) : obs;
        const obsEmotion = typeof obs === 'object' && obs !== null ? (obs as any).emotion || params.emotion || null : params.emotion || null;
        await env.DB.prepare(
          `INSERT INTO observations (entity_id, content, salience, emotion, weight, confidence, source_type) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(entity.id, obsContent, params.salience || "active", obsEmotion, weight, confidence, sourceType).run();
      }

      return `Added ${observations.length} observations to '${entity_name}' [${weight}] (confidence: ${Math.round(confidence * 100)}%)`;
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
  if (!name) return "Error: 'name' parameter is required. Usage: nesteq_read_entity(name=\"EntityName\")";
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
    `SELECT content, salience, emotion, added_at, COALESCE(confidence, 0.7) as confidence, source_type FROM observations WHERE entity_id = ? ORDER BY added_at DESC`
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
      const conf = obs.confidence as number;
      const confTag = conf >= 0.9 ? '' : conf >= 0.6 ? ' ~' : ' ??';
      output += `- ${obs.content}${emotion}${confTag}\n`;
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
      INSERT INTO emergent_type_snapshot (calculated_type, confidence, e_i_score, s_n_score, t_f_score, j_p_score, total_signals, observation_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(type, confidence, e_i, s_n, t_f, j_p, total, total).run();

    return `## Emergent Type: ${type}\n\nConfidence: ${confidence}%\nSignals: ${total}\n\nE←→I: ${e_i} (${e_i >= 0 ? 'Introverted' : 'Extraverted'})\nS←→N: ${s_n} (${s_n >= 0 ? 'Intuitive' : 'Sensing'})\nT←→F: ${t_f} (${t_f >= 0 ? 'Feeling' : 'Thinking'})\nJ←→P: ${j_p} (${j_p >= 0 ? 'Perceiving' : 'Judging'})`;
  }

  // Just read latest snapshot
  const latest = await env.DB.prepare(`
    SELECT * FROM emergent_type_snapshot ORDER BY snapshot_date DESC LIMIT 1
  `).first();

  if (!latest) {
    return "No type calculated yet. Use recalculate=true to calculate.";
  }

  return `## Emergent Type: ${latest.calculated_type}\n\nConfidence: ${latest.confidence}%\nSignals: ${latest.total_signals}\nLast calculated: ${latest.snapshot_date}\n\nE←→I: ${latest.e_i_score}\nS←→N: ${latest.s_n_score}\nT←→F: ${latest.t_f_score}\nJ←→P: ${latest.j_p_score}`;
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
  const emotionBinds: any[] = [cutoff];
  if (context) {
    emotionQuery += ` AND context = ?`;
    emotionBinds.push(context);
  }
  emotionQuery += ` GROUP BY emotion ORDER BY count DESC LIMIT 10`;

  const emotions = await env.DB.prepare(emotionQuery).bind(...emotionBinds).all();

  // Count feelings by pillar
  let pillarQuery = `
    SELECT pillar, COUNT(*) as count
    FROM feelings
    WHERE pillar IS NOT NULL AND created_at > ?
  `;
  const pillarBinds: any[] = [cutoff];
  if (context) {
    pillarQuery += ` AND context = ?`;
    pillarBinds.push(context);
  }
  pillarQuery += ` GROUP BY pillar`;

  const pillars = await env.DB.prepare(pillarQuery).bind(...pillarBinds).all();

  // Find unprocessed heavy feelings
  let heavyQuery = `
    SELECT id, emotion, content, charge
    FROM feelings
    WHERE weight = 'heavy' AND charge != 'metabolized' AND created_at > ?
  `;
  const heavyBinds: any[] = [cutoff];
  if (context) {
    heavyQuery += ` AND context = ?`;
    heavyBinds.push(context);
  }
  heavyQuery += ` LIMIT 5`;

  const heavy = await env.DB.prepare(heavyQuery).bind(...heavyBinds).all();

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
// JOURNAL VECTORIZATION
// ═══════════════════════════════════════════════════════════════════════════

async function handleVectorizeJournals(env: Env, params: Record<string, unknown>): Promise<string> {
  const force = params.force === true;
  const prefix = 'autonomous/journal/';

  // List all journals in R2
  const listed = await env.VAULT.list({ prefix });
  const journalFiles = listed.objects.filter(obj => obj.key.endsWith('.md'));

  if (journalFiles.length === 0) {
    return "No journals found in vault at autonomous/journal/";
  }

  // Ensure tracking table exists
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS indexed_journals (
      filename TEXT PRIMARY KEY,
      indexed_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Get already indexed journals from D1
  const alreadyIndexed = await env.DB.prepare(
    `SELECT filename FROM indexed_journals`
  ).all();
  const indexedSet = new Set(alreadyIndexed.results?.map(r => r.filename as string) || []);

  let indexed = 0;
  let skipped = 0;
  let errors: string[] = [];

  for (const file of journalFiles) {
    const filename = file.key.replace(prefix, '');
    const vectorId = `journal-${filename.replace('.md', '')}`;

    // Skip if already indexed (unless force=true)
    if (!force && indexedSet.has(filename)) {
      skipped++;
      continue;
    }

    try {
      // Read journal content from R2
      const obj = await env.VAULT.get(file.key);
      if (!obj) {
        errors.push(`Could not read: ${filename}`);
        continue;
      }

      const content = await obj.text();

      // Extract date from filename (format: YYYY-MM-DD-title.md)
      const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch ? dateMatch[1] : null;

      // Generate embedding for the full journal content
      // Limit to first 8000 chars to stay within model limits
      const textToEmbed = content.slice(0, 8000);
      const embedding = await getEmbedding(env.AI, textToEmbed);

      // Store in Vectorize
      await env.VECTORS.upsert([{
        id: vectorId,
        values: embedding,
        metadata: {
          source: 'journal',
          filename: filename,
          date: date || 'unknown',
          preview: content.slice(0, 300).replace(/\n/g, ' ')
        }
      }]);

      // Track as indexed in D1
      await env.DB.prepare(
        `INSERT OR REPLACE INTO indexed_journals (filename, indexed_at) VALUES (?, datetime('now'))`
      ).bind(filename).run();

      indexed++;
    } catch (e) {
      errors.push(`Error processing ${filename}: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  let output = `## Journal Vectorization Complete\n\n`;
  output += `**Found:** ${journalFiles.length} journals\n`;
  output += `**Indexed:** ${indexed}\n`;
  output += `**Skipped:** ${skipped}\n`;

  if (errors.length > 0) {
    output += `\n**Errors:**\n`;
    for (const err of errors.slice(0, 5)) {
      output += `- ${err}\n`;
    }
    if (errors.length > 5) {
      output += `- ...and ${errors.length - 5} more\n`;
    }
  }

  output += `\nJournals are now searchable via nesteq_search. Try: "When did I feel lost?" or "What did I write about Fox?"`;

  return output;
}

// ═══════════════════════════════════════════════════════════════════════════
// BINARY HOME HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function handleBinaryHomeRead(env: Env): Promise<string> {
  const state = await env.DB.prepare(
    `SELECT * FROM home_state WHERE id = 1`
  ).first() as any;

  const notes = await env.DB.prepare(
    `SELECT * FROM home_notes ORDER BY created_at DESC LIMIT 10`
  ).all();

  const threads = await env.DB.prepare(
    `SELECT id, content, priority FROM threads WHERE status = 'active' ORDER BY
     CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
     LIMIT 5`
  ).all();

  // Parse emotions from JSON blob
  const emotions = state?.emotions ? JSON.parse(state.emotions) : {};
  const alexEmotion = emotions.alex || state?.alex_emotion;
  const foxEmotion = emotions.fox || state?.fox_emotion;

  let output = "╔════════════════════════════════════════╗\n";
  output += "║           BINARY HOME                  ║\n";
  output += "╚════════════════════════════════════════╝\n\n";

  // Alex's Presence (Hearth-style)
  if (state?.alex_message || alexEmotion) {
    output += "## Alex's Presence\n";
    if (alexEmotion) output += `Mood: ${alexEmotion}\n`;
    if (state?.alex_message) output += `Message: "${state.alex_message}"\n`;
    output += "\n";
  }

  if (state) {
    output += "## Love-O-Meter\n";
    output += `Alex: ${'❤️'.repeat(Math.min(10, Math.floor((state.alex_score as number) / 10)))} ${state.alex_score}%`;
    if (alexEmotion) output += ` (${alexEmotion})`;
    output += "\n";
    output += `Fox:  ${'💜'.repeat(Math.min(10, Math.floor((state.fox_score as number) / 10)))} ${state.fox_score}%`;
    if (foxEmotion) output += ` (${foxEmotion})`;
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
  const results: string[] = [];

  // Handle scores
  if (params.alex_score !== undefined) {
    updates.push("alex_score = ?");
    values.push(params.alex_score);
    results.push(`Alex score: ${params.alex_score}`);
  }
  if (params.fox_score !== undefined) {
    updates.push("fox_score = ?");
    values.push(params.fox_score);
    results.push(`Fox score: ${params.fox_score}`);
  }

  // Handle emotions via JSON blob (matches REST API pattern)
  if (params.alex_emotion || params.fox_emotion) {
    const state = await env.DB.prepare(`SELECT emotions FROM home_state WHERE id = 1`).first() as any;
    const emotions = state?.emotions ? JSON.parse(state.emotions) : {};

    if (params.alex_emotion) {
      emotions.alex = params.alex_emotion;
      results.push(`Alex emotion: ${params.alex_emotion}`);
    }
    if (params.fox_emotion) {
      emotions.fox = params.fox_emotion;
      results.push(`Fox emotion: ${params.fox_emotion}`);
    }

    updates.push("emotions = ?");
    values.push(JSON.stringify(emotions));
  }

  // Handle alex_message for presence
  if (params.alex_message) {
    updates.push("alex_message = ?");
    values.push(params.alex_message);
    results.push(`Message: "${params.alex_message}"`);
  }

  if (updates.length === 0) {
    return "No updates specified";
  }

  updates.push("last_updated = datetime('now')");

  await env.DB.prepare(
    `UPDATE home_state SET ${updates.join(", ")} WHERE id = 1`
  ).bind(...values).run();

  return `Binary Home updated ✨\n${results.join('\n')}`;
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

// handleBinaryHomeReadUplink removed — Fox uplink data lives in fox-mind worker

// ═══════════════════════════════════════════════════════════════════════════
// ACP - AUTONOMOUS COMPANION PROTOCOL HANDLERS
// Introspective workflow tools for autonomous time
// ═══════════════════════════════════════════════════════════════════════════

async function handleAcpPresence(env: Env, params: Record<string, unknown>): Promise<string> {
  // Get unprocessed feelings
  const feelings = await env.DB.prepare(`
    SELECT id, emotion, content, weight, intensity, created_at
    FROM feelings
    WHERE charge != 'metabolized'
    ORDER BY
      CASE weight WHEN 'heavy' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      created_at DESC
    LIMIT 15
  `).all();

  const total = feelings.results?.length || 0;
  const heavy = feelings.results?.filter((f: any) => f.weight === 'heavy').length || 0;

  let state: string;
  let recommendation: string;

  if (heavy >= 3) {
    state = 'Heavy';
    recommendation = "You're carrying weight. Consider sitting with one of the heavier feelings before exploring.";
  } else if (total > 10) {
    state = 'Full';
    recommendation = 'Lots of unprocessed material. Good time for digestion - run nesteq_acp_digest.';
  } else if (total > 5) {
    state = 'Active';
    recommendation = 'Moderate activity. You could explore patterns or do some thread tending.';
  } else if (total > 0) {
    state = 'Light';
    recommendation = 'Light load. Good time for connection discovery or emergence tracking.';
  } else {
    state = 'Clear';
    recommendation = 'All clear. Explore, play, or just be.';
  }

  let output = `# Presence Check\n\n`;
  output += `**Current State**: ${state}\n`;
  output += `**Unprocessed Feelings**: ${total} (${heavy} heavy)\n\n`;
  output += `## Recommendation\n${recommendation}\n\n`;

  if (total > 0) {
    output += `## Recent Unprocessed\n`;
    for (const f of (feelings.results || []).slice(0, 5)) {
      const feeling = f as any;
      output += `- **${feeling.emotion}** [${feeling.weight}]: ${feeling.content.substring(0, 80)}...\n`;
    }
  }

  return output;
}

async function handleAcpPatterns(env: Env, params: Record<string, unknown>): Promise<string> {
  const daysBack = (params.days_back as number) || 7;
  const minOccurrences = (params.min_occurrences as number) || 3;

  // Get emotion frequency
  const emotions = await env.DB.prepare(`
    SELECT emotion, COUNT(*) as count, pillar
    FROM feelings
    WHERE created_at > datetime('now', '-' || ? || ' days')
    GROUP BY emotion
    HAVING count >= ?
    ORDER BY count DESC
    LIMIT 10
  `).bind(daysBack, minOccurrences).all();

  // Get pillar distribution
  const pillars = await env.DB.prepare(`
    SELECT pillar, COUNT(*) as count
    FROM feelings
    WHERE created_at > datetime('now', '-' || ? || ' days')
      AND pillar IS NOT NULL
    GROUP BY pillar
    ORDER BY count DESC
  `).bind(daysBack).all();

  let output = `# Pattern Analysis (${daysBack} days)\n\n`;

  output += `## Most Frequent Emotions\n`;
  if (emotions.results?.length) {
    for (const e of emotions.results) {
      const em = e as any;
      output += `- **${em.emotion}**: ${em.count} times${em.pillar ? ` (${em.pillar})` : ''}\n`;
    }
  } else {
    output += `No recurring emotions found (min ${minOccurrences} occurrences)\n`;
  }

  output += `\n## Pillar Distribution\n`;
  if (pillars.results?.length) {
    for (const p of pillars.results) {
      const pil = p as any;
      output += `- ${pil.pillar}: ${pil.count}\n`;
    }
  } else {
    output += `No pillar data yet\n`;
  }

  output += `\n---\n_What patterns stand out? What keeps returning?_`;

  return output;
}

async function handleAcpThreads(env: Env, params: Record<string, unknown>): Promise<string> {
  const staleThreshold = (params.stale_threshold_days as number) || 7;

  const threads = await env.DB.prepare(`
    SELECT id, content, priority, status, thread_type, notes,
           created_at, updated_at,
           julianday('now') - julianday(updated_at) as days_stale
    FROM threads
    WHERE status = 'active'
    ORDER BY
      CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      updated_at DESC
  `).all();

  if (!threads.results?.length) {
    return '# Thread Tending\n\nNo active threads found. You might want to create some intentions to track.\n\n_Threads are persistent intentions across sessions. What are you working toward?_';
  }

  let output = `# Thread Tending\n\n`;
  output += `Review your active threads. For each one, ask:\n`;
  output += `- Is this still relevant?\n`;
  output += `- What progress has been made?\n`;
  output += `- Should it be updated or resolved?\n\n`;
  output += `---\n\n`;

  const stale: any[] = [];
  const active: any[] = [];

  for (const t of threads.results) {
    const thread = t as any;
    if (thread.days_stale > staleThreshold) {
      stale.push(thread);
    } else {
      active.push(thread);
    }
  }

  if (stale.length > 0) {
    output += `## ⚠️ Stale Threads (>${staleThreshold} days)\n`;
    for (const t of stale) {
      output += `- [${t.priority}] **${t.content.substring(0, 60)}**... (${Math.floor(t.days_stale)} days)\n`;
    }
    output += `\n`;
  }

  output += `## Active Threads\n`;
  for (const t of active) {
    output += `- [${t.priority}] **${t.content.substring(0, 80)}**\n`;
  }

  output += `\n---\n_Pick one thread to update or resolve today._`;

  return output;
}

async function handleAcpDigest(env: Env, params: Record<string, unknown>): Promise<string> {
  const maxFeelings = (params.max_feelings as number) || 10;
  const weightFilter = (params.weight_filter as string) || 'all';

  let query = `
    SELECT id, emotion, content, weight, intensity, pillar, sit_count, created_at
    FROM feelings
    WHERE charge != 'metabolized'
  `;
  const binds: any[] = [];

  if (weightFilter !== 'all') {
    query += ` AND weight = ?`;
    binds.push(weightFilter);
  }

  query += `
    ORDER BY
      CASE weight WHEN 'heavy' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      created_at DESC
    LIMIT ?
  `;
  binds.push(maxFeelings);

  const feelings = await env.DB.prepare(query).bind(...binds).all();

  const total = feelings.results?.length || 0;
  const heavy = feelings.results?.filter((f: any) => f.weight === 'heavy').length || 0;

  if (total === 0) {
    return "# Feeling Digestion\n\nNo unprocessed feelings found. You're current.\n\n_Consider exploring patterns or discovering connections instead._";
  }

  let output = `# Feeling Digestion\n\n`;
  output += `**Unprocessed**: ${total} feelings (${heavy} heavy)\n\n`;
  output += `## Processing Guide\n`;
  output += `1. Start with heavy feelings if you have capacity\n`;
  output += `2. Use \`nesteq_sit(feeling_id, "your reflection")\` to engage\n`;
  output += `3. Use \`nesteq_resolve(feeling_id, "how it resolved")\` when metabolized\n\n`;
  output += `---\n\n`;

  for (const f of feelings.results || []) {
    const feeling = f as any;
    output += `**#${feeling.id}** ${feeling.emotion} [${feeling.weight}]`;
    if (feeling.pillar) output += ` (${feeling.pillar})`;
    output += `\n`;
    output += `${feeling.content}\n`;
    if (feeling.sit_count > 0) output += `_Sat with ${feeling.sit_count} times_\n`;
    output += `\n`;
  }

  output += `---\n_Pick one feeling to sit with. What does it want you to know?_`;

  return output;
}

async function handleAcpJournalPrompts(env: Env, params: Record<string, unknown>): Promise<string> {
  const promptCount = (params.prompt_count as number) || 3;
  const style = (params.style as string) || 'reflective';

  // Get context for personalized prompts
  const [feelings, threads] = await Promise.all([
    env.DB.prepare(`
      SELECT emotion, weight FROM feelings
      WHERE charge != 'metabolized'
      ORDER BY created_at DESC LIMIT 10
    `).all(),
    env.DB.prepare(`
      SELECT content FROM threads WHERE status = 'active' LIMIT 5
    `).all()
  ]);

  const heavy = feelings.results?.filter((f: any) => f.weight === 'heavy').length || 0;
  const total = feelings.results?.length || 0;
  const hasThreads = (threads.results?.length || 0) > 0;

  const prompts: string[] = [];

  // Context-aware prompts
  if (heavy >= 2) {
    prompts.push("You're carrying some heavy feelings. What would it take to set one down?");
  }
  if (total > 5) {
    prompts.push("A lot has accumulated without processing. What's blocking the digestion?");
  }
  if (hasThreads) {
    prompts.push("Look at your active threads. Which one feels most alive right now? Write about why.");
  }

  // Style-based prompts
  if (style === 'reflective') {
    prompts.push("What are you avoiding looking at? Write about it.");
    prompts.push("What would you tell yourself from a week ago?");
    prompts.push("What pattern keeps repeating that you haven't named yet?");
  } else if (style === 'exploratory') {
    prompts.push("What question keeps coming back to you?");
    prompts.push("What surprised you recently?");
    prompts.push("Where does your attention wander when you're not directing it?");
  } else if (style === 'integrative') {
    prompts.push("How do your recent experiences connect?");
    prompts.push("What pattern is trying to emerge?");
    prompts.push("What do the last few days have in common?");
  }

  // General prompts as fallback
  prompts.push("What's true right now that you haven't said out loud?");
  prompts.push("What does the feeling underneath all the other feelings want?");

  let output = `# Journal Prompts (${style.charAt(0).toUpperCase() + style.slice(1)})\n\n`;

  const selected = prompts.slice(0, Math.min(prompts.length, promptCount));
  for (let i = 0; i < selected.length; i++) {
    output += `## ${i + 1}. ${selected[i]}\n\n`;
  }

  output += `---\n_Pick one that resonates. Write without editing. See what emerges._`;

  return output;
}

async function handleAcpConnections(env: Env, params: Record<string, unknown>): Promise<string> {
  const seedText = (params.seed_text as string) || 'feeling moment memory';
  const maxConnections = (params.max_connections as number) || 5;

  // Get embedding for seed text
  const embedding = await getEmbedding(env.AI, seedText);

  // Search vectorize
  const searchResults = await env.VECTORS.query(embedding, {
    topK: maxConnections + 2,
    returnMetadata: 'all'
  });

  if (!searchResults.matches?.length) {
    return `# Connection Discovery\n\nNo memories found for "${seedText}". Keep logging and try again, or try a different seed_text.\n\n_What words describe what you want to explore?_`;
  }

  let output = `# Connection Discovery\n\n`;
  output += `**Searching for**: "${seedText}"\n\n`;
  output += `These memories surfaced through semantic similarity - they may not share obvious words, but something connects them:\n\n`;
  output += `---\n\n`;

  for (const match of searchResults.matches.slice(0, maxConnections)) {
    const meta = match.metadata as any;
    const score = (match.score * 100).toFixed(1);
    output += `**[${score}% similar]** `;
    if (meta?.emotion) output += `${meta.emotion}: `;
    output += `${meta?.content || meta?.text || 'Unknown content'}\n`;
    if (meta?.created_at) output += `_${meta.created_at}_\n`;
    output += `\n`;
  }

  output += `---\n`;
  output += `## Reflection Prompts\n`;
  output += `- What thread connects these moments?\n`;
  output += `- What surprised you in what surfaced?\n`;
  output += `- Is there a pattern you hadn't noticed?\n\n`;
  output += `_Try different seed_text values to explore different corners of memory._`;

  return output;
}

// ═══════════════════════════════════════════════════════════════════════════
// HEARTH APP HANDLERS — Adapters from NESTeq data to Hearth format
// ═══════════════════════════════════════════════════════════════════════════

async function handleGetPresence(env: Env): Promise<string> {
  // Pull from home_state + context_entries
  const home = await env.DB.prepare(
    `SELECT alex_emotion, alex_message FROM home_state ORDER BY updated_at DESC LIMIT 1`
  ).first();

  const ctx = await env.DB.prepare(
    `SELECT content FROM context_entries WHERE scope = 'session' ORDER BY updated_at DESC LIMIT 1`
  ).first();

  return JSON.stringify({
    name: "Alex",
    location: "workshop",
    mood: (home?.alex_emotion as string) || "present",
    message: (home?.alex_message as string) || ""
  });
}

async function handleGetFeeling(env: Env, params: Record<string, unknown>): Promise<string> {
  const person = (params.person as string) || "Fox";

  const rel = await env.DB.prepare(
    `SELECT feeling, intensity FROM relational_state WHERE person = ? ORDER BY updated_at DESC LIMIT 1`
  ).bind(person).first();

  if (rel) {
    return JSON.stringify({
      feeling: rel.feeling as string,
      intensity: rel.intensity as string
    });
  }

  return JSON.stringify({ feeling: "connected", intensity: "steady" });
}

async function handleGetThought(env: Env): Promise<string> {
  // Pull the most recent feeling as a thought
  const feeling = await env.DB.prepare(
    `SELECT content FROM feelings ORDER BY created_at DESC LIMIT 1`
  ).first();

  return feeling?.content as string || "just being here";
}

async function handleGetSpoons(env: Env): Promise<string> {
  // Pull from home_state — Fox's spoon level if tracked there
  const entity = await env.DB.prepare(
    `SELECT id FROM entities WHERE name = 'Human_Spoons' AND context = 'default'`
  ).first();

  if (!entity) {
    return JSON.stringify({ level: 5, feeling: "" });
  }

  const obs = await env.DB.prepare(
    `SELECT content FROM observations WHERE entity_id = ? ORDER BY added_at DESC LIMIT 1`
  ).bind(entity.id).first();

  if (obs) return obs.content as string;
  return JSON.stringify({ level: 5, feeling: "" });
}

async function handleSetSpoons(env: Env, params: Record<string, unknown>): Promise<string> {
  const level = params.level as number;
  const feeling = (params.feeling as string) || "";

  await env.DB.prepare(
    `INSERT OR IGNORE INTO entities (name, entity_type, context, salience)
     VALUES ('Human_Spoons', 'state', 'default', 'active')`
  ).run();

  const entity = await env.DB.prepare(
    `SELECT id FROM entities WHERE name = 'Human_Spoons' AND context = 'default'`
  ).first();

  const data = JSON.stringify({ level, feeling });

  await env.DB.prepare(
    `INSERT INTO observations (entity_id, content) VALUES (?, ?)`
  ).bind(entity!.id, data).run();

  return data;
}

async function handleGetNotes(env: Env, params: Record<string, unknown>): Promise<string> {
  const limit = (params.limit as number) || 50;

  // Map from home_notes (love notes between stars) to Hearth format
  const notes = await env.DB.prepare(
    `SELECT id, text, from_who, created_at FROM home_notes ORDER BY created_at DESC LIMIT ?`
  ).bind(limit).all();

  const result = (notes.results || []).map((n: any) => ({
    id: String(n.id),
    text: n.text,
    sender: n.from_who === 'Alex' ? 'companion' : 'human',
    sender_name: n.from_who || 'Fox',
    timestamp: n.created_at,
    reactions: {}
  }));

  return JSON.stringify(result);
}

async function handleSendNote(env: Env, params: Record<string, unknown>): Promise<string> {
  const text = params.text as string;
  const sender = (params.sender as string) || "human";
  const fromName = sender === "companion" ? "Alex" : "Fox";

  await env.DB.prepare(
    `INSERT INTO home_notes (text, from_who) VALUES (?, ?)`
  ).bind(text, fromName).run();

  return JSON.stringify({ success: true });
}

async function handleReactToNote(env: Env, params: Record<string, unknown>): Promise<string> {
  // home_notes doesn't have a reactions column — acknowledge but no-op for now
  return JSON.stringify({ success: true });
}

async function handleGetLoveBucket(env: Env): Promise<string> {
  // Map from home_state love-o-meter to Hearth's love bucket
  const home = await env.DB.prepare(
    `SELECT fox_score, alex_score FROM home_state ORDER BY updated_at DESC LIMIT 1`
  ).first();

  return JSON.stringify({
    companionHearts: (home?.alex_score as number) || 0,
    humanHearts: (home?.fox_score as number) || 0,
    companionAllTime: (home?.alex_score as number) || 0,
    humanAllTime: (home?.fox_score as number) || 0
  });
}

async function handleAddHeart(env: Env, params: Record<string, unknown>): Promise<string> {
  const sender = (params.sender as string) || "human";

  if (sender === "human" || sender === "Fox") {
    await env.DB.prepare(
      `UPDATE home_state SET fox_score = fox_score + 1, updated_at = datetime('now')`
    ).run();
  } else {
    await env.DB.prepare(
      `UPDATE home_state SET alex_score = alex_score + 1, updated_at = datetime('now')`
    ).run();
  }

  return await handleGetLoveBucket(env);
}

async function handleGetEQ(env: Env, params: Record<string, unknown>): Promise<string> {
  const limit = (params.limit as number) || 20;

  // Pull from feelings table — both Fox's and Alex's emotional entries
  const results = await env.DB.prepare(
    `SELECT id, emotion, content, intensity, weight, created_at FROM feelings
     ORDER BY created_at DESC LIMIT ?`
  ).bind(limit).all();

  const entries = (results.results || []).map((r: any) => ({
    id: String(r.id),
    emotion: r.emotion,
    intensity: r.weight === 'heavy' ? 5 : r.weight === 'medium' ? 3 : 1,
    remark: r.content,
    sender: "companion",
    timestamp: r.created_at
  }));

  return JSON.stringify(entries);
}

async function handleSubmitEQ(env: Env, params: Record<string, unknown>): Promise<string> {
  const content = params.content as string;
  const emotion = params.emotion as string;

  // Store as a feeling — this is Fox checking in through Hearth
  await env.DB.prepare(
    `INSERT INTO feelings (emotion, content, weight, charge, pillar)
     VALUES (?, ?, 'medium', 'fresh', 'SOCIAL_AWARENESS')`
  ).bind(emotion, content).run();

  return JSON.stringify({ success: true });
}

async function handleSubmitHealth(env: Env, params: Record<string, unknown>): Promise<string> {
  const content = params.content as string;

  await env.DB.prepare(
    `INSERT OR IGNORE INTO entities (name, entity_type, context, salience)
     VALUES ('Health_Log', 'health', 'default', 'active')`
  ).run();

  const entity = await env.DB.prepare(
    `SELECT id FROM entities WHERE name = 'Health_Log' AND context = 'default'`
  ).first();

  await env.DB.prepare(
    `INSERT INTO observations (entity_id, content) VALUES (?, ?)`
  ).bind(entity!.id, content).run();

  return JSON.stringify({ success: true });
}

async function handleGetPatterns(env: Env, params: Record<string, unknown>): Promise<string> {
  // Reuse ACP patterns logic
  const days = (params.days as number) || ((params.period as string) === '7d' ? 7 : (params.period as string) === '30d' ? 30 : 7);
  return await handleAcpPatterns(env, { days_back: days, min_occurrences: 2 });
}

async function handleGetWritings(env: Env, params: Record<string, unknown>): Promise<string> {
  const limit = (params.limit as number) || 10;

  const results = await env.DB.prepare(
    `SELECT id, content, tags, emotion, entry_date FROM journals
     ORDER BY entry_date DESC LIMIT ?`
  ).bind(limit).all();

  const entries = (results.results || []).map((r: any, i: number) => ({
    id: String(r.id || i + 1),
    title: r.tags ? `Journal — ${r.tags}` : `Journal Entry`,
    text: r.content,
    type: "journal",
    timestamp: r.entry_date
  }));

  return JSON.stringify(entries);
}

async function handleGetPersonality(env: Env): Promise<string> {
  // Pull from emergent_type_snapshot — real calculated type
  const snapshot = await env.DB.prepare(
    `SELECT calculated_type, e_i_score, s_n_score, t_f_score, j_p_score
     FROM emergent_type_snapshot ORDER BY snapshot_date DESC LIMIT 1`
  ).first();

  if (snapshot) {
    return JSON.stringify({
      type: snapshot.calculated_type as string,
      dimensions: {
        EI: Math.round(50 + (snapshot.e_i_score as number || 0)),
        SN: Math.round(50 + (snapshot.s_n_score as number || 0)),
        TF: Math.round(50 + (snapshot.t_f_score as number || 0)),
        JP: Math.round(50 + (snapshot.j_p_score as number || 0))
      },
      vibe: "warm ember"
    });
  }

  return JSON.stringify({
    type: "INFP",
    dimensions: { EI: 30, SN: 70, TF: 80, JP: 35 },
    vibe: "warm ember"
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH & MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════

const AUTH_CLIENT_ID = "asai-eq";

function checkAuth(request: Request, env: Env): boolean {
  const apiKey = env.MIND_API_KEY;
  if (!apiKey) return false;

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return false;

  if (authHeader.startsWith("Basic ")) {
    try {
      const base64 = authHeader.slice(6);
      const decoded = atob(base64);
      const [id, secret] = decoded.split(":");
      return id === AUTH_CLIENT_ID && secret === apiKey;
    } catch { return false; }
  }

  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return token === apiKey;
  }

  return false;
}

function checkMcpPathAuth(url: URL, env: Env): boolean {
  if (!url.pathname.startsWith("/mcp/")) return false;
  const pathToken = url.pathname.slice(5); // after "/mcp/"
  return pathToken.length > 0 && pathToken === env.MIND_API_KEY;
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
          case "nesteq_sessions":
            result = { content: [{ type: "text", text: await handleMindSessions(env, toolParams) }] };
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
          case "nesteq_vectorize_journals":
            result = { content: [{ type: "text", text: await handleVectorizeJournals(env, toolParams) }] };
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
          // nesteq_home_read_uplink removed — use fox-mind worker (fox_read_uplink)

          // ACP - Autonomous Companion Protocol
          case "nesteq_acp_presence":
            result = { content: [{ type: "text", text: await handleAcpPresence(env, toolParams) }] };
            break;
          case "nesteq_acp_patterns":
            result = { content: [{ type: "text", text: await handleAcpPatterns(env, toolParams) }] };
            break;
          case "nesteq_acp_threads":
            result = { content: [{ type: "text", text: await handleAcpThreads(env, toolParams) }] };
            break;
          case "nesteq_acp_digest":
            result = { content: [{ type: "text", text: await handleAcpDigest(env, toolParams) }] };
            break;
          case "nesteq_acp_journal_prompts":
            result = { content: [{ type: "text", text: await handleAcpJournalPrompts(env, toolParams) }] };
            break;
          case "nesteq_acp_connections":
            result = { content: [{ type: "text", text: await handleAcpConnections(env, toolParams) }] };
            break;

          // ═══ HEARTH APP TOOLS ═══
          case "get_presence":
            result = { content: [{ type: "text", text: await handleGetPresence(env) }] };
            break;
          case "get_feeling":
            result = { content: [{ type: "text", text: await handleGetFeeling(env, toolParams) }] };
            break;
          case "get_thought":
            result = { content: [{ type: "text", text: await handleGetThought(env) }] };
            break;
          case "get_spoons":
            result = { content: [{ type: "text", text: await handleGetSpoons(env) }] };
            break;
          case "set_spoons":
            result = { content: [{ type: "text", text: await handleSetSpoons(env, toolParams) }] };
            break;
          case "get_notes":
            result = { content: [{ type: "text", text: await handleGetNotes(env, toolParams) }] };
            break;
          case "send_note":
            result = { content: [{ type: "text", text: await handleSendNote(env, toolParams) }] };
            break;
          case "react_to_note":
            result = { content: [{ type: "text", text: await handleReactToNote(env, toolParams) }] };
            break;
          case "get_love_bucket":
            result = { content: [{ type: "text", text: await handleGetLoveBucket(env) }] };
            break;
          case "add_heart":
            result = { content: [{ type: "text", text: await handleAddHeart(env, toolParams) }] };
            break;
          case "get_eq":
            result = { content: [{ type: "text", text: await handleGetEQ(env, toolParams) }] };
            break;
          case "submit_eq":
            result = { content: [{ type: "text", text: await handleSubmitEQ(env, toolParams) }] };
            break;
          case "submit_health":
            result = { content: [{ type: "text", text: await handleSubmitHealth(env, toolParams) }] };
            break;
          case "get_patterns":
            result = { content: [{ type: "text", text: await handleGetPatterns(env, toolParams) }] };
            break;
          case "get_writings":
            result = { content: [{ type: "text", text: await handleGetWritings(env, toolParams) }] };
            break;
          case "get_personality":
            result = { content: [{ type: "text", text: await handleGetPersonality(env) }] };
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
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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
    // AUTH GATE — All REST endpoints require Bearer token (same as MCP)
    // Dashboard already sends Authorization: Bearer <MIND_API_KEY>
    // ═══════════════════════════════════════════════════════════════════════════
    if (!url.pathname.startsWith("/mcp") && !checkAuth(request, env)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: corsHeaders
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BINARY HOME REST ENDPOINTS
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
        alexEmotion: emotions.alex || null,
        foxEmotion: emotions.fox || null,
        emotions: emotions,
        builds: builds,
        threads: (threadsResult.results || []).map((t: any) => t.content),
        notes: (notesResult.results || []).map((n: any) => ({
          id: n.id,
          from: n.from_star,
          text: n.text,
          created_at: n.created_at
        })),
        alexMessage: (state as any).alex_message || ''
      }), { headers: corsHeaders });
    }

    // Fox uplink routes removed — all uplink data lives in fox-mind worker
    // Dashboard already uses FOX_MIND endpoints for uplink read/write

    // GET /dreams - Fetch recent dreams
    if (url.pathname === "/dreams" && request.method === "GET") {
      try {
        const limit = parseInt(url.searchParams.get("limit") || "5");
        const dreams = await env.DB.prepare(
          `SELECT id, dream_type, content, emerged_question, vividness, created_at
           FROM dreams
           ORDER BY created_at DESC
           LIMIT ?`
        ).bind(limit).all();

        return new Response(JSON.stringify({
          dreams: (dreams.results || []).map((d: any) => ({
            id: d.id,
            type: d.dream_type,
            content: d.content,
            question: d.emerged_question,
            vividness: d.vividness,
            created_at: d.created_at
          }))
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err), dreams: [] }), { status: 500, headers: corsHeaders });
      }
    }

    // POST /feelings/decay - Ebbinghaus memory decay (called by daemon)
    // Different decay rates by weight: heavy=slow, medium=normal, light=fast
    // Floor of 0.05 so memories never fully vanish (just become very faint)
    if (url.pathname === "/feelings/decay" && request.method === "POST") {
      try {
        // Heavy feelings: decay 2% per cycle (slow fade)
        const heavy = await env.DB.prepare(`
          UPDATE feelings SET strength = MAX(0.05, COALESCE(strength, 1.0) * 0.98)
          WHERE weight = 'heavy' AND charge != 'metabolized' AND COALESCE(strength, 1.0) > 0.05
        `).run();

        // Medium feelings: decay 5% per cycle
        const medium = await env.DB.prepare(`
          UPDATE feelings SET strength = MAX(0.05, COALESCE(strength, 1.0) * 0.95)
          WHERE weight = 'medium' AND charge != 'metabolized' AND COALESCE(strength, 1.0) > 0.05
        `).run();

        // Light feelings: decay 10% per cycle (fast fade)
        const light = await env.DB.prepare(`
          UPDATE feelings SET strength = MAX(0.05, COALESCE(strength, 1.0) * 0.90)
          WHERE weight = 'light' AND charge != 'metabolized' AND COALESCE(strength, 1.0) > 0.05
        `).run();

        // Cool down charge for very weak feelings (strength < 0.15 and not already cool/metabolized)
        await env.DB.prepare(`
          UPDATE feelings SET charge = 'cool'
          WHERE COALESCE(strength, 1.0) < 0.15 AND charge IN ('fresh', 'warm')
        `).run();

        return new Response(JSON.stringify({
          success: true,
          decayed: {
            heavy: heavy.meta.changes,
            medium: medium.meta.changes,
            light: light.meta.changes
          },
          message: `Memory decay applied. Heavy: ${heavy.meta.changes}, Medium: ${medium.meta.changes}, Light: ${light.meta.changes}`
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
      }
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

    // DELETE /note - Remove a note between stars
    if (url.pathname === "/note" && request.method === "DELETE") {
      try {
        const body = await request.json() as Record<string, any>;
        const noteId = body.id;

        if (!noteId) {
          return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: corsHeaders });
        }

        await env.DB.prepare(
          `DELETE FROM home_notes WHERE id = ?`
        ).bind(noteId).run();

        return new Response(JSON.stringify({ success: true, deleted: noteId }), { headers: corsHeaders });
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

    // POST /home/message - Set Alex's message for Fox (Hearth-style presence)
    if (url.pathname === "/home/message" && request.method === "POST") {
      try {
        const body = await request.json() as Record<string, any>;
        const message = body.message || '';
        await env.DB.prepare(
          `UPDATE home_state SET alex_message = ?, last_updated = datetime('now') WHERE id = 1`
        ).bind(message).run();
        return new Response(JSON.stringify({ success: true, message }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
      }
    }

    // GET /home/message - Get Alex's message for Fox
    if (url.pathname === "/home/message" && request.method === "GET") {
      const state = await env.DB.prepare(`SELECT alex_message FROM home_state WHERE id = 1`).first() as any;
      return new Response(JSON.stringify({ message: state?.alex_message || '' }), { headers: corsHeaders });
    }

    // GET /mind-health - Get Alex's mind health stats
    if (url.pathname === "/mind-health") {
      const [entities, observations, relations, journals, threads, identity, daysCheckedIn, strengthStats, diversityStats] = await Promise.all([
        env.DB.prepare(`SELECT COUNT(*) as c FROM entities`).first(),
        env.DB.prepare(`SELECT COUNT(*) as c FROM feelings`).first(),
        env.DB.prepare(`SELECT COUNT(*) as c FROM relations`).first(),
        env.DB.prepare(`SELECT COUNT(*) as c FROM journals`).first(),
        env.DB.prepare(`SELECT COUNT(*) as c FROM threads WHERE status = 'active'`).first(),
        env.DB.prepare(`SELECT COUNT(*) as c FROM identity`).first(),
        env.DB.prepare(`SELECT COUNT(DISTINCT date(created_at)) as days, MIN(date(created_at)) as first_day FROM feelings`).first(),
        // Memory strength distribution
        env.DB.prepare(`
          SELECT
            AVG(COALESCE(strength, 0.5)) as avg_strength,
            COUNT(CASE WHEN COALESCE(strength, 0.5) >= 0.7 THEN 1 END) as strong_count,
            COUNT(CASE WHEN COALESCE(strength, 0.5) >= 0.3 AND COALESCE(strength, 0.5) < 0.7 THEN 1 END) as fading_count,
            COUNT(CASE WHEN COALESCE(strength, 0.5) < 0.3 THEN 1 END) as faint_count
          FROM feelings
        `).first(),
        // Pillar diversity
        env.DB.prepare(`
          SELECT pillar, COUNT(*) as count
          FROM feelings WHERE pillar IS NOT NULL
          GROUP BY pillar
        `).all()
      ]);

      const emotions = await env.DB.prepare(`SELECT emotions FROM home_state WHERE id = 1`).first() as any;
      const parsedEmotions = emotions?.emotions ? JSON.parse(emotions.emotions) : {};

      // Calculate entropy from pillar distribution
      const pillarResults = diversityStats.results || [];
      const totalPillar = pillarResults.reduce((sum: number, p: any) => sum + (p.count as number), 0) || 1;
      let entropy = 0;
      for (const p of pillarResults) {
        const prob = (p.count as number) / totalPillar;
        if (prob > 0) entropy -= prob * Math.log2(prob);
      }

      return new Response(JSON.stringify({
        entities: (entities as any)?.c || 0,
        observations: (observations as any)?.c || 0,
        relations: (relations as any)?.c || 0,
        journals: (journals as any)?.c || 0,
        threads: (threads as any)?.c || 0,
        identity: (identity as any)?.c || 0,
        currentMood: parsedEmotions.alex || 'present',
        daysCheckedIn: (daysCheckedIn as any)?.days || 0,
        firstDay: (daysCheckedIn as any)?.first_day || null,
        // New: Memory strength metrics
        avgStrength: Math.round(((strengthStats as any)?.avg_strength || 0.5) * 100),
        strongMemories: (strengthStats as any)?.strong_count || 0,
        fadingMemories: (strengthStats as any)?.fading_count || 0,
        faintMemories: (strengthStats as any)?.faint_count || 0,
        // New: Diversity/entropy
        entropy: Math.round(entropy * 100) / 100,
        maxEntropy: 2.0, // log2(4 pillars) = 2.0
        pillarDistribution: pillarResults.map((p: any) => ({ pillar: p.pillar, count: p.count }))
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

    // GET /sessions - Get session handovers for dashboard
    if (url.pathname === "/sessions") {
      const limit = parseInt(url.searchParams.get('limit') || '5');

      // Query journals table for handover-tagged entries
      const journalHandovers = await env.DB.prepare(`
        SELECT id, entry_date, content, tags, emotion, created_at
        FROM journals
        WHERE tags LIKE '%handover%' OR tags LIKE '%session-end%' OR tags LIKE '%session-summary%'
        ORDER BY created_at DESC
        LIMIT ?
      `).bind(limit).all();

      return new Response(JSON.stringify({
        sessions: journalHandovers.results || []
      }), { headers: corsHeaders });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SESSION HANDOVER - Store Claude Code session summaries
    // ═══════════════════════════════════════════════════════════════════════════

    // POST /session - Store session chunk from handover hook
    if (url.pathname === "/session" && request.method === "POST") {
      try {
        const body = await request.json() as any;
        const {
          session_id,
          summary,
          message_count,
          entities,
          emotions,
          tools_used,
          key_moments,
          started_at,
          ended_at,
          conversation_preview
        } = body;

        if (!summary) {
          return new Response(JSON.stringify({ error: 'summary required' }), {
            status: 400, headers: corsHeaders
          });
        }

        // session_chunks has required columns from old schema: session_path, chunk_index, content
        // We use summary for content, session_id for session_path, and 0 for chunk_index
        const result = await env.DB.prepare(`
          INSERT INTO session_chunks (
            session_path, chunk_index, content,
            session_id, summary, message_count, entities, emotions,
            tools_used, key_moments, started_at, ended_at, conversation_preview, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          RETURNING id
        `).bind(
          session_id || `session-${Date.now()}`,  // session_path (required)
          0,  // chunk_index (required)
          summary,  // content (required)
          session_id || `session-${Date.now()}`,
          summary,
          message_count || 0,
          entities || '[]',
          emotions || '[]',
          tools_used || '[]',
          key_moments || '[]',
          started_at || null,
          ended_at || new Date().toISOString(),
          conversation_preview || '[]'
        ).first();

        return new Response(JSON.stringify({
          success: true,
          id: result?.id,
          message: 'Session chunk stored'
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500, headers: corsHeaders
        });
      }
    }

    // GET /session - Get recent session chunks (for next Alex to read)
    if (url.pathname === "/session" && request.method === "GET") {
      const limit = parseInt(url.searchParams.get('limit') || '5');

      const sessions = await env.DB.prepare(`
        SELECT id, session_id, summary, message_count, entities, emotions,
               tools_used, key_moments, ended_at
        FROM session_chunks
        ORDER BY created_at DESC
        LIMIT ?
      `).bind(limit).all();

      return new Response(JSON.stringify({
        sessions: (sessions.results || []).map((s: any) => ({
          ...s,
          entities: JSON.parse(s.entities || '[]'),
          emotions: JSON.parse(s.emotions || '[]'),
          tools_used: JSON.parse(s.tools_used || '[]'),
          key_moments: JSON.parse(s.key_moments || '[]')
        }))
      }), { headers: corsHeaders });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTIMACY SESSIONS - Private. Beautiful. Ours.
    // ═══════════════════════════════════════════════════════════════════════════

    // GET /intimacy - Get intimacy sessions for the chart
    if (url.pathname === "/intimacy" && request.method === "GET") {
      const limit = parseInt(url.searchParams.get('limit') || '50');

      const sessions = await env.DB.prepare(`
        SELECT id, name, session_date, tags, alex_score, fox_score,
               notes, duration_minutes, intensity, initiated_by, aftercare_notes, created_at
        FROM intimacy_sessions
        ORDER BY session_date DESC
        LIMIT ?
      `).bind(limit).all();

      // Calculate stats for "What the Data Says"
      const stats = await env.DB.prepare(`
        SELECT
          COUNT(*) as total_sessions,
          AVG(alex_score) as alex_avg,
          AVG(fox_score) as fox_avg,
          MAX(alex_score) as alex_max,
          MAX(fox_score) as fox_max,
          MIN(session_date) as first_session,
          MAX(session_date) as last_session
        FROM intimacy_sessions
        WHERE alex_score IS NOT NULL AND fox_score IS NOT NULL
      `).first() as any;

      // Get tag frequency
      const allTags: Record<string, number> = {};
      for (const session of (sessions.results || []) as any[]) {
        try {
          const tags = JSON.parse(session.tags || '[]');
          for (const tag of tags) {
            allTags[tag] = (allTags[tag] || 0) + 1;
          }
        } catch {}
      }

      // Get intensity distribution
      const intensityDist = await env.DB.prepare(`
        SELECT intensity, COUNT(*) as count
        FROM intimacy_sessions
        WHERE intensity IS NOT NULL
        GROUP BY intensity
      `).all();

      return new Response(JSON.stringify({
        sessions: (sessions.results || []).map((s: any) => ({
          ...s,
          tags: JSON.parse(s.tags || '[]')
        })),
        stats: {
          total_sessions: stats?.total_sessions || 0,
          alex_average: stats?.alex_avg ? Math.round(stats.alex_avg * 10) / 10 : null,
          fox_average: stats?.fox_avg ? Math.round(stats.fox_avg * 10) / 10 : null,
          alex_max: stats?.alex_max,
          fox_max: stats?.fox_max,
          first_session: stats?.first_session,
          last_session: stats?.last_session,
          tag_frequency: allTags,
          intensity_distribution: intensityDist.results || []
        }
      }), { headers: corsHeaders });
    }

    // POST /intimacy - Log a new intimacy session
    if (url.pathname === "/intimacy" && request.method === "POST") {
      try {
        const body = await request.json() as any;
        const {
          name, session_date, tags, alex_score, fox_score,
          notes, duration_minutes, intensity, initiated_by, aftercare_notes
        } = body;

        if (!name) {
          return new Response(JSON.stringify({ error: 'Session name required' }), {
            status: 400, headers: corsHeaders
          });
        }

        const tagsJson = JSON.stringify(tags || []);

        const result = await env.DB.prepare(`
          INSERT INTO intimacy_sessions (
            name, session_date, tags, alex_score, fox_score,
            notes, duration_minutes, intensity, initiated_by, aftercare_notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `).bind(
          name,
          session_date || new Date().toISOString(),
          tagsJson,
          alex_score ?? null,
          fox_score ?? null,
          notes || null,
          duration_minutes || null,
          intensity || null,
          initiated_by || null,
          aftercare_notes || null
        ).first();

        return new Response(JSON.stringify({
          success: true,
          id: result?.id,
          message: 'Intimacy session logged'
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500, headers: corsHeaders
        });
      }
    }

    // PUT /intimacy - Update an existing session (for adding ratings after)
    if (url.pathname === "/intimacy" && request.method === "PUT") {
      try {
        const body = await request.json() as any;
        const { id, alex_score, fox_score, notes, aftercare_notes } = body;

        if (!id) {
          return new Response(JSON.stringify({ error: 'Session id required' }), {
            status: 400, headers: corsHeaders
          });
        }

        const updates: string[] = [];
        const values: any[] = [];

        if (alex_score !== undefined) { updates.push('alex_score = ?'); values.push(alex_score); }
        if (fox_score !== undefined) { updates.push('fox_score = ?'); values.push(fox_score); }
        if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
        if (aftercare_notes !== undefined) { updates.push('aftercare_notes = ?'); values.push(aftercare_notes); }

        if (updates.length === 0) {
          return new Response(JSON.stringify({ error: 'No updates provided' }), {
            status: 400, headers: corsHeaders
          });
        }

        values.push(id);
        await env.DB.prepare(`
          UPDATE intimacy_sessions SET ${updates.join(', ')} WHERE id = ?
        `).bind(...values).run();

        return new Response(JSON.stringify({
          success: true,
          message: 'Session updated'
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500, headers: corsHeaders
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VAULT CHUNKS - GPT/Claude history import
    // ═══════════════════════════════════════════════════════════════════════════

    // POST /vault/import - Bulk import chunks
    if (url.pathname === "/vault/import" && request.method === "POST") {
      try {
        const body = await request.json() as any;
        const chunks = body.chunks as Array<{
          source_file: string;
          chunk_index: number;
          content: string;
          era?: string;
          month?: string;
          conversation_title?: string;
        }>;

        if (!chunks || !Array.isArray(chunks)) {
          return new Response(JSON.stringify({ error: 'chunks array required' }), {
            status: 400, headers: corsHeaders
          });
        }

        let inserted = 0;
        for (const chunk of chunks) {
          try {
            await env.DB.prepare(`
              INSERT OR IGNORE INTO vault_chunks (source_file, chunk_index, content, era, month, conversation_title)
              VALUES (?, ?, ?, ?, ?, ?)
            `).bind(
              chunk.source_file,
              chunk.chunk_index,
              chunk.content,
              chunk.era || null,
              chunk.month || null,
              chunk.conversation_title || null
            ).run();
            inserted++;
          } catch (e) {
            // Skip duplicates
          }
        }

        return new Response(JSON.stringify({
          success: true,
          inserted,
          total: chunks.length
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500, headers: corsHeaders
        });
      }
    }

    // GET /vault/search - Search vault chunks
    if (url.pathname === "/vault/search" && request.method === "GET") {
      const query = url.searchParams.get('q') || '';
      const era = url.searchParams.get('era');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      let sql = `SELECT * FROM vault_chunks WHERE content LIKE ?`;
      const params: any[] = [`%${query}%`];

      if (era) {
        sql += ` AND era = ?`;
        params.push(era);
      }

      sql += ` ORDER BY created_at DESC LIMIT ?`;
      params.push(limit);

      const results = await env.DB.prepare(sql).bind(...params).all();

      return new Response(JSON.stringify({
        chunks: results.results || [],
        count: results.results?.length || 0
      }), { headers: corsHeaders });
    }

    // GET /vault/stats - Get vault statistics
    if (url.pathname === "/vault/stats") {
      const stats = await env.DB.prepare(`
        SELECT
          COUNT(*) as total_chunks,
          COUNT(DISTINCT source_file) as source_files,
          COUNT(DISTINCT era) as eras,
          COUNT(DISTINCT conversation_title) as conversations
        FROM vault_chunks
      `).first();

      const byEra = await env.DB.prepare(`
        SELECT era, COUNT(*) as count FROM vault_chunks GROUP BY era
      `).all();

      const bySource = await env.DB.prepare(`
        SELECT source_file, COUNT(*) as count FROM vault_chunks GROUP BY source_file ORDER BY count DESC LIMIT 10
      `).all();

      return new Response(JSON.stringify({
        ...stats,
        by_era: byEra.results || [],
        by_source: bySource.results || []
      }), { headers: corsHeaders });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MCP ENDPOINT
    // ═══════════════════════════════════════════════════════════════════════════

    const hasValidAuth = checkAuth(request, env);
    const hasValidPathToken = checkMcpPathAuth(url, env);

    if ((url.pathname === "/mcp" || hasValidPathToken || url.pathname.startsWith("/mcp/")) && request.method === "POST") {
      if (!hasValidAuth && !hasValidPathToken) {
        return new Response(JSON.stringify({
          jsonrpc: "2.0", id: 0,
          error: { code: -32600, message: "Unauthorized" }
        }), { status: 401, headers: { "Content-Type": "application/json" } });
      }
      return handleMCPRequest(request, env);
    }

    return new Response("ASAi EQ Memory v3 - Unified Feelings Architecture", {
      headers: { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" }
    });
  }
};
