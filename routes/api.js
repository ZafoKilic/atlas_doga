const express = require('express');
const router = express.Router();
const llmService = require('../services/llmService');

router.get('/curriculum', (req, res) => {
    const curriculum = llmService.getCurriculum();
    const progress = llmService.getProgress();
    
    // Attach progress to curriculum items so frontend knows what is already filled
    curriculum.activities = curriculum.activities.map(act => {
        return {
            ...act,
            feedback: progress[act.id] || null
        };
    });

    res.json(curriculum);
});

router.get('/recommendations', async (req, res) => {
    try {
        const recs = await llmService.generateRecommendations();
        res.json(recs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/feedback', (req, res) => {
    const { activityId, feedback, note } = req.body;
    llmService.saveProgress(activityId, { status: feedback, note: note });
    res.json({ success: true, message: "Geri bildirim kaydedildi." });
});

module.exports = router;
