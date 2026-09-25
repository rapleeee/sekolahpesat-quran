// --- State Aplikasi ---
let allSurahs = [];
let currentSurahData = null;
let currentGameMode = null; // 'tebak' atau 'sambung'
let currentScore = 0;
let detailRequest = 0;
let arabicSize = 2.2;
let readerMode = 'reading';
const AYAT_PER_PAGE = 10;
let currentPage = 1;
let selectedMushafAyah = null;

// --- Elemen DOM ---
const navQuran = document.getElementById('nav-quran');
const navMurajaah = document.getElementById('nav-murajaah');
const viewQuran = document.getElementById('view-quran');
const viewMurajaah = document.getElementById('view-murajaah');
const surahSelect = document.getElementById('surah-select');
const quranContent = document.getElementById('quran-content');

const murajaahSetup = document.getElementById('murajaah-setup');
const murajaahGame = document.getElementById('murajaah-game');
const murajaahSurahInfo = document.getElementById('murajaah-surah-info');
const murajaahModes = document.querySelector('.murajaah-modes');

const btnTebakAyat = document.getElementById('mode-tebak-ayat');
const btnSambungAyat = document.getElementById('mode-sambung-ayat');
const gameTitle = document.getElementById('game-title');
const gameScoreDisplay = document.getElementById('game-score');
const gameQuestion = document.getElementById('game-question');
const gameOptions = document.getElementById('game-options');
const gameFeedback = document.getElementById('game-feedback');
const btnNext = document.getElementById('btn-next');
const btnRestart = document.getElementById('btn-restart');

const API_BASE = 'https://equran.id/api/v2';

// --- Inisialisasi ---
document.addEventListener('DOMContentLoaded', () => {
    setupMurajaahSession();
    setupAudio();
    setupSavedReading();
    setupReaderMode();
    fetchSurahs();
    document.getElementById('show-translation').addEventListener('change', (event) => {
        quranContent.classList.toggle('hide-translations', !event.target.checked);
    });
    const adjustFont = (delta) => {
        arabicSize = Math.round((arabicSize + delta) * 10) / 10;
        document.documentElement.style.setProperty('--arabic-size', `${arabicSize}rem`);
        document.getElementById('font-decrease').disabled = arabicSize <= 1.6;
        document.getElementById('font-increase').disabled = arabicSize >= 3.4;
    };
    document.getElementById('font-decrease').addEventListener('click', () => adjustFont(-0.2));
    document.getElementById('font-increase').addEventListener('click', () => adjustFont(0.2));
    
    // Event Listener Navigasi
    navQuran.addEventListener('click', () => switchTab('quran'));
    navMurajaah.addEventListener('click', () => switchTab('murajaah'));

    surahSelect.addEventListener('click', () => setPickerOpen(surahDropdown.hidden));
    surahSearch.addEventListener('input', renderSurahOptions);
    surahSearch.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            surahResults.querySelector('button')?.focus();
        } else if (event.key === 'Enter') {
            event.preventDefault();
            surahResults.querySelector('button')?.click();
        }
    });
    surahPicker.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            setPickerOpen(false);
            surahSelect.focus();
        }
        const options = Array.from(surahResults.querySelectorAll('button'));
        const index = options.indexOf(document.activeElement);
        if (index >= 0 && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault();
            const next = index + (event.key === 'ArrowDown' ? 1 : -1);
            if (next < 0) surahSearch.focus();
            else options[Math.min(next, options.length - 1)].focus();
        }
    });
    document.addEventListener('click', (event) => {
        if (!surahPicker.contains(event.target)) setPickerOpen(false);
    });
    // Tutup karena perpindahan fokus hanya untuk navigasi keyboard.
    // Browser sentuh dapat memindahkan fokus sebelum click pilihan diproses.
    surahPicker.addEventListener('keydown', (event) => {
        if (event.key !== 'Tab') return;
        setTimeout(() => {
            if (!surahPicker.contains(document.activeElement)) setPickerOpen(false);
        }, 0);
    });

    // Event Listener Mode Game
    btnTebakAyat.addEventListener('click', () => startMurajaah('tebak'));
    btnSambungAyat.addEventListener('click', () => startMurajaah('sambung'));

    // Event Listener Aksi Game
    btnNext.addEventListener('click', nextQuestion);
    btnRestart.addEventListener('click', stopMurajaah);
});

// --- Fungsi Navigasi ---
function switchTab(tab) {
    document.getElementById('quiz-audio').pause();
    setPickerOpen(false);
    if (tab !== 'quran') { stopMemorization(); pauseAudio(); }
    navQuran.removeAttribute('aria-current');
    navMurajaah.removeAttribute('aria-current');
    (tab === 'quran' ? navQuran : navMurajaah).setAttribute('aria-current', 'page');
    if (tab === 'quran') {
        navQuran.classList.add('active');
        navMurajaah.classList.remove('active');
        viewQuran.classList.add('active-view');
        viewMurajaah.classList.remove('active-view');
    } else {
        navQuran.classList.remove('active');
        navMurajaah.classList.add('active');
        viewQuran.classList.remove('active-view');
        viewMurajaah.classList.add('active-view');
        updateMurajaahSetup();
    }
}

const surahPicker = document.getElementById('surah-picker');
const surahDropdown = document.getElementById('surah-dropdown');
const surahSearch = document.getElementById('surah-search');
const surahResults = document.getElementById('surah-results');
const selectedSurah = document.getElementById('selected-surah');

function setPickerOpen(open) {
    surahDropdown.hidden = !open;
    surahSelect.setAttribute('aria-expanded', String(open));
    if (open) {
        surahSearch.value = '';
        renderSurahOptions();
        // Jangan memunculkan keyboard dan menggeser layar saat membuka di HP.
        if (!window.matchMedia?.('(pointer: coarse)').matches) surahSearch.focus();
    }
}

