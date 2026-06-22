const API_BASE_URL = "https://my-musicprepository.vercel.app/api/search/songs?query="; 

// DOM Elements
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
const favIcon = document.getElementById('favIcon');
const localFileInput = document.getElementById('localFile');
const exploreSection = document.getElementById('exploreSection');
const homeCategories = document.getElementById('homeCategories');
const searchResultsSection = document.getElementById('searchResultsSection');
const loader = document.getElementById('loadingMore');
const mainContent = document.getElementById('mainContent');

// State Variables
let currentPlaylist = [];
let currentIndex = 0;
let currentTrack = null;
let favoriteSongs = JSON.parse(localStorage.getItem('myFavorites')) || [];
let sleepTimer = null;

// Infinite Scroll Variables
let currentSearchQuery = "";
let currentPage = 1;
let isFetching = false;

// Data
const CHIPS = ["Top Hindi Songs", "Punjabi Hits", "Bollywood Romantic", "Sad Songs", "Bhakti", "Party", "Lofi Chill"];
const ARTISTS = ["Arijit Singh", "Jubin Nautiyal", "Diljit Dosanjh", "Shreya Ghoshal", "Atif Aslam", "Badshah", "Neha Kakkar"];

window.onload = () => {
    buildChips();
    buildArtists();
    fetchTrendingSongs(); // Loads home categories
    audioPlayer.volume = volumeSlider.value;
};

/* --- 1. UI Builders --- */
function buildChips() {
    const container = document.getElementById('chipsContainer');
    CHIPS.forEach(chip => {
        const btn = document.createElement('button');
        btn.className = 'chip';
        btn.innerText = chip;
        btn.onclick = () => { searchInput.value = chip; searchSongs(chip); };
        container.appendChild(btn);
    });
}

