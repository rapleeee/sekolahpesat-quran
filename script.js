// --- State Aplikasi ---
let allSurahs = [];
let currentSurahData = null;
let currentGameMode = null; // 'tebak' atau 'sambung'
let currentScore = 0;

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
    fetchSurahs();
    
    // Event Listener Navigasi
    navQuran.addEventListener('click', () => switchTab('quran'));
    navMurajaah.addEventListener('click', () => switchTab('murajaah'));

    // Event Listener Pilihan Surat
    surahSelect.addEventListener('change', (e) => {
        const surahNomor = e.target.value;
        if (surahNomor) {
            fetchSurahDetail(surahNomor);
        }
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

// --- Fungsi API Al-Qur'an ---
async function fetchSurahs() {
    try {
        const response = await fetch(`${API_BASE}/surat`);
        if (!response.ok) throw new Error('Jaringan bermasalah');
        const result = await response.json();
        
        allSurahs = result.data;
        
        // Isi dropdown
        surahSelect.innerHTML = '<option value="" disabled selected>-- Pilih Surat --</option>';
        allSurahs.forEach(surah => {
            const option = document.createElement('option');
            option.value = surah.nomor;
            option.textContent = `${surah.nomor}. ${surah.namaLatin} (${surah.jumlahAyat} ayat)`;
            surahSelect.appendChild(option);
        });
    } catch (error) {
        surahSelect.innerHTML = '<option value="" disabled selected>Gagal memuat surat</option>';
        quranContent.innerHTML = `<div class="error-message">Gagal mengambil daftar surat. Periksa koneksi internet Anda.</div>`;
    }
}

async function fetchSurahDetail(nomor) {
    quranContent.innerHTML = `<div class="loading-message">Memuat surat...</div>`;
    currentSurahData = null; // Reset data surat saat ini
    
    try {
        const response = await fetch(`${API_BASE}/surat/${nomor}`);
        if (!response.ok) throw new Error('Jaringan bermasalah');
        const result = await response.json();
        
        currentSurahData = result.data;
        renderQuranContent();
    } catch (error) {
        quranContent.innerHTML = `<div class="error-message">Gagal memuat isi surat. Periksa koneksi internet Anda.</div>`;
    }
}

function renderQuranContent() {
    if (!currentSurahData) return;
    
    let html = `
        <div class="surah-header">
            <h2>${currentSurahData.namaLatin} (${currentSurahData.nama})</h2>
            <p>${currentSurahData.arti} • ${currentSurahData.jumlahAyat} Ayat</p>
        </div>
    `;

    currentSurahData.ayat.forEach(ayat => {
        html += `
            <div class="ayah-card">
                <div class="ayah-header">
                    <div class="ayah-number">${ayat.nomorAyat}</div>
                </div>
                <div class="arabic-text">${ayat.teksArab}</div>
                <div class="translation-text">${ayat.teksIndonesia}</div>
            </div>
        `;
    });

    quranContent.innerHTML = html;
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

function startMurajaah(mode) {
    currentGameMode = mode;
    currentScore = 0;
    gameScoreDisplay.textContent = currentScore;
    
    murajaahSetup.style.display = 'none';
    murajaahGame.style.display = 'block';
    
    if (mode === 'tebak') {
        gameTitle.textContent = "Tebak Nomor Ayat";
    } else {
        gameTitle.textContent = "Sambung Ayat";
    }
    
    nextQuestion();
}

function stopMurajaah() {
    murajaahSetup.style.display = 'block';
    murajaahGame.style.display = 'none';
    updateMurajaahSetup();
}

// FUNGSI INTI: Membuat soal, mencari opsi benar, dan membuat pengecoh
function nextQuestion() {
    gameFeedback.textContent = "";
    btnNext.style.display = 'none';
    gameOptions.innerHTML = "";
    
    const ayatList = currentSurahData.ayat;
    let targetAyatIndex;
    
    if (currentGameMode === 'tebak') {
        // Mode Tebak Nomor Ayat
        // 1. Pilih satu ayat acak sebagai soal
        targetAyatIndex = Math.floor(Math.random() * ayatList.length);
        const correctAyat = ayatList[targetAyatIndex];
        const correctNumber = correctAyat.nomorAyat;
        
        // Tampilkan teks arab sebagai soal
        gameQuestion.textContent = correctAyat.teksArab;
        
        // 2. Buat opsi (Set digunakan agar tidak ada duplikat)
        const options = new Set();
        options.add(correctNumber); // Masukkan jawaban benar
        
        // 3. Cari 2 pengecoh (jawaban salah)
        while (options.size < 3) {
            const randomAyat = ayatList[Math.floor(Math.random() * ayatList.length)];
            options.add(randomAyat.nomorAyat);
        }
        
        renderOptions(Array.from(options), correctNumber, false);
        
    } else if (currentGameMode === 'sambung') {
        // Mode Sambung Ayat
        // 1. Pilih ayat acak (tidak boleh ayat terakhir agar ada sambungannya)
        targetAyatIndex = Math.floor(Math.random() * (ayatList.length - 1));
        const currentAyat = ayatList[targetAyatIndex];
        
        // Jawaban yang benar adalah teks arab dari ayat TEPAT setelahnya
        const correctNextAyat = ayatList[targetAyatIndex + 1];
        const correctText = correctNextAyat.teksArab;
        
        // Tampilkan ayat saat ini sebagai soal
        gameQuestion.textContent = currentAyat.teksArab;
        
        // 2. Buat opsi (Set agar tidak ada duplikat teks)
        const options = new Set();
        options.add(correctText); // Masukkan jawaban benar
        
        // 3. Cari 2 pengecoh dari ayat lain di surat yang sama
        let attempts = 0; // Mencegah infinite loop (meski jarang terjadi)
        while (options.size < 3 && attempts < 50) {
            const randomAyat = ayatList[Math.floor(Math.random() * ayatList.length)];
            
            // Pengecoh tidak boleh berupa jawaban yang benar (teksnya persis)
            if (randomAyat.teksArab !== correctText) {
                options.add(randomAyat.teksArab);
            }
            attempts++;
        }
        
        renderOptions(Array.from(options), correctText, true);
    }
}

// Menampilkan tombol-tombol pilihan ke layar
function renderOptions(optionsArray, correctAnswer, isArabic) {
    // Acak urutan opsi agar jawaban benar tidak selalu di posisi yang sama
    optionsArray.sort(() => Math.random() - 0.5);
    
    optionsArray.forEach(optionValue => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        if (isArabic) {
            btn.classList.add('arabic-option');
        }
        btn.textContent = optionValue;
        
        // Saat ditekan, periksa jawaban
        btn.addEventListener('click', () => handleAnswer(btn, optionValue, correctAnswer));
        
        gameOptions.appendChild(btn);
    });
}

// Memeriksa jawaban benar atau salah
function handleAnswer(btn, selectedValue, correctAnswer) {
    // Nonaktifkan semua tombol setelah menjawab
    const allBtns = gameOptions.querySelectorAll('.option-btn');
    allBtns.forEach(b => b.disabled = true);
    
    // Karena bisa berupa angka atau string teks arab, kita gunakan loose equality (==)
    // Atau ubah menjadi string semua untuk strict equality (===)
    if (String(selectedValue) === String(correctAnswer)) {
        btn.classList.add('correct');
        gameFeedback.textContent = "Benar! +10 Poin";
        gameFeedback.style.color = "var(--correct)";
        currentScore += 10;
        gameScoreDisplay.textContent = currentScore;
    } else {
        btn.classList.add('wrong');
        gameFeedback.textContent = "Salah!";
        gameFeedback.style.color = "var(--wrong)";
        
        // Tunjukkan mana jawaban yang benar
        allBtns.forEach(b => {
            if (String(b.textContent) === String(correctAnswer)) {
                b.classList.add('correct');
            }
        });
    }
    
    // Tampilkan tombol lanjut
    btnNext.style.display = 'block';
}
