// --- CONFIGURATION ---
const YOUTUBE_API_KEY = "AIzaSyC_PErZfusxPFXFnUNXMa1ZSujkJbrgeaA";

let player;
let isPlayerReady = false;
let currentPlaylist = [];
let currentIndex = -1;
let localAudio = new Audio(); // <-- लोकल गानों के लिए ऑडियो प्लेयर

// 1. YouTube API Initialization
function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtubePlayer', {
        height: '0', width: '0',
        playerVars: { 'origin': window.location.origin, 'enablejsapi': 1 },
        events: {
            'onReady': () => { isPlayerReady = true; searchSongs('New Bollywood Hits'); },
            'onStateChange': (e) => { if (e.data === YT.PlayerState.ENDED) nextSong(); }
        }
    });
}

// 2. Search Logic using YouTube Official API
async function searchSongs(query) {
    const songList = document.getElementById('songList');
    songList.innerHTML = '<div class="status-msg">Searching...</div>';

    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&key=${YOUTUBE_API_KEY}`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (data.error) throw new Error(data.error.message);

        const youtubeTracks = data.items.map(item => ({
            title: item.snippet.title,
            artist: item.snippet.channelTitle,
            img: item.snippet.thumbnails.high.url,
            videoId: item.id.videoId,
            isLocal: false
        }));

        currentPlaylist = youtubeTracks;
        renderUI();
    } catch (err) {
        console.error("Search Error:", err);
        songList.innerHTML = `<div class="status-msg" style="color:red;">Error: ${err.message}</div>`;
    }
}

// 3. Local Music Logic
const localInput = document.getElementById('localFile');
localInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const localTracks = files.map(file => ({
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: "Local File",
        img: "https://placehold.co/150/1db954/white?text=Local+Music",
        videoId: null,
        isLocal: true,
        localUrl: URL.createObjectURL(file)
    }));

    // गानों को लिस्ट में सबसे ऊपर जोड़ें
    currentPlaylist = [...localTracks, ...currentPlaylist];
    renderUI();
    document.getElementById('listTitle').innerText = "My Library";
    alert(files.length + " गाने लाइब्रेरी में जोड़े गए!");
});

function renderUI() {
    const songList = document.getElementById('songList');
    songList.innerHTML = '';
    currentPlaylist.forEach((track, index) => {
        const card = document.createElement('div');
        card.className = 'song-card';
        card.innerHTML = `<img src="${track.img}"><h4>${track.title.slice(0, 35)}...</h4><small>${track.artist}</small>`;
        card.onclick = () => playTrack(index);
        songList.appendChild(card);
    });
}

// 4. Play Logic (Dual Player Support)
function playTrack(index) {
    if (index < 0 || index >= currentPlaylist.length) return;
    currentIndex = index;
    const track = currentPlaylist[index];

    // Update Player UI
    document.getElementById('currTrackImg').src = track.img;
    document.getElementById('currTrackName').innerText = track.title;
    document.getElementById('currArtistName').innerText = track.artist;

    // पुराना गाना रोकें (YouTube और Local दोनों)
    if (isPlayerReady && player && typeof player.stopVideo === 'function') {
        player.stopVideo();
    }
    localAudio.pause();

    // चेक करें गाना लोकल है या YouTube का
    if (track.isLocal) {
        localAudio.src = track.localUrl;
        localAudio.play();
    } else {
        if (isPlayerReady) player.loadVideoById(track.videoId);
    }

    document.getElementById('playBtn').innerHTML = '<i class="fas fa-pause"></i>';

    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title,
            artist: track.artist || 'Unknown Artist',
            artwork: [
                { src: track.img, sizes: '96x96', type: 'image/png' },
                { src: track.img, sizes: '256x256', type: 'image/png' },
                { src: track.img, sizes: '512x512', type: 'image/png' }
            ]
        });

        // लॉक स्क्रीन के बटन्स को हमारे प्लेयर के बटन्स से जोड़ना
        navigator.mediaSession.setActionHandler('play', () => document.getElementById('playBtn').click());
        navigator.mediaSession.setActionHandler('pause', () => document.getElementById('playBtn').click());
        navigator.mediaSession.setActionHandler('previoustrack', () => document.getElementById('prevBtn').click());
        navigator.mediaSession.setActionHandler('nexttrack', () => document.getElementById('nextBtn').click());
    }
}

// 5. Controls (Play/Pause)
document.getElementById('playBtn').onclick = () => {
    // अगर कोई गाना सिलेक्ट नहीं है, तो पहला गाना चलाएं
    if (currentIndex === -1 && currentPlaylist.length > 0) {
        playTrack(0);
        return;
    }

    const track = currentPlaylist[currentIndex];
    if (!track) return;

    if (track.isLocal) {
        // लोकल गाने के लिए Play/Pause
        if (localAudio.paused) {
            localAudio.play();
            document.getElementById('playBtn').innerHTML = '<i class="fas fa-pause"></i>';
        } else {
            localAudio.pause();
            document.getElementById('playBtn').innerHTML = '<i class="fas fa-play"></i>';
        }
    } else {
        // YouTube गाने के लिए Play/Pause
        if (player && typeof player.getPlayerState === 'function') {
            if (player.getPlayerState() === 1) { // 1 means playing
                player.pauseVideo();
                document.getElementById('playBtn').innerHTML = '<i class="fas fa-play"></i>';
            } else {
                player.playVideo();
                document.getElementById('playBtn').innerHTML = '<i class="fas fa-pause"></i>';
            }
        }
    }
};

function nextSong() { if (currentIndex < currentPlaylist.length - 1) playTrack(currentIndex + 1); }
document.getElementById('nextBtn').onclick = nextSong;
document.getElementById('prevBtn').onclick = () => { if (currentIndex > 0) playTrack(currentIndex - 1); };

// 6. Volume Fix
const volumeSlider = document.getElementById('volumeSlider');
volumeSlider.addEventListener('input', (e) => {
    const vol = e.target.value;
    // YouTube वॉल्यूम (0-100)
    if (isPlayerReady && player && typeof player.setVolume === 'function') {
        player.setVolume(vol);
    }
    // लोकल ऑडियो वॉल्यूम (0.0 - 1.0)
    localAudio.volume = vol / 100;
});

// 7. Progress Bar & Auto-Next Event
setInterval(() => {
    let perc = 0;
    const track = currentPlaylist[currentIndex];

    if (track && !track.isLocal && player && typeof player.getPlayerState === 'function') {
        if (player.getPlayerState() === 1) {
            perc = (player.getCurrentTime() / player.getDuration()) * 100;
        }
    } else if (track && track.isLocal) {
        if (!localAudio.paused) {
            perc = (localAudio.currentTime / localAudio.duration) * 100;
            if (localAudio.ended) nextSong(); // गाना खत्म होने पर अगला चले
        }
    }

    if (perc > 0) {
        document.getElementById('progressBar').style.width = perc + '%';
    }
}, 1000);

// 8. Search Input Event
document.getElementById('searchInput').onkeypress = (e) => {
    if (e.key === 'Enter') searchSongs(e.target.value);

};
