const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const curriculumPath = path.join(__dirname, '../data/curriculum_september.json');
const progressPath = path.join(__dirname, '../data/progress.json');

const getCurriculum = () => {
  try {
    const data = fs.readFileSync(curriculumPath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return { activities: [] };
  }
};

const getProgress = () => {
  try {
    const data = fs.readFileSync(progressPath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
};

const saveProgress = (activityId, feedback) => {
  const progress = getProgress();
  progress[activityId] = feedback;
  try {
    fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
  } catch (e) {
    // Vercel'in serverless dosya sistemi salt-okunur olabilir; sessizce yok say
  }
};

const generateRecommendations = async () => {
  const curriculum = getCurriculum();
  const progress = getProgress();

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

  try {
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
  } catch (error) {
    console.error("LLM Error:", error);
    return {
      analysis: "API hatasi olustu.",
      advice: "Lutfen daha sonra tekrar deneyin.",
      recommendations: {}
    };
  }
};

module.exports = {
  getCurriculum,
  getProgress,
  saveProgress,
  generateRecommendations
};
