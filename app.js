// Handle download button (A button)
document
  .querySelectorAll(".download-btn-overlay, .button-a")
  .forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      // If display is active or video is playing, do nothing
      if (displayActive || videoPlaying) {
        e.preventDefault();
        return;
      }
      // Otherwise show loading state
      var downloadBtn = document.querySelector(".download-btn-overlay");
      downloadBtn.querySelector(".btn-text").style.display = "none";
      downloadBtn.querySelector(".btn-loading").style.display = "inline";
    });
  });

function resetButton() {
  const downloadBtn = document.querySelector(".download-btn-overlay");
  downloadBtn.querySelector(".btn-text").style.display = "inline";
  downloadBtn.querySelector(".btn-loading").style.display = "none";
}

window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    resetButton();
  }
});

document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") {
    resetButton();
  }
});

// Simple display functionality
const menuImages = [
  "10_cv2_a",
  "20_kd",
  "30_la_a",
  "40_mmv",
  "50_m2_a",
  "60_sf2",
  "70_tp",
];
// Map menu items to their subfolder game images
const gameImages = {
  "10_cv2_a": [
    "10_game_cv2_a",
    "20_game_cv2_a",
    "30_game_cv2_a",
    "40_game_cv2_a",
    "50_game_cv2_a",
    "60_game_cv2_a",
  ],
  "20_kd": ["10_game_kd_a", "20_game_kd_a", "30_game_kd_a", "40_game_kd_a"],
  "30_la_a": [],
  "40_mmv": [],
  "50_m2_a": [],
  "60_sf2": [],
  "70_tp": [],
};

let currentImageIndex = 0;
let currentGameImageIndex = 0;
let displayActive = false;
let inGame = false;
let bootTimeout = null;
let videoPlaying = false;
const imageCache = {};
let currentObjectURL = null;

// Easter egg combo: right, up, b, down, up, b, down, up, b
const rubdubdubCombo = [
  "right",
  "up",
  "b",
  "down",
  "up",
  "b",
  "down",
  "up",
  "b",
];
let currentCombo = [];
let comboTimeout = null;

function resetCombo() {
  currentCombo = [];
  if (comboTimeout) {
    clearTimeout(comboTimeout);
    comboTimeout = null;
  }
}

function checkCombo(button) {
  // Only track combo when in default view (not in display mode)
  if (displayActive || videoPlaying) return;

  currentCombo.push(button);

  // Check if current combo matches so far
  for (let i = 0; i < currentCombo.length; i++) {
    if (currentCombo[i] !== rubdubdubCombo[i]) {
      resetCombo();
      return;
    }
  }

  // Check if combo is complete
  if (currentCombo.length === rubdubdubCombo.length) {
    resetCombo();
    playEasterEggVideo();
    return;
  }

  // Set timeout to reset combo after 9 seconds
  if (comboTimeout) clearTimeout(comboTimeout);
  comboTimeout = setTimeout(resetCombo, 9000);
}

function playEasterEggVideo() {
  videoPlaying = true;
  videoContainer.classList.add("active");
  updateAButtonHref();
  easterEggVideo.currentTime = 0;
  easterEggVideo.play().catch(function () {
    videoContainer.classList.remove("active");
    videoPlaying = false;
    updateAButtonHref();
  });
}

const powerButton = document.getElementById("power-button");
const menuButton = document.getElementById("menu-button");
const displayContainer = document.getElementById("display-container");
const displayContent = document.querySelector(".display-content");
const buttonUp = document.getElementById("button-up");
const buttonDown = document.getElementById("button-down");
const buttonLeft = document.getElementById("button-left");
const buttonRight = document.getElementById("button-right");
const buttonA = document.querySelector(".button-a");
const buttonB = document.querySelector(".button-b");
const videoContainer = document.getElementById("video-container");
const easterEggVideo = document.getElementById("easter-egg-video");

function showImage(src) {
  var oldImg = displayContent.querySelector("img:not(.fade-out)");
  var img = document.createElement("img");

  var oldURL = currentObjectURL;

  if (imageCache[src]) {
    currentObjectURL = URL.createObjectURL(imageCache[src]);
    img.src = currentObjectURL;
  } else {
    var cacheBuster = "?t=" + Date.now();
    img.src = src + cacheBuster;
  }

  img.onload = function () {
    if (oldImg) {
      oldImg.classList.add("fade-out");
      setTimeout(function () {
        if (oldImg.parentNode === displayContent) {
          displayContent.removeChild(oldImg);
        }
        if (oldURL && oldURL !== currentObjectURL) {
          URL.revokeObjectURL(oldURL);
        }
      }, 300);
    }
  };

  displayContent.appendChild(img);
}

function getSubfolder(menuImg) {
  return menuImg.replace(/_a$/, "");
}

const A_BUTTON_DEFAULT_HREF =
  "https://github.com/CrankBoyHQ/crankboy-app/releases";

function updateAButtonHref() {
  // Show # link when in display mode or video is playing
  if (displayActive || videoPlaying) {
    buttonA.setAttribute("href", "#");
  } else {
    buttonA.setAttribute("href", A_BUTTON_DEFAULT_HREF);
  }
}

