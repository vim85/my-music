
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
const favIcon = document.getElementById('favIcon');
const localFileInput = document.getElementById('localFile');

let currentPlaylist = [];
let currentIndex = 0;
let currentTrack = null;


let favoriteSongs = JSON.parse(localStorage.getItem('myFavorites')) || [];

window.onload = () => {
    fetchTrendingSongs();
    audioPlayer.volume = volumeSlider.value;
};

function handleSearch(event) {
    if (event.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) searchSongs(query);
    }
}

async function searchSongs(query) {
    listTitle.innerText = `Search Results for "${query}"`;
    songList.innerHTML = '<p class="status-msg">Searching...</p>';

    try {
        const response = await fetch(API_BASE_URL + encodeURIComponent(query));
        const data = await response.json();

        if (data.success && data.data && data.data.results.length > 0) {
            
            currentPlaylist = data.data.results.map(song => {
                let downloadLink = "";
                if (song.downloadUrl && song.downloadUrl.length > 0) {
                    downloadLink = song.downloadUrl[song.downloadUrl.length - 1].url; 
                }
                return {
                    id: song.id,
                    name: song.name,
                    artist: (song.artists && song.artists.primary && song.artists.primary.length > 0) ? song.artists.primary[0].name : "Unknown",
                    image: song.image[song.image.length - 1].url,
                    url: downloadLink
                };
            });
            displaySongs();
        } else {
            songList.innerHTML = '<p class="status-msg">No songs found.</p>';
        }
    } catch (error) {
        console.error("API Error:", error);
        songList.innerHTML = '<p class="status-msg" style="color:red;">Failed to fetch songs.</p>';
    }
}

function fetchTrendingSongs() {
    document.getElementById('navHome').classList.add('active');
    document.getElementById('navFav').classList.remove('active');
    searchInput.value = '';
    searchSongs("Top Hindi Songs"); 
    listTitle.innerText = "Trending Now";
}

function displaySongs() {
    songList.innerHTML = ""; 

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
}


function loadAndPlaySong(index) {
    if (index < 0 || index >= currentPlaylist.length) return;

    currentIndex = index; 
    currentTrack = currentPlaylist[currentIndex];

    if (!currentTrack.url) {
        alert("Audio URL not available.");
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


function toggleFavorite() {
    if (!currentTrack) return;

    const isFav = favoriteSongs.some(song => song.id === currentTrack.id);

    if (isFav) {
        favoriteSongs = favoriteSongs.filter(song => song.id !== currentTrack.id);
        favIcon.classList.remove('fas'); // Solid heart
        favIcon.classList.add('far'); // Outline heart
        favIcon.style.color = "#b3b3b3";
    } else {
        favoriteSongs.push(currentTrack);
        favIcon.classList.remove('far');
        favIcon.classList.add('fas');
        favIcon.style.color = "#1db954"; 
    }

    localStorage.setItem('myFavorites', JSON.stringify(favoriteSongs));
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
    document.getElementById('navHome').classList.remove('active');
    document.getElementById('navFav').classList.add('active');
    
    listTitle.innerText = "My Favorite Songs ❤️";
    currentPlaylist = favoriteSongs; 

    if (currentPlaylist.length > 0) {
        displaySongs();
    } else {
        songList.innerHTML = '<p class="status-msg">No favorites yet. Like some songs to see them here!</p>';
    }
}

localFileInput.addEventListener('change', function(event) {
    const files = event.target.files;
    if (files.length === 0) return;

    let localPlaylist = [];
    
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
    
    displaySongs();
});;

