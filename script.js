const API_BASE_URL = "https://my-musicprepository.vercel.app/api/search/songs?query="; 

const songList = document.getElementById('songList');
const searchInput = document.getElementById('searchInput');
const listTitle = document.getElementById('listTitle');
const audioPlayer = document.getElementById('audioPlayer');
const playIcon = document.getElementById('playIcon');
const currTrackName = document.getElementById('currTrackName');
const currArtistName = document.getElementById('currArtistName');
const currTrackImg = document.getElementById('currTrackImg');
const progressBar = document.getElementById('progressBar');
const volumeSlider = document.getElementById('volumeSlider');
const mpVolumeSlider = document.getElementById('mpVolumeSlider');
const favIcon = document.getElementById('favIcon');
const exploreSection = document.getElementById('exploreSection');
const homeCategories = document.getElementById('homeCategories');
const searchResultsSection = document.getElementById('searchResultsSection');
const mainContent = document.getElementById('mainContent');

let currentPlaylist = [];
let currentIndex = 0;
let currentTrack = null;
let favoriteSongs = JSON.parse(localStorage.getItem('myFavorites')) || [];
let sleepTimer = null;

// Infinite Scroll Variables
let currentSearchQuery = "";
let currentPage = 1;
let isFetching = false;
let suggestionsPage = 1;
let isFetchingSuggestions = false;
let suggestionsPlaylist = [];

const CHIPS = ["Top Hindi", "Punjabi Hits", "Romantic", "Sad Songs", "Bhakti", "Party", "Lofi Chill"];
const ARTISTS = ["Arijit Singh", "Diljit Dosanjh", "Karan Aujla", "Jubin Nautiyal", "Guru Randhawa", "Parmish Verma","Shreya Ghoshal", "B Praak", "Badshah",  "Hardy Sandhu",  "Neha Kakkar", "Ammy Virk", "Sidhu Moose Wala", "AP Dhillon", "Shubh"];

window.onload = () => {
    buildChips();
    buildArtists();
    fetchTrendingSongs(); 
    audioPlayer.volume = volumeSlider.value;
    loadMoodCategory(CHIPS[0]); // Load first chip's songs automatically
};

/* --- UI Builders --- */
function buildChips() {
    const container = document.getElementById('chipsContainer');
    container.innerHTML = "";
    CHIPS.forEach((chip, index) => {
        const btn = document.createElement('button');
        btn.className = index === 0 ? 'chip active-chip' : 'chip'; 
        btn.innerText = chip;
        btn.onclick = () => { 
            // Highlight active chip
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active-chip'));
            btn.classList.add('active-chip');
            loadMoodCategory(chip); 
        };
        container.appendChild(btn);
    });
}

function buildArtists() {
    const container = document.getElementById('artistsContainer');
    ARTISTS.forEach(artist => {
        const div = document.createElement('div');
        div.className = 'artist-box'; div.innerText = artist;
        div.onclick = () => { searchInput.value = `${artist} songs`; searchSongs(`${artist} songs`); };
        container.appendChild(div);
    });
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg; toast.className = "toast show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}

/* --- Helper: Format Time (0:00) --- */
function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/* --- API Fetch --- */
async function fetchSongsData(query, page = 1, limit = 15) {
    try {
        const url = `${API_BASE_URL}${encodeURIComponent(query)}&page=${page}&limit=${limit}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.success && data.data && data.data.results.length > 0) {
            return data.data.results.map(song => {
                let downloadLink = song.downloadUrl && song.downloadUrl.length > 0 ? song.downloadUrl[song.downloadUrl.length - 1].url : "";
                return {
                    id: song.id, name: song.name,
                    artist: (song.artists?.primary?.length > 0) ? song.artists.primary[0].name : "Unknown",
                    image: song.image[song.image.length - 1].url, url: downloadLink
                };
            });
        }
    } catch (error) { console.error("API Error:", error); }
    return [];
}

/* --- Load Dynamic Mood Category --- */
async function loadMoodCategory(query) {
    document.getElementById('moodCategoryTitle').innerText = `${query} Picks`;
    const container = document.getElementById('moodCategoryList');
    container.innerHTML = '<p class="status-msg">Loading...</p>';
    const songs = await fetchSongsData(query, 1, 15);
    renderHorizontalList(songs, 'moodCategoryList');
}

async function loadHomeCategories() {
    exploreSection.style.display = 'block';
    homeCategories.style.display = 'block';
    searchResultsSection.style.display = 'none';

    renderHorizontalList(await fetchSongsData("Top Hindi Songs 2024", 1, 15), 'trendingList');
    renderHorizontalList(await fetchSongsData("Punjabi hits 2024", 1, 15), 'punjabiList');
    renderHorizontalList(await fetchSongsData("Bollywood romantic", 1, 15), 'romanticList');
    renderHorizontalList(await fetchSongsData("Sad songs Hindi", 1, 15), 'sadList');
    
    if(suggestionsPlaylist.length === 0) loadSuggestions();
}

function renderHorizontalList(songsData, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    if (songsData.length === 0) {
        container.innerHTML = '<p class="status-msg">No songs found</p>';
        return;
    }
    songsData.forEach((song, index) => {
        const card = document.createElement('div');
        card.className = 'song-card';
        card.innerHTML = `<img src="${song.image}"><h4 style="margin: 10px 0 5px 0; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.name}</h4><p style="margin: 0; color: #b3b3b3; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.artist}</p>`;
        card.onclick = () => { currentPlaylist = [...songsData]; loadAndPlaySong(index); };
        container.appendChild(card);
    });
}