function buildArtists() {
    const container = document.getElementById('artistsContainer');
    ARTISTS.forEach(artist => {
        const div = document.createElement('div');
        div.className = 'artist-box';
        div.innerText = artist;
        div.onclick = () => { searchInput.value = `${artist} songs`; searchSongs(`${artist} songs`); };
        container.appendChild(div);
    });
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.className = "toast show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}

/* --- 2. Fetch Data & Categories --- */
async function fetchSongsData(query, page = 1, limit = 15) {
    try {
        const url = `${API_BASE_URL}${encodeURIComponent(query)}&page=${page}&limit=${limit}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success && data.data && data.data.results.length > 0) {
            return data.data.results.map(song => {
                let downloadLink = song.downloadUrl && song.downloadUrl.length > 0 ? song.downloadUrl[song.downloadUrl.length - 1].url : "";
                return {
                    id: song.id,
                    name: song.name,
                    artist: (song.artists && song.artists.primary && song.artists.primary.length > 0) ? song.artists.primary[0].name : "Unknown",
                    image: song.image[song.image.length - 1].url,
                    url: downloadLink
                };
            });
        }
    } catch (error) {
        console.error("API Error:", error);
    }
    return [];
}

async function loadHomeCategories() {
    exploreSection.style.display = 'block';
    homeCategories.style.display = 'block';
    searchResultsSection.style.display = 'none';

    const trending = await fetchSongsData("Top Hindi Songs 2024", 1, 15);
    renderHorizontalList(trending, 'trendingList');

    const punjabi = await fetchSongsData("Punjabi hits 2024", 1, 15);
    renderHorizontalList(punjabi, 'punjabiList');

    const romantic = await fetchSongsData("Bollywood romantic", 1, 15);
    renderHorizontalList(romantic, 'romanticList');

    const sad = await fetchSongsData("Sad songs Hindi", 1, 15);
    renderHorizontalList(sad, 'sadList');
}

function renderHorizontalList(songsData, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    
    if (songsData.length === 0) {
        container.innerHTML = '<p class="status-msg">Failed to load</p>';
        return;
    }

    songsData.forEach((song, index) => {
        const card = document.createElement('div');
        card.className = 'song-card';
        card.innerHTML = `
            <img src="${song.image}" alt="${song.name}">
            <h4 style="margin: 10px 0 5px 0; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.name}</h4>
            <p style="margin: 0; color: #b3b3b3; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.artist}</p>
        `;
        card.onclick = () => { 
            currentPlaylist = [...songsData]; 
            loadAndPlaySong(index); 
        };
        container.appendChild(card);
    });
}

function fetchTrendingSongs() {
    document.getElementById('navHome').classList.add('active');
    document.getElementById('navFav').classList.remove('active');
    searchInput.value = '';
    loadHomeCategories();
}

/* --- 3. Search & Infinite Scroll --- */
function handleSearch(event) {
    if (event.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) searchSongs(query);
    }
}

async function searchSongs(query, isNewSearch = true) {
    exploreSection.style.display = 'none';
    homeCategories.style.display = 'none';
    searchResultsSection.style.display = 'block';
    
    if (isNewSearch) {
        currentSearchQuery = query;
        currentPage = 1;
        currentPlaylist = [];
        songList.innerHTML = "";
        listTitle.innerText = `Search Results for "${query}"`;
    }

    if (isFetching) return;
    isFetching = true;
    loader.style.display = "block";

    // Fetch 40 songs per page for infinite scroll
    const newSongs = await fetchSongsData(query, currentPage, 40);
    
    if (newSongs.length > 0) {
        const startIndex = currentPlaylist.length;
        currentPlaylist = [...currentPlaylist, ...newSongs];
        
        newSongs.forEach((song, i) => {
            const card = document.createElement('div');
            card.className = 'song-card';
            card.innerHTML = `
                <img src="${song.image}" alt="${song.name}">
                <h4 style="margin: 10px 0 5px 0; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.name}</h4>
                <p style="margin: 0; color: #b3b3b3; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.artist}</p>
            `;
            card.onclick = () => loadAndPlaySong(startIndex + i);
            songList.appendChild(card);
        });
        currentPage++;
    } else if (isNewSearch) {
        songList.innerHTML = '<p class="status-msg">No songs found.</p>';
    }

    loader.style.display = "none";
    isFetching = false;
}

// Detect Scroll to Bottom
mainContent.addEventListener('scroll', function() {
    if (searchResultsSection.style.display === 'block') {
        const { scrollTop, scrollHeight, clientHeight } = this;
        if (scrollHeight - scrollTop <= clientHeight + 150) { 
            if (!isFetching && currentSearchQuery !== "") {
                searchSongs(currentSearchQuery, false);
            }
        }
    }
});

/* --- 4. Player Logic --- */
function loadAndPlaySong(index) {
    if (index < 0 || index >= currentPlaylist.length) return;
    currentIndex = index; 
    currentTrack = currentPlaylist[currentIndex];

    if (!currentTrack.url) {
        showToast("Audio URL not available ❌");
        return;
    }

    currTrackName.innerText = currentTrack.name;
    currArtistName.innerText = currentTrack.artist;
    currTrackImg.src = currentTrack.image;

    audioPlayer.src = currentTrack.url;
    audioPlayer.play();
    
    playIcon.classList.remove('fa-play');
    playIcon.classList.add('fa-pause');
    checkIfFavorite(); 

    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: currentTrack.name,
            artist: currentTrack.artist,
            album: 'Pro Music Player',
            artwork: [ { src: currentTrack.image, sizes: '512x512', type: 'image/jpeg' } ]
        });
        navigator.mediaSession.setActionHandler('play', () => audioPlayer.play());
        navigator.mediaSession.setActionHandler('pause', () => audioPlayer.pause());
        navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
        navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
    }
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
        playIcon.classList.remove('fa-play');
        playIcon.classList.add('fa-pause');
    } else {
        audioPlayer.pause();
        playIcon.classList.remove('fa-pause');
        playIcon.classList.add('fa-play');
    }
}

audioPlayer.addEventListener('timeupdate', () => {
    if (audioPlayer.duration) {
        const progressPercent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressBar.style.width = `${progressPercent}%`;
    }
});

audioPlayer.addEventListener('ended', () => playNext());

function seekSong(event) {
    if (audioPlayer.src === "") return;
    const clickX = event.offsetX;
    audioPlayer.currentTime = (clickX / document.getElementById('progressContainer').clientWidth) * audioPlayer.duration;
}

function changeVolume() { audioPlayer.volume = volumeSlider.value; }

/* --- 5. Extra Features (Download, Sleep, Fav, Local) --- */
function downloadSong() {
    if (!currentTrack || !currentTrack.url) {
        showToast("Play a song to download!");
        return;
    }
    const a = document.createElement('a');
    a.href = currentTrack.url;
    a.download = currentTrack.name + '.mp3';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Downloading: ${currentTrack.name} ⬇️`);
}

function setSleepTimer() {
    let mins = prompt("Enter sleep timer in minutes (Type 0 to cancel):", "15");
    if (mins !== null) {
        mins = parseInt(mins);
        if (sleepTimer) clearTimeout(sleepTimer);
        
        if (mins > 0) {
            sleepTimer = setTimeout(() => {
                audioPlayer.pause();
                playIcon.classList.remove('fa-pause');
                playIcon.classList.add('fa-play');
                showToast("Sleep timer ended. Music paused 😴");
            }, mins * 60000);
            showToast(`Sleep Timer set for ${mins} minutes ⏱`);
        } else {
            showToast("Sleep Timer cancelled ❌");
        }
    }
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
    if (isFav) {
        favIcon.classList.remove('far');
        favIcon.classList.add('fas');
        favIcon.style.color = "#1db954";
    } else {
        favIcon.classList.remove('fas');
        favIcon.classList.add('far');
        favIcon.style.color = "#b3b3b3";
    }
}

function showFavorites() {
    exploreSection.style.display = 'none';
    homeCategories.style.display = 'none';
    searchResultsSection.style.display = 'block';
    
    document.getElementById('navHome').classList.remove('active');
    document.getElementById('navFav').classList.add('active');
    
    listTitle.innerText = "My Favorite Songs ❤️";
    currentPlaylist = favoriteSongs; 
    songList.innerHTML = "";

    if (currentPlaylist.length > 0) {
        currentPlaylist.forEach((song, index) => {
            const card = document.createElement('div');
            card.classList.add('song-card');
            card.innerHTML = `
                <img src="${song.image}" alt="${song.name}">
                <h4 style="margin: 10px 0 5px 0; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.name}</h4>
                <p style="margin: 0; color: #b3b3b3; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.artist}</p>
            `;
            card.onclick = () => loadAndPlaySong(index);
            songList.appendChild(card);
        });
    } else {
        songList.innerHTML = '<p class="status-msg">No favorites yet. Like some songs to see them here!</p>';
    }
}

localFileInput.addEventListener('change', function(event) {
    const files = event.target.files;
    if (files.length === 0) return;
    
    exploreSection.style.display = 'none';
    homeCategories.style.display = 'none';
    searchResultsSection.style.display = 'block';

    let localPlaylist = [];
    songList.innerHTML = "";

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const objectUrl = URL.createObjectURL(file);
        
        localPlaylist.push({
            id: `local_${i}_${Date.now()}`,
            name: file.name.replace('.mp3', ''), 
            artist: "Local Device",
            image: "https://placehold.co/150/1db954/white?text=Local+Music", 
            url: objectUrl
        });
    }

    currentPlaylist = localPlaylist;
    listTitle.innerText = `Local Music (${currentPlaylist.length} Songs)`;
    document.getElementById('navHome').classList.remove('active');
    document.getElementById('navFav').classList.remove('active');
    
    currentPlaylist.forEach((song, index) => {
        const card = document.createElement('div');
        card.classList.add('song-card');
        card.innerHTML = `
            <img src="${song.image}" alt="${song.name}">
            <h4 style="margin: 10px 0 5px 0; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.name}</h4>
            <p style="margin: 0; color: #b3b3b3; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.artist}</p>
        `;
        card.onclick = () => loadAndPlaySong(index);
        songList.appendChild(card);
    });
});