function normalizeSearch(value) {
    return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]/g, '');
}

function renderSurahOptions() {
    const query = normalizeSearch(surahSearch.value);
    const matches = allSurahs.filter(surah =>
        [surah.namaLatin, surah.nama, surah.nomor].some(value => normalizeSearch(value).includes(query))
    );
    surahResults.replaceChildren();
    document.getElementById('search-status').textContent = matches.length
        ? `${matches.length} surat tersedia` : 'Surat tidak ditemukan. Coba nama atau nomor lain.';
    matches.forEach(surah => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'surah-option';
        button.setAttribute('aria-pressed', String(String(surah.nomor) === surahSelect.dataset.value));
        const number = document.createElement('span');
        number.className = 'surah-option-number';
        number.textContent = surah.nomor;
        const description = document.createElement('span');
        description.className = 'surah-option-description';
        const name = document.createElement('strong');
        name.textContent = surah.namaLatin;
        const meta = document.createElement('small');
        meta.textContent = `${surah.jumlahAyat} ayat · ${surah.arti}`;
        description.append(name, meta);
        const arabic = document.createElement('span');
        arabic.className = 'surah-option-arabic';
        arabic.lang = 'ar';
        arabic.dir = 'rtl';
        arabic.textContent = surah.nama;
        button.append(number, description, arabic);
        button.addEventListener('click', () => {
            selectedSurah.textContent = `${surah.nomor}. ${surah.namaLatin}`;
            surahSelect.dataset.value = String(surah.nomor);
            setPickerOpen(false);
            surahSelect.focus();
            fetchSurahDetail(surah.nomor);
        });
        surahResults.appendChild(button);
    });
}

// --- Fungsi API Al-Qur'an ---
async function fetchSurahs() {
    surahSelect.disabled = true;
    selectedSurah.textContent = 'Memuat daftar surat…';
    try {
        const response = await fetch(`${API_BASE}/surat`);
        if (!response.ok) throw new Error('Jaringan bermasalah');
        const result = await response.json();
        if (!Array.isArray(result.data) || !result.data.length) throw new Error('Daftar surat kosong');
        allSurahs = result.data;
        if (!detailRequest) selectedSurah.textContent = 'Cari dan pilih surat';
        surahSelect.disabled = false;
        renderSurahOptions();
        if (!detailRequest) quranContent.innerHTML = '<div class="placeholder-message"><h3>Siap untuk membaca</h3><p>Pilih surat di atas. Ayat dan terjemahannya akan tampil di sini.</p></div>';
    } catch (error) {
        selectedSurah.textContent = 'Daftar surat belum tersedia';
        quranContent.innerHTML = `<div class="error-message" role="alert">Gagal mengambil daftar surat. Periksa koneksi internet Anda.<br><button class="primary-button" id="retry-list">Coba lagi</button></div>`;
        document.getElementById('retry-list').addEventListener('click', () => {
            quranContent.innerHTML = '<div class="loading-message" role="status">Memuat daftar surat...</div>';
            fetchSurahs();
        });
    }
}

async function fetchSurahDetail(nomor, resumeAyah = 1, scrollToStart = false) {
    const request = ++detailRequest;
    clearTimeout(readingTimer);
    resetAudio();
    currentSurahData = null;
    stopMurajaah();
    quranContent.setAttribute('aria-busy', 'true');
    quranContent.innerHTML = `<div class="loading-message" role="status">Memuat surat...</div>`;
    
    try {
        const response = await fetch(`${API_BASE}/surat/${nomor}`);
        if (!response.ok) throw new Error('Jaringan bermasalah');
        const result = await response.json();
        
        if (request !== detailRequest) return;
        currentSurahData = result.data;
        surahSelect.dataset.value = String(nomor);
        selectedSurah.textContent = `${currentSurahData.nomor}. ${currentSurahData.namaLatin}`;
        currentPage = pageForAyah(resumeAyah);
        renderQuranContent();
        updateMurajaahSetup();
        const target = currentSurahData.ayat.find(ayat => ayat.nomorAyat === resumeAyah)?.nomorAyat || 1;
        saveReading(target);
        if (resumeAyah > 1) jumpToAyah(target);
        else if (scrollToStart) {
            quranContent.scrollIntoView({ block: 'start' });
            quranContent.focus({ preventScroll: true });
        }
    } catch (error) {
        if (request !== detailRequest) return;
        quranContent.innerHTML = `<div class="error-message" role="alert">Gagal memuat isi surat. Periksa koneksi internet Anda.<br><button class="primary-button" id="retry-detail">Coba lagi</button></div>`;
        document.getElementById('retry-detail').addEventListener('click', () => fetchSurahDetail(nomor, resumeAyah, scrollToStart));
    } finally {
        if (request === detailRequest) quranContent.setAttribute('aria-busy', 'false');
    }
}

