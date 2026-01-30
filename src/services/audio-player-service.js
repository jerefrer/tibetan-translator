/**
 * Audio Player Service
 *
 * Manages audio playback for dictionary entries with embedded audio.
 * Handles play/pause, progress tracking, and seeking.
 *
 * This service uses jQuery for DOM manipulation to match the existing
 * dynamic content pattern where audio players are rendered as HTML strings
 * by the decorator service.
 */

import $ from "jquery";

let currentAudio = null;
let currentPlayer = null;
let isInitialized = false;

/**
 * Format seconds to mm:ss display string
 */
function formatTime(seconds) {
  if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Update the progress bar and time display for a player
 */
function updateProgress(player, audio) {
  const fill = player.find(".audio-progress-fill");
  const handle = player.find(".audio-progress-handle");
  const timeDisplay = player.find(".audio-time");
  const percent = (audio.currentTime / audio.duration) * 100 || 0;
  fill.css("width", percent + "%");
  handle.css("left", percent + "%");
  timeDisplay.text(`${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`);
}

/**
 * Show play icon, hide pause icon
 */
function showPlayIcon(btn) {
  btn.find(".play-icon").show();
  btn.find(".pause-icon").hide();
}

/**
 * Show pause icon, hide play icon
 */
function showPauseIcon(btn) {
  btn.find(".play-icon").hide();
  btn.find(".pause-icon").show();
}

/**
 * Stop currently playing audio and reset state
 */
function stopCurrentAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    if (currentPlayer) {
      showPlayIcon(currentPlayer.find(".audio-play-btn"));
      currentPlayer.find(".audio-progress-fill").css("width", "0%");
      currentPlayer.find(".audio-progress-handle").css("left", "0%");
    }
    currentAudio = null;
    currentPlayer = null;
  }
}

/**
 * Handle play/pause button click
 */
function handlePlayPauseClick(event) {
  const btn = $(event.currentTarget);
  const player = btn.closest(".audio-player");
  const audioPath = player.attr("data-audio");

  // If clicking on a different player, stop the current one
  if (currentPlayer && currentPlayer[0] !== player[0]) {
    stopCurrentAudio();
  }

  // If no audio or different audio, create new one
  if (!currentAudio || currentPlayer[0] !== player[0]) {
    currentAudio = new Audio(audioPath);
    currentPlayer = player;

    currentAudio.addEventListener("timeupdate", () => {
      updateProgress(player, currentAudio);
    });

    currentAudio.addEventListener("loadedmetadata", () => {
      updateProgress(player, currentAudio);
    });

    currentAudio.addEventListener("ended", () => {
      showPlayIcon(btn);
      currentAudio.currentTime = 0;
      updateProgress(player, currentAudio);
    });

    currentAudio.play().catch(err => {
      console.error("Audio playback failed:", err);
    });
    showPauseIcon(btn);
  } else {
    // Toggle play/pause on same audio
    if (currentAudio.paused) {
      currentAudio.play();
      showPauseIcon(btn);
    } else {
      currentAudio.pause();
      showPlayIcon(btn);
    }
  }
}

/**
 * Handle progress bar mouse interaction for seeking
 */
function handleProgressMouseDown(event) {
  const player = $(event.currentTarget).closest(".audio-player");
  if (!currentAudio || currentPlayer[0] !== player[0]) return;

  const progressBar = $(event.currentTarget);
  const seek = (e) => {
    const rect = progressBar[0].getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    currentAudio.currentTime = percent * currentAudio.duration;
    updateProgress(player, currentAudio);
  };

  seek(event);

  const onMouseMove = (e) => seek(e);
  const onMouseUp = () => {
    $(document).off("mousemove", onMouseMove);
    $(document).off("mouseup", onMouseUp);
  };

  $(document).on("mousemove", onMouseMove);
  $(document).on("mouseup", onMouseUp);
}

/**
 * Handle progress bar touch interaction for seeking (mobile)
 */
function handleProgressTouchStart(event) {
  const player = $(event.currentTarget).closest(".audio-player");
  if (!currentAudio || currentPlayer[0] !== player[0]) return;

  const progressBar = $(event.currentTarget);
  const seek = (e) => {
    const touch = e.touches ? e.touches[0] : e;
    const rect = progressBar[0].getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    currentAudio.currentTime = percent * currentAudio.duration;
    updateProgress(player, currentAudio);
  };

  seek(event.originalEvent);

  const onTouchMove = (e) => seek(e.originalEvent);
  const onTouchEnd = () => {
    $(document).off("touchmove", onTouchMove);
    $(document).off("touchend", onTouchEnd);
  };

  $(document).on("touchmove", onTouchMove);
  $(document).on("touchend", onTouchEnd);
}

/**
 * Initialize audio player event listeners
 * Call this once in app setup
 */
export function initialize() {
  if (isInitialized) return;

  $(document).on("click", ".audio-play-btn", handlePlayPauseClick);
  $(document).on("mousedown", ".audio-progress-bar", handleProgressMouseDown);
  $(document).on("touchstart", ".audio-progress-bar", handleProgressTouchStart);

  isInitialized = true;
}

/**
 * Cleanup audio player - stop any playing audio
 */
export function cleanup() {
  stopCurrentAudio();
}

export default {
  initialize,
  cleanup,
  stopCurrentAudio,
};