powerButton.addEventListener("click", function (e) {
  e.preventDefault();
  // Stop any playing video and reset combo when power button is pressed
  if (videoPlaying) {
    easterEggVideo.pause();
    easterEggVideo.currentTime = 0;
    videoContainer.classList.remove("active");
    videoPlaying = false;
    resetCombo();
    updateAButtonHref();
    return; // Return to main view, don't activate display mode
  }
  resetCombo();
  if (displayActive) {
    displayActive = false;
    inGame = false;
    displayContainer.classList.remove("active");
    clearTimeout(bootTimeout);
    displayContent.innerHTML = "";
    if (currentObjectURL) {
      URL.revokeObjectURL(currentObjectURL);
      currentObjectURL = null;
    }
  } else {
    displayActive = true;
    inGame = false;
    displayContainer.classList.add("active");
    // Start preloading display images only when user turns on display
    preloadDisplayImages();
    showImage("display/boot.webp");
    bootTimeout = setTimeout(function () {
      if (displayActive)
        showImage("display/menu/" + menuImages[currentImageIndex] + ".webp");
      bootTimeout = null;
    }, 1600);
  }
  updateAButtonHref();
});

menuButton.addEventListener("click", function (e) {
  e.preventDefault();
  if (!displayActive || bootTimeout || !inGame) return;
  inGame = false;
  showImage("display/menu/" + menuImages[currentImageIndex] + ".webp");
});

buttonUp.addEventListener("click", function (e) {
  e.preventDefault();
  checkCombo("up");
  if (!displayActive || bootTimeout || inGame) return;
  currentImageIndex =
    (currentImageIndex - 1 + menuImages.length) % menuImages.length;
  showImage("display/menu/" + menuImages[currentImageIndex] + ".webp");
  // Preload adjacent menu image
  const nextIndex =
    (currentImageIndex - 1 + menuImages.length) % menuImages.length;
  preloadImage("display/menu/" + menuImages[nextIndex] + ".webp");
});

buttonDown.addEventListener("click", function (e) {
  e.preventDefault();
  checkCombo("down");
  if (!displayActive || bootTimeout || inGame) return;
  currentImageIndex = (currentImageIndex + 1) % menuImages.length;
  showImage("display/menu/" + menuImages[currentImageIndex] + ".webp");
  // Preload adjacent menu image
  const nextIndex = (currentImageIndex + 1) % menuImages.length;
  preloadImage("display/menu/" + menuImages[nextIndex] + ".webp");
});

function nextGameImage() {
  const images = gameImages[menuImages[currentImageIndex]];
  if (!images || images.length === 0) return;
  currentGameImageIndex = (currentGameImageIndex + 1) % images.length;
  const folder = getSubfolder(menuImages[currentImageIndex]);
  const currentSrc = `display/${folder}/${images[currentGameImageIndex]}.webp`;
  showImage(currentSrc);
  // Preload next image for smoother navigation
  const nextIndex = (currentGameImageIndex + 1) % images.length;
  const nextSrc = `display/${folder}/${images[nextIndex]}.webp`;
  preloadImage(nextSrc);
}

function prevGameImage() {
  const images = gameImages[menuImages[currentImageIndex]];
  if (!images || images.length === 0) return;
  currentGameImageIndex =
    (currentGameImageIndex - 1 + images.length) % images.length;
  const folder = getSubfolder(menuImages[currentImageIndex]);
  const currentSrc = `display/${folder}/${images[currentGameImageIndex]}.webp`;
  showImage(currentSrc);
  // Preload previous image for smoother navigation
  const prevIndex = (currentGameImageIndex - 1 + images.length) % images.length;
  const prevSrc = `display/${folder}/${images[prevIndex]}.webp`;
  preloadImage(prevSrc);
}

buttonA.addEventListener("click", function (e) {
  if (!displayActive || bootTimeout) return;
  e.preventDefault();
  e.stopPropagation();

  if (!inGame) {
    const images = gameImages[menuImages[currentImageIndex]];
    if (images && images.length > 0) {
      inGame = true;
      currentGameImageIndex = 0;
      const folder = getSubfolder(menuImages[currentImageIndex]);
      showImage(`display/${folder}/${images[0]}.webp`);
    }
  } else {
    nextGameImage();
  }
});

buttonB.addEventListener("click", function (e) {
  e.preventDefault();
  checkCombo("b");
  if (!displayActive || bootTimeout || !inGame) return;
  prevGameImage();
});

buttonRight.addEventListener("click", function (e) {
  e.preventDefault();
  checkCombo("right");
  if (!displayActive || bootTimeout || !inGame) return;
  nextGameImage();
});

buttonLeft.addEventListener("click", function (e) {
  e.preventDefault();
  if (!displayActive || bootTimeout || !inGame) return;
  prevGameImage();
});

// Lazy load images only when needed - not on initial page load
function preloadImage(src) {
  if (imageCache[src]) return Promise.resolve();
  return fetch(src)
    .then(function (res) {
      return res.blob();
    })
    .then(function (blob) {
      imageCache[src] = blob;
    })
    .catch(function () {
      // Silent fail - will load normally on display
    });
}

// Preload boot and current menu image when display is turned on
function preloadDisplayImages() {
  const imagesToPreload = ["display/boot.webp"];
  const currentMenu = menuImages[currentImageIndex];
  imagesToPreload.push(`display/menu/${currentMenu}.webp`);

  imagesToPreload.forEach(preloadImage);
}

// Hide video container when easter egg video ends
easterEggVideo.addEventListener("ended", function () {
  videoContainer.classList.remove("active");
  videoPlaying = false;
  updateAButtonHref();
});