function renderQuranContent(resetPlayer = true) {
    if (!currentSurahData) return;
    const totalPages = Math.ceil(currentSurahData.ayat.length / AYAT_PER_PAGE);
    currentPage = Math.max(1, Math.min(currentPage, totalPages));
    const pageAyat = currentSurahData.ayat.slice((currentPage - 1) * AYAT_PER_PAGE, currentPage * AYAT_PER_PAGE);
    
    let html = `
        <div class="surah-header">
            <span class="surah-arabic" lang="ar" dir="rtl">${currentSurahData.nama}</span><h2>${currentSurahData.namaLatin}</h2>
            <p>${currentSurahData.arti} • ${currentSurahData.jumlahAyat} Ayat</p>
            <p class="page-info">Halaman ${currentPage} dari ${totalPages} · Ayat ${pageAyat[0].nomorAyat}–${pageAyat.at(-1).nomorAyat} · Maks. 10 ayat per halaman</p>
        </div>
    `;

    if (readerMode === 'mushaf') {
        html += '<div id="mushaf-selection" class="mushaf-selection" hidden></div><div class="mushaf-page" lang="ar" dir="rtl">';
        pageAyat.forEach(ayat => {
            const number = String(ayat.nomorAyat).replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[digit]);
            html += `<span class="ayah-card mushaf-ayah" id="ayah-${ayat.nomorAyat}" data-ayah="${ayat.nomorAyat}" tabindex="-1"><span>${ayat.teksArab}</span> <button type="button" class="mushaf-ayah-number" data-ayah="${ayat.nomorAyat}" aria-label="خيارات الآية ${number}" aria-pressed="false">﴿${number}﴾</button></span> `;
        });
        html += '</div>';
    } else pageAyat.forEach(ayat => {
        html += `
            <div class="ayah-card" id="ayah-${ayat.nomorAyat}" data-ayah="${ayat.nomorAyat}" tabindex="-1">
                <div class="ayah-header">
                    <div class="ayah-number">${ayat.nomorAyat}</div>
                    <button type="button" class="audio-button bookmark-button" data-ayah="${ayat.nomorAyat}" aria-pressed="${isBookmarked(ayat.nomorAyat)}" aria-label="Bookmark ayat ${ayat.nomorAyat}">${isBookmarked(ayat.nomorAyat) ? '★ Tersimpan' : '☆ Simpan'}</button>
                    <button type="button" class="audio-button ayah-audio" data-ayah="${ayat.nomorAyat}" aria-label="Putar audio ayat ${ayat.nomorAyat}" aria-pressed="false" ${getAudioUrl(ayat.audio) ? '' : 'disabled'}>${getAudioUrl(ayat.audio) ? '▶ Dengarkan' : 'Audio tidak tersedia'}</button>
                </div>
                <div class="arabic-text" lang="ar" dir="rtl">${ayat.teksArab}</div>
                <div class="translation-text">${ayat.teksIndonesia}</div>
            </div>
        `;
    });

    html += `<div class="page-navigation" aria-label="Navigasi halaman bacaan">
        <button type="button" id="previous-page" class="audio-button" ${currentPage === 1 ? 'disabled' : ''}>← Halaman sebelumnya</button>
        <span role="status">Halaman ${currentPage} / ${totalPages}</span>
        <button type="button" id="next-page" class="audio-button" ${currentPage === totalPages ? 'disabled' : ''}>Halaman berikutnya →</button>
    </div><div class="surah-navigation">`;
    const previousNumber = Number(currentSurahData.nomor) - 1;
    const nextNumber = Number(currentSurahData.nomor) + 1;
    if (previousNumber >= 1) html += '<button type="button" id="previous-surah" class="next-surah-button"><span aria-hidden="true">←</span><span><small>Surat sebelumnya</small><strong id="previous-surah-name"></strong></span></button>';
    if (nextNumber <= 114) html += '<button type="button" id="next-surah" class="next-surah-button"><span><small>Surat berikutnya</small><strong id="next-surah-name"></strong></span><span aria-hidden="true">→</span></button>';
    html += '</div>';
    quranContent.innerHTML = html;
    document.getElementById('previous-page').addEventListener('click', () => changePage(currentPage - 1));
    document.getElementById('next-page').addEventListener('click', () => changePage(currentPage + 1));
    const bindSurahNavigation = (id, number, fallback) => {
        const button = document.getElementById(id);
        if (!button) return;
        const surah = allSurahs.find(item => Number(item.nomor) === number) || fallback;
        document.getElementById(`${id}-name`).textContent = surah?.namaLatin || `Surat ${number}`;
        button.addEventListener('click', () => {
            fetchSurahDetail(number, 1, true);
            scrollToReadingStart();
        });
    };
    if (previousNumber >= 1) bindSurahNavigation('previous-surah', previousNumber, currentSurahData.suratSebelumnya);
    if (nextNumber <= 114) bindSurahNavigation('next-surah', nextNumber, currentSurahData.suratSelanjutnya);
    quranContent.classList.toggle('mushaf-mode', readerMode === 'mushaf');
    if (resetPlayer) {
        selectedMushafAyah = null;
        prepareSurahAudio();
    } else {
        if (readerMode === 'mushaf' && selectedMushafAyah) showMushafSelection(selectedMushafAyah);
        syncAudioButtons();
    }
}

// --- Fungsi Mentor Murajaah ---
function updateMurajaahSetup() {
    if (!currentSurahData) {
        murajaahSurahInfo.textContent = "Pilih surat di menu Al-Qur'an terlebih dahulu.";
        murajaahSurahInfo.style.color = "inherit";
        murajaahModes.style.display = 'none';
    } else {
        const jumlahAyat = currentSurahData.ayat.length;
        if (jumlahAyat < 4) {
            murajaahSurahInfo.textContent = `Surat ${currentSurahData.namaLatin} hanya memiliki ${jumlahAyat} ayat. Pilih surat dengan minimal 4 ayat untuk bermain.`;
            murajaahSurahInfo.style.color = "var(--wrong)";
            murajaahModes.style.display = 'none';
        } else {
            murajaahSurahInfo.textContent = `Surat Terpilih: ${currentSurahData.namaLatin}`;
            murajaahSurahInfo.style.color = "var(--primary-dark)";
            murajaahModes.style.display = 'flex';
        }
    }
}

let quizSession = null;

