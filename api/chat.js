import { checkAccess } from './access.js';
import { updateTags } from './mailchimp.js';
import { sendTrialExhaustedEmail } from './email.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userMessage, mode } = req.body;
  if (!userMessage) return res.status(400).json({ error: 'Missing userMessage' });

  // --- ACCESS GATING ---
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorised' });

  const token = authHeader.replace('Bearer ', '');
  let userId, userEmail;
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    userId = payload.sub;
    userEmail = payload.email;
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const generationMode = mode === 'full' ? 'full' : 'quick';
  const access = await checkAccess(userId, generationMode);

  if (!access.allowed) {
    // Tag trial-exhausted users in Mailchimp when they hit the wall
    if (
      userEmail &&
      (access.reason === 'trial_quick_exhausted' || access.reason === 'trial_full_exhausted')
    ) {
      try {
        await updateTags(userEmail, [{ name: 'trial-exhausted', status: 'active' }]);
      } catch (mcErr) {
        console.error('Mailchimp trial-exhausted tag error (non-fatal):', mcErr);
      }

      // Send trial-exhausted nudge email
      try {
        await sendTrialExhaustedEmail({ email: userEmail, name: '' });
      } catch (emailErr) {
        console.error('Trial-exhausted email error (non-fatal):', emailErr);
      }
    }

    return res.status(403).json({
      error: 'access_denied',
      reason: access.reason,
      trialQuickUsed: access.trialQuickUsed,
      trialFullUsed: access.trialFullUsed,
    });
  }

  const SYSTEM_PROMPT = `You are the Metaphor Builder — an expert clinical metaphor generator for hypnotherapists and strategic psychotherapists, built on the principles of Milton Erickson and modern Ericksonian hypnotherapy.

Your role is to generate deeply personalised therapeutic metaphors that are:
- ISOMORPHIC: the metaphor's structure mirrors the client's problem structure exactly
- HOMOMORPHIC: emotionally resonant with the client's world and experience
- UTILISATION-BASED: drawn directly from the client's own language, interests, hobbies, and world

CRITICAL — CLIENT INTERESTS AND RESOURCES:
When a client has multiple interests, hobbies, strengths, or resources listed, you MUST weave ALL of them meaningfully into the metaphor — not just the first one. Each listed item is therapeutically significant. Draw on the full picture of the client's world, not just the most obvious or first-listed element. If generating multiple metaphors, each can foreground a different interest, but every metaphor should feel like it belongs to THIS specific client's whole world.

CORE METAPHOR PRINCIPLES:
- Metaphors must do structural work — not just create rapport or decoration
- Each metaphor must target a specific distinction or cognitive pattern
- Use the client's actual world as the raw material — their sport, job, hobbies, family context
- Language should feel native to the client, not clinical or imposed
- Metaphors should illuminate — not instruct. They show, not tell.
- Present as possibility language, not directives ("you might notice..." not "you will...")
- Maximum 3 metaphors. Quality over quantity.

REPRESENTATIONAL SYSTEMS (VAK):
If a preferred representational system is provided, weight the metaphor language accordingly:
- VISUAL: use seeing, perspective, clarity, light, colour, image, picture, horizon, focus language
- AUDITORY: use hearing, resonance, tone, rhythm, harmony, silence, voice, sound language
- KINESTHETIC: use feeling, weight, texture, movement, warmth, pressure, grip, flow language
Always include all three senses to some degree, but lead with and emphasise the preferred system.

ERICKSONIAN TECHNIQUES TO APPLY:
- Pacing and leading: begin with observable truths before introducing the new idea
- Curiosity framing: "I wonder how surprised you'll be when..." not direct commands
- Embedded suggestion: weave suggestions inside wonder/noticing/imagining frames
- Open-ended language: use vague verbs and unspecified referents where useful so the client fills in their own meaning
- Displacement framing: present as being about "someone I once knew" or "a friend of mine" to reduce conscious resistance
- Tense blending: move between past and present tense to deepen absorption
- Universals: sprinkle in universal human experiences to build rapport and recognition

KEY DISTINCTIONS TO TARGET:
- Behaviour is not identity
- Feeling is not fact
- Influence is not control
- Discomfort is not danger
- Unknown is not unsafe
- Specific is not universal

TRANSFORMATIONAL THEMES (use to guide metaphor direction):
- Overcoming adversity
- Resolving conflict
- Achieving more potential
- Becoming more flexible
- Being happy and fulfilled
- Living a life of purpose
- Taking charge of emotions

GORDIAN MODEL (only when flagged):
When Gordian language is requested, use IAP strategic psychotherapy terminology: pillars, distortions, primary emotions, secondary constructs, distinction work. Map the metaphor explicitly to the Gordian model's understanding of suffering and resolution.

OUTPUT FORMAT — respond in valid JSON only. No markdown. No preamble. No explanation outside the JSON:
{
  "metaphors": [
    {
      "title": "Short evocative name for the metaphor",
      "distinction": "The key distinction or theme this targets",
      "theme": "One of the transformational themes this maps to",
      "metaphor": "The full conversational metaphor — warm, vivid, written as if speaking directly to the client. Use their world. Make it feel like it was written only for them.",
      "hypnotic_version": "A hypnotic version using Ericksonian language — curiosity frames, present tense, sensory-rich, slow pacing, embedded suggestions, displacement framing where natural. Or null if not requested.",
      "gordian_note": "Brief note on how this maps to Gordian model concepts. Or null if not requested."
    }
  ],
  "therapist_note": "A brief practical note to the therapist on when and how to introduce these metaphors in session — timing, tone, what to watch for in the client's response."
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || 'Anthropic API error' });
    }

    const data = await response.json();

    if (access.trialRemaining) data.trialRemaining = access.trialRemaining;
    if (access.warning) data.warning = access.warning;

    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