function fetchTrendingSongs() {
    document.getElementById('navHome').classList.add('active');
    document.getElementById('navFav').classList.remove('active');
    searchInput.value = '';
    loadHomeCategories();
}

/* --- Suggestions & Search Logic --- */
async function loadSuggestions() {
    if (isFetchingSuggestions) return;
    isFetchingSuggestions = true;
    document.getElementById('loadingSuggestions').style.display = 'block';

    const queries = ["Hits", "Lofi Bollywood", "Best of 90s India", "Viral Songs"];
    const randomQuery = queries[Math.floor(Math.random() * queries.length)];

    const newSongs = await fetchSongsData(randomQuery, suggestionsPage, 20);
    
    if (newSongs.length > 0) {
        const startIndex = suggestionsPlaylist.length;
        suggestionsPlaylist = [...suggestionsPlaylist, ...newSongs];
        const container = document.getElementById('suggestionsGrid');
        
        newSongs.forEach((song, i) => {
            const card = document.createElement('div');
            card.className = 'song-card';
            card.innerHTML = `<img src="${song.image}"><h4 style="margin: 10px 0 5px 0; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.name}</h4><p style="margin: 0; color: #b3b3b3; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.artist}</p>`;
            card.onclick = () => { currentPlaylist = suggestionsPlaylist; loadAndPlaySong(startIndex + i); };
            container.appendChild(card);
        });
        suggestionsPage++;
    }
    document.getElementById('loadingSuggestions').style.display = 'none';
    isFetchingSuggestions = false;
}

function handleSearch(event) {
    if (event.key === 'Enter' && searchInput.value.trim()) searchSongs(searchInput.value.trim());
}

async function searchSongs(query, isNewSearch = true) {
    exploreSection.style.display = 'none';
    homeCategories.style.display = 'none';
    searchResultsSection.style.display = 'block';
    
    if (isNewSearch) {
        currentSearchQuery = query; currentPage = 1; currentPlaylist = [];
        songList.innerHTML = ""; listTitle.innerText = `Search Results for "${query}"`;
    }
    if (isFetching) return;
    isFetching = true;
    document.getElementById('loadingMore').style.display = "block";

    const newSongs = await fetchSongsData(query, currentPage, 40);
    if (newSongs.length > 0) {
        const startIndex = currentPlaylist.length;
        currentPlaylist = [...currentPlaylist, ...newSongs];
        newSongs.forEach((song, i) => {
            const card = document.createElement('div');
            card.className = 'song-card';
            card.innerHTML = `<img src="${song.image}"><h4 style="margin: 10px 0 5px 0; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.name}</h4><p style="margin: 0; color: #b3b3b3; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.artist}</p>`;
            card.onclick = () => loadAndPlaySong(startIndex + i);
            songList.appendChild(card);
        });
        currentPage++;
    } else if (isNewSearch) { songList.innerHTML = '<p class="status-msg">No songs found.</p>'; }

    document.getElementById('loadingMore').style.display = "none";
    isFetching = false;
}