function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function startMurajaah(mode, reviewQuestions = null) {
    if (!currentSurahData || currentSurahData.ayat.length < 4) return;
    stopMemorization();
    pauseAudio();
    currentGameMode = mode;
    currentScore = 0;
    const count = currentSurahData.ayat.length - (mode !== 'tebak' ? 1 : 0);
    const pool = Array.from({ length: count }, (_, index) => index).filter(index => mode !== 'audio' || getAudioUrl(currentSurahData.ayat[index].audio));
    if (!pool.length) {
        murajaahSurahInfo.textContent = 'Audio belum tersedia untuk qari ini. Pilih qari lain di menu Al-Qur’an.';
        return;
    }
    let questions = reviewQuestions ? shuffle(reviewQuestions.filter(index => pool.includes(index))) : [];
    if (!reviewQuestions) {
        // Habiskan satu putaran ayat sebelum mengulang pada surat pendek.
        while (questions.length < 10) {
            questions.push(...shuffle(pool));
        }
        questions = questions.slice(0, 10);
    }
    if (!questions.length) return;
    quizSession = { questions, answers: [], index: -1, answered: true, review: Boolean(reviewQuestions), finished: false, heard: false, qariName: document.getElementById('qari-select').selectedOptions?.[0]?.textContent || 'pilihan saat sesi dimulai', audioUrls: currentSurahData.ayat.map(ayat => getAudioUrl(ayat.audio)) };
    gameScoreDisplay.textContent = '0';
    murajaahSetup.style.display = 'none';
    murajaahGame.style.display = 'block';
    document.getElementById('murajaah-results').hidden = true;
    gameTitle.textContent = `${reviewQuestions ? 'Ulangi · ' : ''}${mode === 'tebak' ? 'Tebak Nomor Ayat' : mode === 'audio' ? 'Sambung dari Audio' : 'Sambung Ayat'}`;
    nextQuestion();
}

function stopMurajaah() {
    resetQuizAudio();
    quizSession = null;
    murajaahSetup.style.display = 'block';
    murajaahGame.style.display = 'none';
    document.getElementById('murajaah-results').hidden = true;
    updateMurajaahSetup();
}

function updateQuizProgress() {
    const session = quizSession;
    document.getElementById('session-progress').textContent = `Soal ${session.index + 1} dari ${session.questions.length} · ${session.answers.length} terjawab`;
    const bar = document.getElementById('session-progress-bar');
    bar.max = session.questions.length;
    bar.value = session.answers.length;
}

function nextQuestion() {
    const session = quizSession;
    if (!session || session.finished || !session.answered) return;
    if (session.index + 1 >= session.questions.length) {
        showQuizResults();
        return;
    }
    session.index++;
    session.answered = false;
    gameFeedback.textContent = '';
    btnNext.style.display = 'none';
    gameOptions.replaceChildren();
    const index = session.questions[session.index];
    const ayat = currentSurahData.ayat[index];
    const answer = currentGameMode === 'tebak' ? ayat : currentSurahData.ayat[index + 1];
    const isArabic = currentGameMode !== 'tebak';
    const correct = isArabic ? answer.teksArab : answer.nomorAyat;
    const distractors = [...new Set(currentSurahData.ayat.map(item => isArabic ? item.teksArab : item.nomorAyat))].filter(value => value !== correct);
    session.correct = correct;
    session.answerAyah = answer.nomorAyat;
    resetQuizAudio();
    const audioMode = currentGameMode === 'audio';
    session.heard = false;
    gameQuestion.hidden = audioMode;
    gameQuestion.textContent = audioMode ? '' : ayat.teksArab;
    document.getElementById('quiz-audio-panel').hidden = !audioMode;
    if (audioMode) {
        document.getElementById('quiz-audio').src = session.audioUrls[index];
        document.getElementById('quiz-qari').textContent = `Qari: ${session.qariName}`;
    }
    renderOptions(shuffle([correct, ...shuffle(distractors).slice(0, 2)]), correct, isArabic);
    updateQuizProgress();
    (audioMode ? document.getElementById('quiz-audio-title') : gameQuestion).focus({ preventScroll: true });
}

function renderOptions(optionsArray, correctAnswer, isArabic) {
    optionsArray.forEach(optionValue => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'option-btn';
        btn.disabled = currentGameMode === 'audio' && !quizSession.heard;
        if (isArabic) {
            btn.classList.add('arabic-option');
            btn.lang = 'ar';
        }
        btn.textContent = optionValue;
        btn.addEventListener('click', () => handleAnswer(btn, optionValue, correctAnswer));
        gameOptions.appendChild(btn);
    });
}

function handleAnswer(btn, selectedValue, correctAnswer) {
    const session = quizSession;
    if (!session || session.finished || session.answered) return;
    if (currentGameMode === 'audio' && !session.heard) return;
    document.getElementById('quiz-audio').pause();
    gameQuestion.hidden = false;
    gameQuestion.textContent = currentSurahData.ayat[session.questions[session.index]].teksArab;
    session.answered = true;
    const correct = String(selectedValue) === String(session.correct);
    session.answers.push({ index: session.questions[session.index], correct, selected: selectedValue, expected: session.correct, answerAyah: session.answerAyah });
    const buttons = gameOptions.querySelectorAll('.option-btn');
    buttons.forEach(button => {
        button.disabled = true;
        if (String(button.textContent) === String(session.correct)) button.classList.add('correct');
    });
    if (correct) {
        currentScore += 10;
        gameFeedback.textContent = 'Benar! +10 poin.';
        gameFeedback.style.color = 'var(--correct)';
    } else {
        btn.classList.add('wrong');
        gameFeedback.textContent = `Belum tepat. Jawaban benar: ayat ${session.answerAyah}.`;
        gameFeedback.style.color = 'var(--wrong)';
    }
    gameScoreDisplay.textContent = currentScore;
    updateQuizProgress();
    btnNext.textContent = session.index === session.questions.length - 1 ? 'Lihat evaluasi →' : 'Soal berikutnya →';
    btnNext.style.display = 'block';
}

