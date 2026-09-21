const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs');

// --- Data helpers ---
function getCurriculum() {
    try {
        const p = path.join(process.cwd(), 'data', 'curriculum_september.json');
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
        return { activities: [] };
    }
}

// In-memory progress store (resets on cold start – acceptable for MVP)
const progressStore = {};

function getProgress() {
    return progressStore;
}

function saveProgress(activityId, feedback) {
    progressStore[activityId] = feedback;
}

// --- Gemini recommendation generator ---
async function generateRecommendations() {
    const curriculum = getCurriculum();
    const progress = getProgress();

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    const prompt = `
Sen bir çocuk gelişimi uzmanısın. 4 yaşındaki (48-60 ay) bir çocuğun ebeveynine tavsiyeler vereceksin.
Şu anda Eylül ayındayız. Çocuğun Eylül ayı okul müfredatı ve şu ana kadar ebeveynin girdiği geri bildirimler ile serbest notları aşağıdadır:

Eylül Ayı Müfredatı (Amaç ve Etkinlikler):
${JSON.stringify(curriculum)}

Şu Ana Kadarki Geri Bildirim ve Ebeveyn Notları:
${JSON.stringify(progress)}

Lütfen bu verilere bakarak, ebeveynin düştüğü metin notlarını (varsa) da dikkate alıp, Eylül ayının geri kalanı için çocuğun zorlandığı konuları aşmasına veya sevdiği konuları daha da geliştirmesine yardımcı olacak son derece spesifik pedagojik öneriler hazırla.
Çıktını AŞAĞIDAKİ JSON ŞEMASINA tam olarak uygun olarak üret. Ekstra metin, markdown vb. ekleme.

JSON formatı şöyle olmalı:
{
  "analysis": "Güncel duruma ve ebeveyn notlarına dair kısa analiz",
  "advice": "Geri kalan Eylül ayı için hedefe yönelik tavsiye",
  "recommendations": {
    "videos": [{ "title": "Video Adı", "url": "YouTube Linki" }],
    "books": [{ "title": "Kitap Adı", "author": "Yazar" }],
    "activities": [{ "title": "Aktivite Adı", "description": "Evde yapılabilecek aktivite açıklaması" }],
    "locations": [{ "title": "İstanbul'da Gezi Lokasyonu", "description": "Müfredatla bağlantılı neden gidilmeli" }]
  }
}
    `;

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
    });

    return JSON.parse(result.response.text());
}

// --- Vercel serverless handler ---
module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const url = req.url || '';

    // GET /api/curriculum
    if (req.method === 'GET' && url.includes('/curriculum')) {
        const curriculum = getCurriculum();
        const progress = getProgress();
        curriculum.activities = curriculum.activities.map(act => ({
            ...act,
            feedback: progress[act.id] || null
        }));
        return res.status(200).json(curriculum);
    }

    // GET /api/recommendations
    if (req.method === 'GET' && url.includes('/recommendations')) {
        try {
            const recs = await generateRecommendations();
            return res.status(200).json(recs);
        } catch (e) {
            console.error('Recommendations error:', e);
            return res.status(500).json({
                analysis: 'API hatası oluştu.',
                advice: 'Lütfen daha sonra tekrar deneyin.',
                recommendations: {}
            });
        }
    }

    // POST /api/feedback
    if (req.method === 'POST' && url.includes('/feedback')) {
        const { activityId, feedback, note } = req.body || {};
        if (activityId) saveProgress(activityId, { status: feedback, note });
        return res.status(200).json({ success: true });
    }

    return res.status(404).json({ error: 'Not found' });
};