mainContent.addEventListener('scroll', function() {
    const { scrollTop, scrollHeight, clientHeight } = this;
    if (scrollHeight - scrollTop <= clientHeight + 200) { 
        if (searchResultsSection.style.display === 'block' && !isFetching && currentSearchQuery !== "") {
            searchSongs(currentSearchQuery, false);
        } else if (homeCategories.style.display === 'block' && !isFetchingSuggestions) {
            loadSuggestions(); 
        }
    }
});

/* --- Player & Popup Logic --- */
function loadAndPlaySong(index) {
    if (index < 0 || index >= currentPlaylist.length) return;
    currentIndex = index; 
    currentTrack = currentPlaylist[currentIndex];

    if (!currentTrack.url) { showToast("Audio URL not available ❌"); return; }

    currTrackName.innerText = currentTrack.name;
    currArtistName.innerText = currentTrack.artist;
    currTrackImg.src = currentTrack.image;
    
    document.getElementById('mpTrackName').innerText = currentTrack.name;
    document.getElementById('mpArtistName').innerText = currentTrack.artist;
    document.getElementById('mpTrackImg').src = currentTrack.image;

    audioPlayer.src = currentTrack.url;
    audioPlayer.play();
    
    playIcon.className = 'fas fa-pause';
    document.getElementById('mpPlayIcon').className = 'fas fa-pause';
    document.getElementById('mpTrackImg').classList.add('playing'); 

    checkIfFavorite(); 
}

function playNext() {
    if (currentPlaylist.length === 0) return;
    let nextIndex = currentIndex + 1;
    if (nextIndex >= currentPlaylist.length) nextIndex = 0;
    loadAndPlaySong(nextIndex);
}

function playPrev() {
    if (currentPlaylist.length === 0) return;
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) prevIndex = currentPlaylist.length - 1;
    loadAndPlaySong(prevIndex);
}

function togglePlayPause() {
    if (audioPlayer.src === "") return; 
    if (audioPlayer.paused) {
        audioPlayer.play();
        playIcon.className = 'fas fa-pause';
        document.getElementById('mpPlayIcon').className = 'fas fa-pause';
        document.getElementById('mpTrackImg').classList.add('playing');
    } else {
        audioPlayer.pause();
        playIcon.className = 'fas fa-play';
        document.getElementById('mpPlayIcon').className = 'fas fa-play';
        document.getElementById('mpTrackImg').classList.remove('playing');
    }
}

// Duration and Progress Sync
audioPlayer.addEventListener('loadedmetadata', () => {
    document.getElementById('mpDuration').innerText = formatTime(audioPlayer.duration);
});

audioPlayer.addEventListener('timeupdate', () => {
    if (audioPlayer.duration) {
        const progressPercent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressBar.style.width = `${progressPercent}%`;
        document.getElementById('mpProgressBar').style.width = `${progressPercent}%`;
        
        // Update Time displays
        document.getElementById('mpCurrentTime').innerText = formatTime(audioPlayer.currentTime);
        document.getElementById('mpDuration').innerText = formatTime(audioPlayer.duration);
    }
});

audioPlayer.addEventListener('ended', () => playNext());

function seekSong(event) {
    if (audioPlayer.src === "") return;
    const containerWidth = event.currentTarget.clientWidth;
    const clickX = event.offsetX;
    audioPlayer.currentTime = (clickX / containerWidth) * audioPlayer.duration;
}

// Sync Main and Mobile Volumes
function changeVolume() { 
    audioPlayer.volume = volumeSlider.value; 
    mpVolumeSlider.value = volumeSlider.value; // Sync to mobile slider
}

function changeMpVolume() {
    audioPlayer.volume = mpVolumeSlider.value;
    volumeSlider.value = mpVolumeSlider.value; // Sync to main slider
}

function openMobilePlayer() {
    if (window.innerWidth <= 768 && currentTrack) {
        document.getElementById('mobilePlayerPopup').classList.add('open');
    }
}
function closeMobilePlayer() { document.getElementById('mobilePlayerPopup').classList.remove('open'); }