function showQuizResults() {
    const session = quizSession;
    if (!session || session.answers.length !== session.questions.length) return;
    resetQuizAudio();
    session.finished = true;
    const wrong = session.answers.filter(answer => !answer.correct);
    const correct = session.answers.length - wrong.length;
    murajaahGame.style.display = 'none';
    document.getElementById('murajaah-results').hidden = false;
    document.getElementById('results-title').textContent = session.review ? 'Latihan ulang selesai' : 'Sesi 10 soal selesai';
    document.getElementById('results-context').textContent = `${currentSurahData.namaLatin} · ${currentGameMode === 'tebak' ? 'Tebak nomor ayat' : currentGameMode === 'audio' ? 'Sambung dari audio' : 'Sambung ayat'} · Skor ${currentScore}/${session.questions.length * 10}`;
    document.getElementById('result-correct').textContent = correct;
    document.getElementById('result-wrong').textContent = wrong.length;
    document.getElementById('result-accuracy').textContent = `${Math.round(correct / session.answers.length * 100)}%`;
    document.getElementById('result-advice').textContent = wrong.length
        ? 'Baca kembali jawaban di bawah, lalu ulangi soal yang belum tepat. Soal yang sama hanya diulang sekali dalam sesi perbaikan.'
        : 'Alhamdulillah, semua jawaban tepat. Kamu bisa melanjutkan dengan sesi baru atau mencoba mode lainnya.';
    document.getElementById('retry-mistakes').hidden = !wrong.length;
    const list = document.getElementById('mistake-list');
    list.replaceChildren();
    const uniqueWrong = [...new Map(wrong.map(answer => [answer.index, answer])).values()];
    uniqueWrong.forEach(answer => {
        const item = document.createElement('article');
        item.className = 'mistake-card';
        const title = document.createElement('h3');
        title.textContent = currentGameMode === 'tebak' ? `Kenali ayat ${answer.answerAyah}` : `Lanjutan ayat ${currentSurahData.ayat[answer.index].nomorAyat}: ayat ${answer.answerAyah}`;
        const picked = document.createElement('p');
        picked.textContent = `Jawabanmu: ${answer.selected}`;
        if (currentGameMode !== 'tebak') {
            picked.textContent = answer.selected;
            picked.lang = 'ar';
            picked.className = 'arabic-text mistake-answer';
            const label = document.createElement('p');
            label.textContent = 'Jawabanmu:';
            item.append(title, label, picked);
        } else item.append(title, picked);
        const label = document.createElement('p');
        label.textContent = `Jawaban benar · Ayat ${answer.answerAyah}`;
        const text = document.createElement('p');
        text.className = 'arabic-text';
        text.lang = 'ar';
        text.textContent = currentSurahData.ayat.find(ayat => ayat.nomorAyat === answer.answerAyah).teksArab;
        item.append(label, text);
        list.appendChild(item);
    });
    document.getElementById('results-title').focus();
}

function setupMurajaahSession() {
    document.getElementById('mode-audio-ayat').addEventListener('click', () => startMurajaah('audio'));
    const player = document.getElementById('quiz-audio');
    player.addEventListener('timeupdate', () => {
        if (!quizSession || quizSession.finished || quizSession.answered || currentGameMode !== 'audio' || player.currentTime <= 0) return;
        quizSession.heard = true;
        gameOptions.querySelectorAll('.option-btn').forEach(button => button.disabled = false);
        document.getElementById('quiz-audio-status').textContent = 'Pilih ayat lanjutannya. Audio dapat didengarkan kembali.';
    });
    player.addEventListener('error', () => {
        if (!quizSession || quizSession.finished || currentGameMode !== 'audio' || !player.error) return;
        document.getElementById('quiz-audio-status').textContent = 'Audio gagal dimuat. Periksa koneksi lalu muat ulang audio, atau kembali ke pilihan latihan.';
        document.getElementById('retry-quiz-audio').hidden = false;
    });
    document.getElementById('retry-quiz-audio').addEventListener('click', () => {
        if (!quizSession || quizSession.finished || currentGameMode !== 'audio') return;
        player.load();
        document.getElementById('retry-quiz-audio').hidden = true;
        document.getElementById('quiz-audio-status').textContent = 'Tekan play untuk mencoba kembali.';
    });
    document.getElementById('retry-mistakes').addEventListener('click', () => {
        if (!quizSession?.finished) return;
        const questions = [...new Set(quizSession.answers.filter(answer => !answer.correct).map(answer => answer.index))];
        if (questions.length) startMurajaah(currentGameMode, questions);
    });
    document.getElementById('new-session').addEventListener('click', () => startMurajaah(currentGameMode));
    document.getElementById('results-back').addEventListener('click', stopMurajaah);
}

// Satu pemutar digunakan bersama agar audio surat dan ayat tidak bertumpuk.
const quranAudio = document.getElementById('quran-audio');
const audioPanel = document.getElementById('audio-panel');
const audioTitle = document.getElementById('audio-title');
const audioStatus = document.getElementById('audio-status');
const playSurah = document.getElementById('play-surah');
let audioTarget = null;
let audioOperation = 0;

function getAudioUrl(sources) {
    // Jangan berpindah qari diam-diam jika rekamannya tidak tersedia.
    const url = sources?.[document.getElementById('qari-select').value];
    return typeof url === 'string' && /^https:\/\//.test(url) ? url : '';
}

function syncAudioButtons() {
    const playing = !quranAudio.paused && !quranAudio.ended;
    quranContent.querySelectorAll('.ayah-audio').forEach(button => {
        const active = audioTarget === Number(button.dataset.ayah) && playing;
        button.setAttribute('aria-pressed', String(active));
        button.setAttribute('aria-label', `${active ? 'Jeda' : 'Putar'} audio ayat ${button.dataset.ayah}`);
        if (!button.disabled) button.textContent = active ? 'Ⅱ Jeda' : '▶ Dengarkan';
    });
    quranContent.querySelectorAll('.ayah-card').forEach(card => {
        card.classList.toggle('is-playing', Number(card.dataset.ayah) === audioTarget && playing);
    });
    const fullPlaying = audioTarget === 'full' && playing;
    playSurah.textContent = fullPlaying ? 'Ⅱ Jeda surat' : '▶ Putar surat lengkap';
    playSurah.setAttribute('aria-pressed', String(fullPlaying));
}

