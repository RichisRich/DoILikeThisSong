const openFolderBtn = document.getElementById('openFolderBtn');
const confirmRatingsBtn = document.getElementById('confirmRatingsBtn');
const trackList = document.getElementById('trackList');
const statusText = document.getElementById('statusText');
const currentFolderLabel = document.getElementById('currentFolderLabel');
const coverArt = document.getElementById('coverArt');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const trackAlbum = document.getElementById('trackAlbum');
const audioPlayer = document.getElementById('audioPlayer');
const prevTrackBtn = document.getElementById('prevTrackBtn');
const back10Btn = document.getElementById('back10Btn');
const forward10Btn = document.getElementById('forward10Btn');
const nextTrackBtn = document.getElementById('nextTrackBtn');
const progress = document.getElementById('progress');
const currentTime = document.getElementById('currentTime');
const duration = document.getElementById('duration');

let files = [];
let folderPath = '';
const ratings = {};

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function playTrack(index) {
  if (!files[index]) return;

  const filePath = files[index];
  const fileName = filePath.split('/').pop();

  window.api.getMetadata(filePath).then((meta) => {
    if (meta.success) {
      setNowPlaying(meta);
    } else {
      setNowPlaying({ title: fileName, artist: 'Unknown artist', album: '' });
    }
  });

  audioPlayer.src = filePath;
  audioPlayer.load();
  audioPlayer.play().catch(() => {
    statusText.textContent = 'Playback started after clicking the track.';
  });

  statusText.textContent = `Playing ${fileName}`;
}

function setNowPlaying(meta) {
  trackTitle.textContent = meta.title || 'Unknown title';
  trackArtist.textContent = meta.artist || 'Unknown artist';
  trackAlbum.textContent = meta.album || '';

  if (meta.picture) {
    coverArt.style.backgroundImage = `url("${meta.picture}")`;
    coverArt.textContent = '';
  } else if (meta.coverPath) {
    coverArt.style.backgroundImage = `url("file://${encodeURI(meta.coverPath)}")`;
    coverArt.textContent = '';
  } else {
    coverArt.style.backgroundImage = 'none';
    coverArt.textContent = '♪';
  }
}

function setRating(filePath, vote) {
  if (vote === ratings[filePath]) {
    delete ratings[filePath];
  } else {
    ratings[filePath] = vote;
  }

  renderTracks(files);
}

function renderTracks(list) {
  trackList.innerHTML = '';

  if (!list.length) {
    trackList.innerHTML = '<div class="empty-state">No audio files found in that folder.</div>';
    return;
  }

  list.forEach((filePath, index) => {
    const fileName = filePath.split('/').pop();
    const row = document.createElement('div');
    row.className = 'track-row';

    const ratingGroup = document.createElement('div');
    ratingGroup.className = 'rating-group';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = `rating-btn ${ratings[filePath] === 'up' ? 'active-up' : ''}`;
    upBtn.textContent = '👍';
    upBtn.title = 'Thumbs up';
    upBtn.addEventListener('click', () => setRating(filePath, 'up'));

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = `rating-btn ${ratings[filePath] === 'down' ? 'active-down' : ''}`;
    downBtn.textContent = '👎';
    downBtn.title = 'Thumbs down';
    downBtn.addEventListener('click', () => setRating(filePath, 'down'));

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'track-main-btn';
    playBtn.innerHTML = `<span class="track-name">${fileName}</span>`;
    playBtn.addEventListener('click', () => playTrack(index));

    ratingGroup.append(upBtn, downBtn);
    row.append(ratingGroup, playBtn);
    trackList.appendChild(row);
  });
}

openFolderBtn.addEventListener('click', async () => {
  const selectedFolder = await window.api.selectFolder();
  if (!selectedFolder) return;

  folderPath = selectedFolder;
  currentFolderLabel.textContent = folderPath.split('/').filter(Boolean).pop() || 'Current folder';
  files = await window.api.readAudioFiles(folderPath);
  Object.keys(ratings).forEach((key) => delete ratings[key]);
  renderTracks(files);
  statusText.textContent = `${files.length} audio file(s) found in this folder.`;
});

confirmRatingsBtn.addEventListener('click', async () => {
  if (!folderPath) {
    statusText.textContent = 'Choose a music folder first.';
    return;
  }

  const totalRated = Object.keys(ratings).length;
  if (!totalRated) {
    statusText.textContent = 'Pick at least one thumbs up or thumbs down first.';
    return;
  }

  const moved = await window.api.moveRatedFiles(folderPath, ratings);
  files = await window.api.readAudioFiles(folderPath);
  renderTracks(files);
  statusText.textContent = `Moved ${moved.liked} liked and ${moved.disliked} disliked tracks into subfolders.`;
});

prevTrackBtn.addEventListener('click', () => {
  if (!files.length) return;
  const nextIndex = Math.max(0, (files.findIndex((file) => file === audioPlayer.src.replace(/file:\/\//, '')) - 1 + files.length) % files.length);
  playTrack(nextIndex);
});

back10Btn.addEventListener('click', () => {
  audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 10);
});

forward10Btn.addEventListener('click', () => {
  audioPlayer.currentTime = Math.min(audioPlayer.duration || 0, audioPlayer.currentTime + 10);
});

nextTrackBtn.addEventListener('click', () => {
  if (!files.length) return;
  const nextIndex = (files.findIndex((file) => file === audioPlayer.src.replace(/file:\/\//, '')) + 1) % files.length;
  playTrack(nextIndex);
});

audioPlayer.addEventListener('timeupdate', () => {
  if (!Number.isFinite(audioPlayer.duration) || audioPlayer.duration === 0) return;
  progress.value = (audioPlayer.currentTime / audioPlayer.duration) * 100;
  currentTime.textContent = formatTime(audioPlayer.currentTime);
  duration.textContent = formatTime(audioPlayer.duration);
});

progress.addEventListener('input', () => {
  if (!Number.isFinite(audioPlayer.duration) || audioPlayer.duration === 0) return;
  audioPlayer.currentTime = (progress.value / 100) * audioPlayer.duration;
});