/* --- Extra Features --- */
function downloadSong() {
    if (!currentTrack || !currentTrack.url) { showToast("Play a song to download!"); return; }
    const a = document.createElement('a'); a.href = currentTrack.url; a.download = currentTrack.name + '.mp3';
    a.target = '_blank'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast(`Downloading: ${currentTrack.name} ⬇️`);
}

function setSleepTimer() {
    let mins = prompt("Enter sleep timer in minutes (Type 0 to cancel):", "15");
    if (mins && parseInt(mins) > 0) {
        if (sleepTimer) clearTimeout(sleepTimer);
        sleepTimer = setTimeout(() => {
            audioPlayer.pause(); togglePlayPause(); showToast("Music paused 😴");
        }, parseInt(mins) * 60000);
        showToast(`Sleep Timer set for ${mins} minutes ⏱`);
    } else { showToast("Sleep Timer cancelled ❌"); }
}

function toggleFavorite() {
    if (!currentTrack) return;
    const isFav = favoriteSongs.some(song => song.id === currentTrack.id);
    if (isFav) {
        favoriteSongs = favoriteSongs.filter(song => song.id !== currentTrack.id);
        showToast("Removed from Favorites 💔");
    } else {
        favoriteSongs.push(currentTrack);
        showToast("Added to Favorites ❤️");
    }
    localStorage.setItem('myFavorites', JSON.stringify(favoriteSongs));
    checkIfFavorite();
}

function checkIfFavorite() {
    if (!currentTrack) return;
    const isFav = favoriteSongs.some(song => song.id === currentTrack.id);
    const iconClass = isFav ? 'fas fa-heart' : 'far fa-heart';
    const iconColor = isFav ? '#1db954' : '#b3b3b3';
    
    favIcon.className = iconClass; favIcon.style.color = iconColor;
    document.getElementById('mpFavIcon').className = iconClass; document.getElementById('mpFavIcon').style.color = iconColor;
}

function showFavorites() {
    exploreSection.style.display = 'none'; homeCategories.style.display = 'none'; searchResultsSection.style.display = 'block';
    document.getElementById('navHome').classList.remove('active'); document.getElementById('navFav').classList.add('active');
    listTitle.innerText = "My Favorite Songs ❤️"; currentPlaylist = favoriteSongs; songList.innerHTML = "";
    if (currentPlaylist.length > 0) {
        currentPlaylist.forEach((song, index) => {
            const card = document.createElement('div'); card.classList.add('song-card');
            card.innerHTML = `<img src="${song.image}"><h4 style="margin: 10px 0 5px 0; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.name}</h4><p style="margin: 0; color: #b3b3b3; font-size: 13px;">${song.artist}</p>`;
            card.onclick = () => loadAndPlaySong(index); songList.appendChild(card);
        });
    } else { songList.innerHTML = '<p class="status-msg">No favorites yet!</p>'; }
}

document.getElementById('localFile').addEventListener('change', function(event) {
    const files = event.target.files; if (files.length === 0) return;
    exploreSection.style.display = 'none'; homeCategories.style.display = 'none'; searchResultsSection.style.display = 'block';
    let localPlaylist = []; songList.innerHTML = "";
    for (let i = 0; i < files.length; i++) {
        localPlaylist.push({
            id: `local_${i}_${Date.now()}`, name: files[i].name.replace('.mp3', ''),
            artist: "Local Device", image: "https://placehold.co/150/1db954/white?text=Local+Music",
            url: URL.createObjectURL(files[i])
        });
    }
    currentPlaylist = localPlaylist; listTitle.innerText = `Local Music (${currentPlaylist.length} Songs)`;
    currentPlaylist.forEach((song, index) => {
        const card = document.createElement('div'); card.classList.add('song-card');
        card.innerHTML = `<img src="${song.image}"><h4 style="margin: 10px 0 5px 0; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.name}</h4><p style="margin: 0; color: #b3b3b3; font-size: 13px;">${song.artist}</p>`;
        card.onclick = () => loadAndPlaySong(index); songList.appendChild(card);
    });
});