function pauseAudio() {
    audioOperation++;
    quranAudio.pause();
    syncAudioButtons();
}

function resetAudio() {
    stopMemorization();
    pauseAudio();
    audioTarget = null;
    quranAudio.removeAttribute('src');
    quranAudio.load();
    audioPanel.hidden = true;
}

function prepareSurahAudio() {
    const url = getAudioUrl(currentSurahData.audioFull);
    const hasAyahAudio = currentSurahData.ayat.some(ayat => getAudioUrl(ayat.audio));
    audioPanel.hidden = false;
    playSurah.disabled = !url;
    quranAudio.hidden = !url && !hasAyahAudio;
    audioTitle.textContent = `${currentSurahData.namaLatin} · Surat lengkap`;
    audioStatus.textContent = url ? 'Tekan play untuk mendengarkan.'
        : hasAyahAudio ? 'Pilih tombol Dengarkan pada ayat di bawah.' : 'Audio untuk surat ini belum tersedia.';
    if (url) {
        audioTarget = 'full';
        quranAudio.src = url;
    }
    const lastAyah = currentSurahData.ayat.at(-1).nomorAyat;
    document.getElementById('range-start').max = lastAyah;
    document.getElementById('range-end').max = lastAyah;
    document.getElementById('range-start').value = 1;
    document.getElementById('range-end').value = Math.min(3, lastAyah);
    syncAudioButtons();
}

async function playAudio(target, fromSession = false) {
    if (!fromSession) stopMemorization();
    if (!currentSurahData) return;
    const sources = target === 'full' ? currentSurahData.audioFull
        : currentSurahData.ayat.find(ayat => ayat.nomorAyat === target)?.audio;
    const url = getAudioUrl(sources);
    if (!url) {
        stopMemorization('Audio tidak tersedia untuk qari dan ayat ini.');
        audioStatus.textContent = 'Audio belum tersedia untuk pilihan ini.';
        return;
    }
    if (audioTarget === target && !quranAudio.paused) {
        pauseAudio();
        return;
    }
    if (typeof target === 'number') ensureAyahPage(target);
    const operation = ++audioOperation;
    if (quranAudio.ended) quranAudio.currentTime = 0;
    if (audioTarget !== target || quranAudio.error) {
        quranAudio.pause();
        quranAudio.src = url;
        audioTarget = target;
    }
    audioTitle.textContent = `${currentSurahData.namaLatin} · ${target === 'full' ? 'Surat lengkap' : `Ayat ${target}`}`;
    audioStatus.textContent = 'Memuat audio…';
    try {
        await quranAudio.play();
    } catch (error) {
        if (operation !== audioOperation || error.name === 'AbortError') return;
        stopMemorization('Hafalan dihentikan karena audio gagal diputar.');
        audioStatus.textContent = 'Audio gagal diputar. Periksa koneksi, lalu tekan Putar atau Dengarkan untuk mencoba lagi.';
    }
    if (operation === audioOperation) syncAudioButtons();
}

function setupAudio() {
    document.getElementById('qari-select').addEventListener('change', () => {
        resetAudio();
        if (currentSurahData) {
            prepareSurahAudio();
            quranContent.querySelectorAll('.ayah-audio').forEach(button => {
                const ayat = currentSurahData.ayat.find(item => item.nomorAyat === Number(button.dataset.ayah));
                button.disabled = !getAudioUrl(ayat.audio);
                button.textContent = button.disabled ? 'Audio tidak tersedia' : '▶ Dengarkan';
            });
        }
    });
    document.getElementById('start-memorization').addEventListener('click', startMemorization);
    document.getElementById('stop-memorization').addEventListener('click', () => {
        stopMemorization('Hafalan dihentikan.');
        pauseAudio();
    });
    playSurah.addEventListener('click', () => playAudio('full'));
    quranContent.addEventListener('click', event => {
        const button = event.target.closest('.ayah-audio');
        if (button && !button.disabled) playAudio(Number(button.dataset.ayah));
    });
    quranAudio.addEventListener('playing', () => {
        audioStatus.textContent = 'Sedang diputar.';
        syncAudioButtons();
    });
    quranAudio.addEventListener('pause', () => {
        if (audioTarget !== null) audioStatus.textContent = 'Audio dijeda. Tekan play untuk melanjutkan.';
        syncAudioButtons();
    });
    quranAudio.addEventListener('waiting', () => {
        if (audioTarget !== null) audioStatus.textContent = 'Memuat audio…';
    });
    quranAudio.addEventListener('ended', () => {
        if (advanceMemorization()) return;
        audioStatus.textContent = 'Audio selesai diputar.';
        syncAudioButtons();
    });
    quranAudio.addEventListener('error', () => {
        if (audioTarget === null || !quranAudio.error) return;
        stopMemorization('Hafalan dihentikan karena audio gagal dimuat.');
        audioStatus.textContent = 'Audio gagal dimuat. Periksa koneksi, lalu tekan Putar atau Dengarkan untuk mencoba lagi.';
        syncAudioButtons();
    });
}


let memorization = null;
function stopMemorization(message = '') {
    memorization = null;
    document.getElementById('stop-memorization').disabled = true;
    document.getElementById('memorization-status').textContent = message;
}

