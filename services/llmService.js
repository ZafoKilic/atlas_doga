const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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
    fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
};

const generateRecommendations = async () => {
    const curriculum = getCurriculum();
    const progress = getProgress();

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

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
      "analysis": "Güncel duruma ve ebeveyn notlarına dair kısa analiz (Örn: Makas tutarken sol elini kullanması yorulmasına sebep olmuş...)",
      "advice": "Geri kalan Eylül ayı için hedefe yönelik tavsiye",
      "recommendations": {
        "videos": [{ "title": "Video Adı", "url": "YouTube Linki" }],
        "books": [{ "title": "Kitap Adı", "author": "Yazar" }],
        "activities": [{ "title": "Aktivite Adı", "description": "Evde yapılabilecek aktivite açıklaması" }],
        "locations": [{ "title": "İstanbul'da Gezi Lokasyonu", "description": "Müfredatla bağlantılı neden gidilmeli" }]
      }
    }
    `;

    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
            }
        });
        
        const responseText = result.response.text();
        return JSON.parse(responseText);
    } catch (error) {
        console.error("LLM Error:", error);
        return {
            analysis: "API Hatası veya yanıt alınamadı. (Fallback)",
            advice: "Lütfen daha sonra tekrar deneyin.",
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
