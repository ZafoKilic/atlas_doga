const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const fs = require('fs');
const { kv } = require('@vercel/kv');

// --- Data helpers ---
function getCurriculum() {
  try {
    const p = path.join(process.cwd(), 'data', 'curriculum_september.json');
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return { activities: [] };
  }
}

const PROGRESS_KEY = 'atlas-doga:progress';

async function getProgress() {
  try {
    const data = await kv.get(PROGRESS_KEY);
    return data || {};
  } catch (e) {
    console.error('KV read error:', e);
    return {};
  }
}

async function saveProgress(activityId, feedback) {
  const progress = await getProgress();
  progress[activityId] = feedback;
  try {
    await kv.set(PROGRESS_KEY, progress);
  } catch (e) {
    console.error('KV write error:', e);
  }
}

// --- Claude recommendation generator ---
async function generateRecommendations() {
  const curriculum = getCurriculum();
  const progress = await getProgress();

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `
Sen bir cocuk gelisimi uzmanisin. 4 yasindaki (48-60 ay) bir cocugun ebeveynine tavsiyeler vereceksin.
Su anda Eylul ayindayiz. Cocugun Eylul ayi okul mufredati ve su ana kadar ebeveynin girdigi geri bildirimler ile serbest notlar asagidadir:
Eylul Ayi Mufredati (Amac ve Etkinlikler):
${JSON.stringify(curriculum)}
Su Ana Kadarki Geri Bildirim ve Ebeveyn Notlari:
${JSON.stringify(progress)}
Lutfen bu verilere bakarak, ebeveynin dustugu metin notlarini (varsa) da dikkate alip, Eylul ayinin geri kalani icin cocugun zorlandigi konulari asmasina veya sevdigi konulari daha da gelistirmesine yardimci olacak son derece spesifik pedagojik oneriler hazirla.
Ciktini ASAGIDAKI JSON SEMASINA tam olarak uygun olarak uret. SADECE JSON dondur; aciklama, markdown kod blogu veya baska hicbir ekstra metin ekleme, cevabin ilk karakteri { olmali.
JSON formati soyle olmali:
{
  "analysis": "Guncel duruma ve ebeveyn notlarina dair kisa analiz",
  "advice": "Geri kalan Eylul ayi icin hedefe yonelik tavsiye",
  "recommendations": {
    "videos": [{ "title": "Video Adi", "url": "YouTube Linki" }],
    "books": [{ "title": "Kitap Adi", "author": "Yazar" }],
    "activities": [{ "title": "Aktivite Adi", "description": "Evde yapilabilecek aktivite aciklamasi" }],
    "locations": [{ "title": "Istanbul'da Gezi Lokasyonu", "description": "Mufredatla baglantili neden gidilmeli" }]
  }
}
`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }]
  });

  const rawText = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const cleaned = rawText.replace(/```json\s*|```/g, '').trim();
  return JSON.parse(cleaned);
}

// --- Vercel serverless handler ---
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url || '';

  if (req.method === 'GET' && url.includes('/curriculum')) {
    const curriculum = getCurriculum();
    const progress = await getProgress();
    curriculum.activities = curriculum.activities.map((act) => ({
      ...act,
      feedback: progress[act.id] || null
    }));
    return res.status(200).json(curriculum);
  }

  if (req.method === 'GET' && url.includes('/recommendations')) {
    try {
      const recs = await generateRecommendations();
      return res.status(200).json(recs);
    } catch (e) {
      console.error('Recommendations error:', e);
      return res.status(500).json({
        analysis: 'API hatasi olustu.',
        advice: 'Lutfen daha sonra tekrar deneyin.',
        recommendations: {}
      });
    }
  }

  if (req.method === 'POST' && url.includes('/feedback')) {
    const { activityId, feedback, note } = req.body || {};
    if (activityId) await saveProgress(activityId, { status: feedback, note });
    return res.status(200).json({ success: true });
  }

  return res.status(404).json({ error: 'Not found' });
};