function startMemorization() {
    if (!currentSurahData) return;
    const start = Number(document.getElementById('range-start').value);
    const end = Number(document.getElementById('range-end').value);
    const repeats = Number(document.getElementById('range-repeat').value);
    const last = currentSurahData.ayat.at(-1).nomorAyat;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end > last || start > end || ![1, 3, 5, 10].includes(repeats)) {
        document.getElementById('memorization-status').textContent = `Pilih rentang ayat 1–${last}, dengan ayat awal tidak melebihi ayat akhir.`;
        return;
    }
    if (currentSurahData.ayat.some(ayat => ayat.nomorAyat >= start && ayat.nomorAyat <= end && !getAudioUrl(ayat.audio))) {
        document.getElementById('memorization-status').textContent = 'Audio rentang ini belum lengkap untuk qari yang dipilih.';
        return;
    }
    pauseAudio();
    quranAudio.currentTime = 0;
    memorization = { start, end, repeats, cycle: 1, ayah: start };
    document.getElementById('stop-memorization').disabled = false;
    playMemorizationAyah();
}

function playMemorizationAyah() {
    const session = memorization;
    document.getElementById('memorization-status').textContent = `Putaran ${session.cycle}/${session.repeats} · Ayat ${session.ayah} · Rentang ${session.start}–${session.end}`;
    playAudio(session.ayah, true);
}

function advanceMemorization() {
    if (!memorization) return false;
    if (memorization.ayah < memorization.end) memorization.ayah++;
    else if (memorization.cycle < memorization.repeats) {
        memorization.cycle++;
        memorization.ayah = memorization.start;
    } else {
        stopMemorization('Alhamdulillah, semua pengulangan selesai.');
        return false;
    }
    playMemorizationAyah();
    return true;
}

const READING_KEY = 'quran-pesat-reading-v1';
let savedReading = { last: null, bookmarks: [] };
let readingTimer;
function validSavedAyah(item) {
    return item && Number.isInteger(item.surah) && item.surah >= 1 && item.surah <= 114
        && Number.isInteger(item.ayah) && item.ayah >= 1 && item.ayah <= 286 && typeof item.name === 'string';
}
function persistReading() {
    try {
        localStorage.setItem(READING_KEY, JSON.stringify(savedReading));
    } catch {
        document.getElementById('storage-status').textContent = 'Penyimpanan browser tidak tersedia. Data hanya tersimpan selama halaman ini terbuka.';
    }
    renderSavedReading();
}
function saveReading(ayah) {
    if (!currentSurahData) return;
    savedReading.last = { surah: currentSurahData.nomor, name: currentSurahData.namaLatin, ayah };
    persistReading();
}
function isBookmarked(ayah) {
    return savedReading.bookmarks.some(item => item.surah === currentSurahData.nomor && item.ayah === ayah);
}
function jumpToAyah(ayah) {
    ensureAyahPage(ayah);
    const card = document.getElementById(`ayah-${ayah}`);
    card?.scrollIntoView({ block: 'start' });
    card?.focus({ preventScroll: true });
}
function openSavedAyah(item) {
    switchTab('quran');
    if (currentSurahData?.nomor === item.surah) {
        jumpToAyah(item.ayah);
        saveReading(item.ayah);
    } else fetchSurahDetail(item.surah, item.ayah);
}
function renderSavedReading() {
    const resume = document.getElementById('resume-reading');
    resume.hidden = !savedReading.last;
    if (savedReading.last) resume.textContent = `Lanjutkan ${savedReading.last.name} · Ayat ${savedReading.last.ayah}`;
    const list = document.getElementById('bookmark-list');
    list.replaceChildren();
    document.getElementById('bookmark-count').textContent = savedReading.bookmarks.length;
    if (!savedReading.bookmarks.length) list.textContent = 'Belum ada bookmark. Tekan ☆ Simpan pada ayat.';
    savedReading.bookmarks.forEach(item => {
        const row = document.createElement('div');
        row.className = 'bookmark-row';
        const open = document.createElement('button');
        open.className = 'audio-button';
        open.textContent = `${item.name} · Ayat ${item.ayah}`;
        open.addEventListener('click', () => openSavedAyah(item));
        const remove = document.createElement('button');
        remove.className = 'audio-button';
        remove.textContent = 'Hapus';
        remove.setAttribute('aria-label', `Hapus bookmark ${item.name} ayat ${item.ayah}`);
        remove.addEventListener('click', () => {
            savedReading.bookmarks = savedReading.bookmarks.filter(entry => entry !== item);
            persistReading();
            syncBookmarks();
        });
        row.append(open, remove);
        list.appendChild(row);
    });
}
function syncBookmarks() {
    quranContent.querySelectorAll('.bookmark-button').forEach(button => {
        const saved = isBookmarked(Number(button.dataset.ayah));
        button.setAttribute('aria-pressed', String(saved));
        button.textContent = saved ? '★ Tersimpan' : '☆ Simpan';
    });
}
function trackReading() {
    clearTimeout(readingTimer);
    readingTimer = setTimeout(() => {
        if (!currentSurahData || !viewQuran.classList.contains('active-view')) return;
        const cards = Array.from(quranContent.querySelectorAll('.ayah-card'));
        const visible = cards.find(card => {
            const rect = card.getBoundingClientRect();
            return rect.bottom > 100 && rect.top < window.innerHeight;
        });
        if (visible && savedReading.last?.ayah !== Number(visible.dataset.ayah)) saveReading(Number(visible.dataset.ayah));
    }, 250);
}
function setupSavedReading() {
    try {
        const stored = JSON.parse(localStorage.getItem(READING_KEY));
        if (stored) savedReading = {
            last: validSavedAyah(stored.last) ? stored.last : null,
            bookmarks: Array.isArray(stored.bookmarks) ? stored.bookmarks.filter(validSavedAyah) : []
        };
    } catch {
        document.getElementById('storage-status').textContent = 'Data tersimpan tidak dapat dibaca. Bookmark baru tetap bisa digunakan.';
    }
    renderSavedReading();
    document.getElementById('resume-reading').addEventListener('click', () => {
        if (savedReading.last) openSavedAyah(savedReading.last);
    });
    quranContent.addEventListener('click', event => {
        const button = event.target.closest('.bookmark-button');
        if (!button || !currentSurahData) return;
        const ayah = Number(button.dataset.ayah);
        if (isBookmarked(ayah)) savedReading.bookmarks = savedReading.bookmarks.filter(item => item.surah !== currentSurahData.nomor || item.ayah !== ayah);
        else savedReading.bookmarks.push({ surah: currentSurahData.nomor, name: currentSurahData.namaLatin, ayah });
        persistReading();
        syncBookmarks();
    });
    window.addEventListener('scroll', trackReading, { passive: true });
}


