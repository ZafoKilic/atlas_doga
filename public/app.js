import { loadCurriculum, saveCurriculum, loadProgress, saveProgress } from './idb.js';

document.addEventListener('DOMContentLoaded', () => {
    // Theme setup
    const themeToggle = document.getElementById('theme-toggle');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let currentTheme = localStorage.getItem('theme') || (prefersDark ? 'dark' : 'light');
    document.body.setAttribute('data-theme', currentTheme);

    themeToggle.addEventListener('click', () => {
        currentTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', currentTheme);
        localStorage.setItem('theme', currentTheme);
    });

    // Navigation setup
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });

    // Modal logic
    const modal = document.getElementById('feedback-modal');
    const closeBtn = document.querySelector('.close-btn');
    const fbBtns = document.querySelectorAll('.fb-btn');
    const modalNote = document.getElementById('modal-note');
    let currentActivityId = null;

    closeBtn.addEventListener('click', () => modal.classList.remove('show'));

    fbBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const feedback = btn.dataset.value;
            const note = modalNote.value.trim();
            await submitFeedback(currentActivityId, feedback, note);
            modal.classList.remove('show');
            // Update UI to show feedback recorded
            const btnEl = document.querySelector(`button[data-id="${currentActivityId}"]`);
            if(btnEl) {
                btnEl.textContent = `✓ ${feedback}`;
                btnEl.disabled = true;
                btnEl.style.opacity = '0.7';
            }
        });
    });

    // Refresh AI Recommendations
    const refreshBtn = document.getElementById('refresh-ai-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            document.getElementById('ai-content').innerHTML = '<div class="loader">Yeniden Analiz Ediliyor...</div>';
            fetchRecommendations();
        });
    }

    async function fetchCurriculum() {
        // Try loading from IndexedDB first (offline cache)
        const cached = await loadCurriculum();
        if (cached) {
            renderCurriculum(cached);
        }
        // Then fetch fresh data from server and update cache
        try {
            const res = await fetch('/api/curriculum');
            const data = await res.json();
            renderCurriculum(data);
            await saveCurriculum(data);
        } catch (e) {
            console.error(e);
            if (!cached) {
                document.getElementById('activities-list').innerHTML = '<p>Veri yüklenemedi.</p>';
            }
        }
    }

    function renderCurriculum(data) {
        if(data.summary) {
            const sumBox = document.getElementById('month-summary');
            if(sumBox) {
                sumBox.innerHTML = `<strong>Aylık Hedef:</strong> ${data.summary}`;
                sumBox.style.padding = "15px";
            }
        }

        const container = document.getElementById('activities-list');
        container.innerHTML = '';
        
        if(data.activities && data.activities.length > 0) {
            data.activities.forEach(act => {
                const card = document.createElement('div');
                card.className = 'card';
                
                let btnHtml = `<button class="action-btn open-modal-btn" data-id="${act.id}" data-title="${act.title}" data-category="${act.category.toLowerCase()}">Sonucu Gir</button>`;
                if (act.feedback) {
                    btnHtml = `<button class="action-btn" data-id="${act.id}" data-category="${act.category.toLowerCase()}" disabled style="opacity: 0.7;">✓ ${act.feedback.status}</button>`;
                }

                // Use tooltip (title attribute) for the pedagogical description
                const infoIcon = act.description ? `<span class="info-icon" title="${act.description}">ℹ️</span>` : '';

                const titleHtml = `<div class="activity-title">${act.title} ${infoIcon}</div>`;

                card.innerHTML = `
                    <div class="activity-category">${act.category}</div>
                    ${titleHtml}
                    ${btnHtml}
                `;
                container.appendChild(card);
            });

            document.querySelectorAll('.open-modal-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    currentActivityId = e.target.dataset.id;
                    document.getElementById('modal-activity-title').textContent = e.target.dataset.title;
                    modalNote.value = ''; // clear previous text
                    modal.classList.add('show');
                });
            });
        }
    }

    async function fetchRecommendations() {
        try {
            const res = await fetch('/api/recommendations');
            const data = await res.json();
            renderRecommendations(data);
        } catch (e) {
            console.error(e);
            document.getElementById('ai-content').innerHTML = '<p>Analiz yüklenemedi.</p>';
        }
    }

    function renderRecommendations(data) {
        const container = document.getElementById('ai-content');
        let html = `
            <div class="card">
                <h3>Analiz Özeti</h3>
                <p>${data.analysis}</p>
                <br>
                <h3>Tavsiye</h3>
                <p>${data.advice}</p>
            </div>
        `;

        if(data.recommendations) {
            if(data.recommendations.videos) {
                html += `<div class="card ai-section"><h3>📺 Videolar</h3>`;
                data.recommendations.videos.forEach(v => {
                    html += `<div class="ai-list-item"><a href="${v.url}" target="_blank">${v.title}</a></div>`;
                });
                html += `</div>`;
            }
            if(data.recommendations.locations) {
                html += `<div class="card ai-section"><h3>📍 Geziler</h3>`;
                data.recommendations.locations.forEach(l => {
                    html += `<div class="ai-list-item"><strong>${l.title}:</strong> ${l.description}</div>`;
                });
                html += `</div>`;
            }
        }
        
        container.innerHTML = html;
    }

    async function submitFeedback(activityId, feedback, note) {
        try {
            await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activityId, feedback, note })
            });
        } catch (e) {
            console.error(e);
        }
    }

    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(reg => {
                console.log('SW registered:', reg.scope);
              }).catch(err => console.error('SW registration failed:', err));
        });
    }

    // Initial Fetch
    fetchCurriculum();
    fetchRecommendations();
});