function setReaderMode(mode, persist = true) {
    const currentCard = currentSurahData && Array.from(quranContent.querySelectorAll('.ayah-card')).find(card => {
        const rect = card.getBoundingClientRect();
        return rect.bottom > 100 && rect.top < window.innerHeight;
    });
    const anchor = currentCard?.dataset.ayah;
    readerMode = mode === 'mushaf' ? 'mushaf' : 'reading';
    document.getElementById('mode-reading').setAttribute('aria-pressed', String(readerMode === 'reading'));
    document.getElementById('mode-mushaf').setAttribute('aria-pressed', String(readerMode === 'mushaf'));
    document.getElementById('reader-mode-hint').textContent = readerMode === 'mushaf'
        ? 'Ayat Arab menyambung. Tekan nomor ayat untuk audio, bookmark, dan terjemahan. Halaman menyesuaikan layar.'
        : 'Ayat dan terjemahan ditampilkan per bagian.';
    if (currentSurahData) {
        renderQuranContent(false);
        if (anchor) jumpToAyah(Number(anchor));
    }
    if (persist) {
        try { localStorage.setItem('quran-pesat-view-v1', readerMode); } catch { /* Mode tetap berlaku untuk sesi ini. */ }
    }
}

function showMushafSelection(number) {
    const ayat = currentSurahData?.ayat.find(item => item.nomorAyat === number);
    const panel = document.getElementById('mushaf-selection');
    if (!ayat || !panel) return;
    selectedMushafAyah = number;
    panel.hidden = false;
    panel.innerHTML = `<div class="mushaf-selection-actions"><strong>Ayat ${number}</strong>
        <button type="button" class="audio-button ayah-audio" data-ayah="${number}" aria-label="Putar audio ayat ${number}" ${getAudioUrl(ayat.audio) ? '' : 'disabled'}>${getAudioUrl(ayat.audio) ? '▶ Dengarkan' : 'Audio tidak tersedia'}</button>
        <button type="button" class="audio-button bookmark-button" data-ayah="${number}" aria-label="Bookmark ayat ${number}"></button>
        <button type="button" class="audio-button" id="close-mushaf-selection" aria-label="Tutup pilihan ayat">Tutup</button></div>
        <div class="translation-text"></div>`;
    panel.querySelector('.translation-text').textContent = ayat.teksIndonesia;
    quranContent.querySelectorAll('.mushaf-ayah-number').forEach(button => {
        button.setAttribute('aria-pressed', String(Number(button.dataset.ayah) === number));
    });
    document.getElementById('close-mushaf-selection').addEventListener('click', () => {
        panel.hidden = true;
        selectedMushafAyah = null;
        const trigger = quranContent.querySelector(`.mushaf-ayah-number[data-ayah="${number}"]`);
        trigger?.setAttribute('aria-pressed', 'false');
        trigger?.focus({ preventScroll: true });
    });
    syncBookmarks();
    syncAudioButtons();
    saveReading(number);
}

function setupReaderMode() {
    let stored;
    try { stored = localStorage.getItem('quran-pesat-view-v1'); } catch { /* Penyimpanan opsional. */ }
    setReaderMode(stored, false);
    document.getElementById('mode-reading').addEventListener('click', () => setReaderMode('reading'));
    document.getElementById('mode-mushaf').addEventListener('click', () => setReaderMode('mushaf'));
    quranContent.addEventListener('click', event => {
        const button = event.target.closest('.mushaf-ayah-number');
        if (button) {
            showMushafSelection(Number(button.dataset.ayah));
            document.getElementById('mushaf-selection').querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
        }
    });
}


function pageForAyah(ayah) {
    const index = currentSurahData?.ayat.findIndex(item => item.nomorAyat === ayah) ?? -1;
    return index < 0 ? 1 : Math.floor(index / AYAT_PER_PAGE) + 1;
}

function scrollToReadingStart() {
    quranContent.scrollIntoView({ block: 'start' });
    quranContent.focus({ preventScroll: true });
}

function changePage(page, scroll = true) {
    if (!currentSurahData || !Number.isInteger(page)) return;
    const total = Math.ceil(currentSurahData.ayat.length / AYAT_PER_PAGE);
    if (page < 1 || page > total || page === currentPage) return;
    clearTimeout(readingTimer);
    currentPage = page;
    selectedMushafAyah = null;
    renderQuranContent(false);
    saveReading(currentSurahData.ayat[(page - 1) * AYAT_PER_PAGE].nomorAyat);
    if (scroll) scrollToReadingStart();
}

function ensureAyahPage(ayah) {
    const page = pageForAyah(ayah);
    if (page !== currentPage) changePage(page, false);
}


function resetQuizAudio() {
    const player = document.getElementById('quiz-audio');
    player.pause();
    player.removeAttribute('src');
    player.load();
    document.getElementById('quiz-audio-panel').hidden = true;
    document.getElementById('retry-quiz-audio').hidden = true;
    document.getElementById('quiz-audio-status').textContent = 'Tekan play untuk mendengarkan. Pilihan jawaban terbuka setelah audio mulai terdengar.';
}
