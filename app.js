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
      // If Playdate is connected, do nothing (button disabled)
      if (playdateConnected) {
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
  "60_sf2": [
    "10_game_sf2",
    "20_game_sf2_a",
    "30_game_sf2",
    "40_game_sf2_a",
    "50_game_sf2",
    "60_game_sf2_a",
    "70_game_sf2",
    "80_game_sf2",
  ],
  "70_tp": [],
};

let currentImageIndex = 0;
let currentGameImageIndex = 0;
let displayActive = false;
let inGame = false;
let bootTimeout = null;
let videoPlaying = false;
let awaitingFolderSelection = false;
let playdateConnected = false;
let connectionPollInterval = null;
let showingOptionsView = false;
let awaitingSerialConnection = false;
const CONNECTION_POLL_INTERVAL = 3000; // Check every 3 seconds
const imageCache = {};
let currentObjectURL = null;

// Function to disconnect Playdate and reset UI
function disconnectPlaydate() {
  // Reset all connection states
  playdateConnected = false;
  awaitingFolderSelection = false;
  showingOptionsView = false;
  awaitingSerialConnection = false;
  transferContainer.classList.remove("active");

  // Stop polling
  if (connectionPollInterval) {
    clearInterval(connectionPollInterval);
    connectionPollInterval = null;
  }

  // Reset LED - remove all states
  if (ledIndicator) {
    ledIndicator.classList.remove(
      "active",
      "blinking",
      "transferring",
      "connected",
    );
  }

  // Hide all transfer views
  const optionsView = document.getElementById("transfer-options-view");
  const connectView = document.getElementById("transfer-connect-view");
  const instructionView = document.getElementById("transfer-instruction-view");
  const dropZone = document.getElementById("transfer-drop-zone");
  const managerBtn = document.getElementById("crankboy-manager-btn");
  const syncRomsBox = document.getElementById("sync-roms-box");
  const syncRomsText = document.getElementById("sync-roms-text");

  if (optionsView) {
    optionsView.classList.remove("active");
  }
  if (connectView) {
    connectView.classList.remove("active");
  }
  if (instructionView) {
    instructionView.classList.remove("active");
  }
  if (dropZone) {
    dropZone.style.display = "none";
  }
  if (managerBtn) {
    managerBtn.classList.remove("large-text");
  }
  if (syncRomsBox) {
    syncRomsBox.classList.remove("click-here");
  }
  if (syncRomsText) {
    syncRomsText.textContent = "Sync ROMs";
  }

  // Restart power button hint if display hasn't been activated
  if (!displayEverActivated && !powerButtonHintInterval) {
    startPowerButtonHint();
  }

  // Reset A button href back to default
  updateAButtonHref();
}

// LED control functions
function setLEDTransferring(isTransferring) {
  if (!ledIndicator) return;

  if (isTransferring) {
    ledIndicator.classList.add("transferring");
    ledIndicator.classList.remove("active", "blinking", "connected");
  } else {
    ledIndicator.classList.remove("transferring");
    // Return to solid blue when not transferring (but still connected)
    if (playdateConnected) {
      ledIndicator.classList.add("connected");
    }
  }
}

// Poll to check if Playdate is still connected
function startConnectionPolling() {
  // Clear any existing interval
  if (connectionPollInterval) {
    clearInterval(connectionPollInterval);
  }

  console.log("Starting connection polling...");

  connectionPollInterval = setInterval(async function () {
    if (!playdateConnected) {
      clearInterval(connectionPollInterval);
      connectionPollInterval = null;
      return;
    }

    // Try to access the folder handle to detect disconnection
    const folderHandle = window.PlaydateTransfer
      ? window.PlaydateTransfer.getCurrentFolderHandle()
      : null;
    if (!folderHandle) {
      console.log("No folder handle available, assuming disconnected");
      disconnectPlaydate();
      return;
    }

    try {
      // Actually try to access the directory contents - this will fail if device disconnected
      let entryCount = 0;
      for await (const entry of folderHandle.values()) {
        entryCount++;
        break; // Just check if we can access at least one entry
      }
      // If we get here, device is still connected
    } catch (error) {
      // If we can't access the folder, device is likely disconnected
      console.log(
        "Cannot access Playdate folder, device likely disconnected:",
        error.name,
        error.message,
      );
      disconnectPlaydate();
    }
  }, CONNECTION_POLL_INTERVAL);
}

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
let displayEverActivated = false;
let powerButtonHintInterval = null;

// Check if browser supports file transfer features (Chromium-based)
function isTransferSupported() {
  return "serial" in navigator && "showDirectoryPicker" in window;
}

// Sync ROMs box functionality
const syncRomsBox = document.getElementById("sync-roms-box");

function showSyncRomsBox() {
  if (syncRomsBox) {
    syncRomsBox.classList.add("visible");
  }
}

function hideSyncRomsBox() {
  if (syncRomsBox) {
    syncRomsBox.classList.remove("visible");
  }
}

// Show the box on page load if supported
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", showSyncRomsBox);
} else {
  showSyncRomsBox();
}

function startPowerButtonHint() {
  // Show hint every 2 seconds until display is activated
  powerButtonHintInterval = setInterval(function () {
    if (!displayEverActivated && !displayActive && !videoPlaying) {
      ledIndicator.classList.add("active", "blinking");
      setTimeout(function () {
        ledIndicator.classList.remove("active", "blinking");
      }, 1000);
    }
  }, 2000);
}

function stopPowerButtonHint() {
  if (powerButtonHintInterval) {
    clearInterval(powerButtonHintInterval);
    powerButtonHintInterval = null;
  }
  ledIndicator.classList.remove("active", "blinking");
}

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
  stopPowerButtonHint();
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
const ledIndicator = document.getElementById("led-indicator");
const videoContainer = document.getElementById("video-container");
const easterEggVideo = document.getElementById("easter-egg-video");
const transferContainer = document.getElementById("transfer-container");
const transferDropZone = document.getElementById("transfer-drop-zone");

function showImage(src) {
  // Find the currently visible image (the one that was most recently added)
  var oldImg = displayContent.querySelector("img[data-current]");
  var img = document.createElement("img");

  var oldURL = currentObjectURL;

  if (imageCache[src]) {
    currentObjectURL = URL.createObjectURL(imageCache[src]);
    img.src = currentObjectURL;
  } else {
    var cacheBuster = "?t=" + Date.now();
    img.src = src + cacheBuster;
  }

  // Mark this as the current image
  img.setAttribute("data-current", "true");

  img.onload = function () {
    if (oldImg) {
      // Remove current marker from old image and add fade-out
      oldImg.removeAttribute("data-current");
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
  // Show # link when in display mode, video is playing, or in WebUSB flow
  if (displayActive || videoPlaying || showingOptionsView || awaitingSerialConnection) {
    buttonA.setAttribute("href", "#");
  } else {
    buttonA.setAttribute("href", A_BUTTON_DEFAULT_HREF);
  }
}

function togglePower() {
  // Stop any playing video and reset combo when power button is pressed
  if (videoPlaying) {
    easterEggVideo.pause();
    easterEggVideo.currentTime = 0;
    videoContainer.classList.remove("active");
    videoPlaying = false;
    resetCombo();
    updateAButtonHref();
    // Restart hint if display hasn't been activated yet
    if (!displayEverActivated && !powerButtonHintInterval) {
      startPowerButtonHint();
    }
    return; // Return to main view, don't activate display mode
  }
  resetCombo();
  if (displayActive) {
    displayActive = false;
    inGame = false;
    displayContainer.classList.remove("active", "on");
    clearTimeout(bootTimeout);
    displayContent.innerHTML = "";
    if (currentObjectURL) {
      URL.revokeObjectURL(currentObjectURL);
      currentObjectURL = null;
    }
  } else {
    displayActive = true;
    displayEverActivated = true;
    inGame = false;
    awaitingFolderSelection = false;
    displayContainer.classList.add("active");
    stopPowerButtonHint();
    // Start preloading display images only when user turns on display
    preloadDisplayImages();
    showImage("display/boot.webp");
    // Start background fade 100ms after boot, finishes at 1400ms (200ms before boot ends)
    setTimeout(function () {
      if (displayActive) {
        displayContainer.classList.add("on");
      }
    }, 100);
    // Hide version 200ms before boot ends (at 1400ms)
    setTimeout(function () {
      if (displayActive && bootTimeout) {
        versionDisplay.classList.remove("visible");
      }
    }, 1400);
    bootTimeout = setTimeout(function () {
      if (displayActive) {
        showImage("display/menu/" + menuImages[currentImageIndex] + ".webp");
      }
      bootTimeout = null;
    }, 1600);
  }
  updateAButtonHref();
}

powerButton.addEventListener("click", function (e) {
  e.preventDefault();

  // If Playdate is connected or showing transfer views, disconnect/close instead of toggling display
  if (playdateConnected || showingOptionsView || awaitingSerialConnection) {
    disconnectPlaydate();
    return;
  }

  togglePower();
});

menuButton.addEventListener("click", function (e) {
  e.preventDefault();

  // In main view (display off), handle Playdate connection flow
  if (!displayActive && !videoPlaying) {
    // If showing options view, dismiss it (second press)
    if (showingOptionsView) {
      showingOptionsView = false;
      transferContainer.classList.remove("active");
      const optionsView = document.getElementById("transfer-options-view");
      const managerBtn = document.getElementById("crankboy-manager-btn");
      const syncRomsBox = document.getElementById("sync-roms-box");
      const syncRomsText = document.getElementById("sync-roms-text");
      if (optionsView) {
        optionsView.classList.remove("active");
      }
      // Remove large-text class if it was applied
      if (managerBtn) {
        managerBtn.classList.remove("large-text");
      }
      // Reset sync roms box
      if (syncRomsBox) {
        syncRomsBox.classList.remove("click-here");
      }
      if (syncRomsText) {
        syncRomsText.textContent = "Sync ROMs";
      }
      // Reset A button href back to default
      updateAButtonHref();
      return;
    }

    // If awaiting serial connection, start the actual connection (third press)
    if (awaitingSerialConnection) {
      // Start serial connection
      if (window.PlaydateSerial) {
        window.PlaydateSerial.enterDataDiskMode().then((success) => {
          if (success) {
            // Only hide connect view and proceed on successful connection
            awaitingSerialConnection = false;
            const connectView = document.getElementById("transfer-connect-view");
            if (connectView) {
              connectView.classList.remove("active");
            }

            // Reset A button href back to default
            updateAButtonHref();

            awaitingFolderSelection = true;
            playdateConnected = true;
            stopPowerButtonHint();
            // Turn on LED blue to show connection established
            if (ledIndicator) {
              ledIndicator.classList.add("connected");
            }
            // Hide and reset the sync ROMs box since user is now connected
            hideSyncRomsBox();
            const syncRomsBox = document.getElementById("sync-roms-box");
            const syncRomsText = document.getElementById("sync-roms-text");
            if (syncRomsBox) {
              syncRomsBox.classList.remove("click-here");
            }
            if (syncRomsText) {
              syncRomsText.textContent = "Sync ROMs";
            }
            // Show instruction view
            const instructionView = document.getElementById(
              "transfer-instruction-view",
            );
            if (instructionView) {
              instructionView.classList.add("active");
            }
          }
          // If not successful (user cancelled), keep connect view visible so they can try again
        });
      } else {
        console.error("PlaydateSerial module not loaded");
      }
      return;
    }

    // If already connected but no folder selected, open folder picker
    if (playdateConnected) {
      if (window.PlaydateTransfer) {
        // Force folder picker to show (don't use stored folder)
        window.PlaydateTransfer.setupPlaydateFolder(true).then((handle) => {
          if (handle) {
            awaitingFolderSelection = false;
            console.log("Playdate folder selected successfully");
            // Turn on LED solid blue to show ready for transfer
            if (ledIndicator) {
              ledIndicator.classList.add("connected");
              ledIndicator.classList.remove("blinking", "transferring");
            }
            // Hide instruction view and show drop zone
            const instructionView = document.getElementById(
              "transfer-instruction-view",
            );
            const dropZone = document.getElementById("transfer-drop-zone");
            if (instructionView) {
              instructionView.classList.remove("active");
            }
            if (dropZone) {
              dropZone.style.display = "flex";
            }
            // Start polling only after folder is selected
            startConnectionPolling();
          }
        });
      } else {
        console.error("PlaydateTransfer module not loaded");
      }
      return;
    }

    // First press: show options view
    showingOptionsView = true;
    transferContainer.classList.add("active");
    hideSyncRomsBox();
    stopPowerButtonHint();

    const optionsView = document.getElementById("transfer-options-view");
    const connectView = document.getElementById("transfer-connect-view");
    const instructionView = document.getElementById("transfer-instruction-view");
    const dropZone = document.getElementById("transfer-drop-zone");
    const webbrowserBtn = document.getElementById("webbrowser-btn");
    const optionsTitle = document.getElementById("options-title");
    const optionsBadge = document.getElementById("options-badge");
    const managerBtn = document.getElementById("crankboy-manager-btn");

    // Hide all other views first
    if (connectView) {
      connectView.classList.remove("active");
    }
    if (instructionView) {
      instructionView.classList.remove("active");
    }
    if (dropZone) {
      dropZone.style.display = "none";
    }

    if (optionsView) {
      optionsView.classList.add("active");
    }

    // On non-Chromium browsers, only show CrankBoy Manager option (no title, no badge)
    if (isTransferSupported()) {
      // Chromium browser - show all options with smaller text
      if (webbrowserBtn) {
        webbrowserBtn.classList.remove("hidden");
      }
      if (optionsTitle) {
        optionsTitle.style.display = "";
      }
      if (optionsBadge) {
        optionsBadge.style.display = "";
      }
      if (managerBtn) {
        managerBtn.classList.remove("large-text");
      }
    } else {
      // Non-Chromium browser - hide webbrowser option, title, and badge, use larger text
      if (webbrowserBtn) {
        webbrowserBtn.classList.add("hidden");
      }
      if (optionsTitle) {
        optionsTitle.style.display = "none";
      }
      if (optionsBadge) {
        optionsBadge.style.display = "none";
      }
      if (managerBtn) {
        managerBtn.classList.add("large-text");
      }
    }

    // Update A button href to point to CrankBoy Manager
    updateAButtonHref();

    return;
  }

  // Reset folder selection state and hide transfer container when entering display mode
  disconnectPlaydate();

  // In display mode, exit game back to menu
  if (!displayActive || bootTimeout || !inGame) return;
  inGame = false;
  showImage("display/menu/" + menuImages[currentImageIndex] + ".webp");
});

// Handle "Use your Webbrowser" button click
const webbrowserBtn = document.getElementById("webbrowser-btn");
if (webbrowserBtn) {
  webbrowserBtn.addEventListener("click", function (e) {
    e.preventDefault();

    // Hide options view
    const optionsView = document.getElementById("transfer-options-view");
    if (optionsView) {
      optionsView.classList.remove("active");
    }

    // Show intermediate "Please connect your Playdate" step
    showingOptionsView = false;
    awaitingSerialConnection = true;

    const connectView = document.getElementById("transfer-connect-view");
    if (connectView) {
      connectView.classList.add("active");
    }

    // Update sync roms box to "Click here" mode
    const syncRomsBox = document.getElementById("sync-roms-box");
    const syncRomsText = document.getElementById("sync-roms-text");
    if (syncRomsBox) {
      syncRomsBox.classList.add("click-here");
      syncRomsBox.classList.add("visible");
    }
    if (syncRomsText) {
      syncRomsText.textContent = "Click here";
    }

    // Update A button href (still points to Manager in connect view)
    updateAButtonHref();
  });
}

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
  // Restart hint if display hasn't been activated yet
  if (!displayEverActivated && !powerButtonHintInterval) {
    startPowerButtonHint();
  }
});

// Start power button hint animation
startPowerButtonHint();

// Defer load version JSON and display version number
const versionDisplay = document.getElementById("version-display");

function updateVersionDisplay() {
  // Show version on main view and during boot animation, hide during menu/game and video
  if (videoPlaying) {
    versionDisplay.classList.remove("visible");
  } else if (displayActive && bootTimeout) {
    // Show during boot animation
    versionDisplay.classList.add("visible");
  } else if (displayActive) {
    // Hide when display is on but boot is complete (menu/game mode)
    versionDisplay.classList.remove("visible");
  } else {
    // Show on main view
    versionDisplay.classList.add("visible");
  }
}

// Fetch version JSON
try {
  fetch(
    "https://raw.githubusercontent.com/CrankBoyHQ/crankboy-app/refs/heads/master/Source/version.json",
  )
    .then(function (res) {
      if (!res.ok) throw new Error("Failed to load version");
      return res.json();
    })
    .then(function (data) {
      if (data.name) {
        versionDisplay.textContent = data.name;
        updateVersionDisplay();
      }
    })
    .catch(function () {
      // Silent fail - version won't be displayed
    });
} catch (e) {
  // Silent fail
}

// Update version visibility when display or video state changes
const originalUpdateAButtonHref = updateAButtonHref;
updateAButtonHref = function () {
  originalUpdateAButtonHref();
  updateVersionDisplay();
};

// Keyboard controls
// Arrow keys = D-pad, A = B button, S = A button

function triggerButtonActive(button) {
  button.classList.add("keyboard-active");
  setTimeout(function () {
    button.classList.remove("keyboard-active");
  }, 150);
}

document.addEventListener("keydown", function (e) {
  // Prevent default scrolling for arrow keys and game buttons
  if (
    [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "a",
      "s",
      "A",
      "S",
      "Escape",
      " ",
      "p",
      "P",
    ].includes(e.key)
  ) {
    e.preventDefault();
  }

  switch (e.key) {
    case " ":
    case "p":
    case "P":
      triggerButtonActive(powerButton);
      togglePower();
      break;
    case "Escape":
      triggerButtonActive(menuButton);
      if (displayActive && !bootTimeout && inGame) {
        inGame = false;
        showImage("display/menu/" + menuImages[currentImageIndex] + ".webp");
      }
      break;
    case "ArrowUp":
      triggerButtonActive(buttonUp);
      if (displayActive && !bootTimeout && !inGame) {
        currentImageIndex =
          (currentImageIndex - 1 + menuImages.length) % menuImages.length;
        showImage("display/menu/" + menuImages[currentImageIndex] + ".webp");
        const nextIndex =
          (currentImageIndex - 1 + menuImages.length) % menuImages.length;
        preloadImage("display/menu/" + menuImages[nextIndex] + ".webp");
      }
      checkCombo("up");
      break;
    case "ArrowDown":
      triggerButtonActive(buttonDown);
      if (displayActive && !bootTimeout && !inGame) {
        currentImageIndex = (currentImageIndex + 1) % menuImages.length;
        showImage("display/menu/" + menuImages[currentImageIndex] + ".webp");
        const nextIndex = (currentImageIndex + 1) % menuImages.length;
        preloadImage("display/menu/" + menuImages[nextIndex] + ".webp");
      }
      checkCombo("down");
      break;
    case "ArrowLeft":
      triggerButtonActive(buttonLeft);
      if (displayActive && !bootTimeout && inGame) {
        prevGameImage();
      }
      break;
    case "ArrowRight":
      triggerButtonActive(buttonRight);
      if (displayActive && !bootTimeout && inGame) {
        nextGameImage();
      }
      checkCombo("right");
      break;
    case "a":
    case "A":
      triggerButtonActive(buttonB);
      // B button - previous game image in game mode, also part of combo
      checkCombo("b");
      if (displayActive && !bootTimeout && inGame) {
        prevGameImage();
      }
      break;
    case "s":
    case "S":
      triggerButtonActive(buttonA);
      // A button - enter game or next image
      if (displayActive && !bootTimeout) {
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
      }
      break;
  }
});

// Transfer container drag and drop handlers
if (transferDropZone) {
  transferDropZone.addEventListener("dragover", function (e) {
    e.preventDefault();
    e.stopPropagation();
    transferDropZone.classList.add("drag-over");
  });

  transferDropZone.addEventListener("dragleave", function (e) {
    e.preventDefault();
    e.stopPropagation();
    transferDropZone.classList.remove("drag-over");
  });

  transferDropZone.addEventListener("drop", function (e) {
    e.preventDefault();
    e.stopPropagation();
    transferDropZone.classList.remove("drag-over");

    if (!playdateConnected) {
      console.log("No Playdate connection, ignoring drop");
      return;
    }

    const files = e.dataTransfer.files;
    console.log("Dropped", files.length, "file(s)");

    // Log dropped files for now (actual transfer not implemented yet)
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log("File:", file.name, "Type:", file.type, "Size:", file.size);
    }

    // Transfer files to Playdate
    if (window.PlaydateTransfer) {
      const totalFiles = files.length;
      const transferProgressView = document.getElementById(
        "transfer-progress-view",
      );
      const transferDropZone = document.getElementById("transfer-drop-zone");
      const transferStatusText = document.getElementById(
        "transfer-status-text",
      );

      // Show progress view, hide drop zone
      if (transferProgressView && transferDropZone) {
        transferDropZone.style.display = "none";
        transferProgressView.classList.add("active");
      }

      // Start LED flickering to indicate transfer
      setLEDTransferring(true);

      // Progress callback to update UI
      const onProgress = (current, total, fileName) => {
        if (transferStatusText) {
          transferStatusText.textContent = `Transferring ${current} of ${total} file${total !== 1 ? "s" : ""}`;
        }
        console.log(`Transferring ${current}/${total}: ${fileName}`);
      };

      window.PlaydateTransfer.transferFiles(files, onProgress)
        .then((result) => {
          // Stop LED flickering when transfer completes
          setLEDTransferring(false);

          if (result.failed === 0) {
            console.log(
              `✅ All ${result.success} file(s) transferred successfully!`,
            );
          } else if (result.success === 0) {
            console.log(`❌ All ${result.failed} file(s) failed to transfer`);
          } else {
            console.log(
              `⚠️ ${result.success} succeeded, ${result.failed} failed`,
            );
          }

          // Show "Transfer finished" for 1 second
          if (transferStatusText) {
            transferStatusText.textContent = "Transfer finished";
          }

          setTimeout(() => {
            // Return to drop zone view
            if (transferProgressView && transferDropZone) {
              transferProgressView.classList.remove("active");
              transferDropZone.style.display = "flex";
            }
          }, 1000);
        })
        .catch((error) => {
          // Stop LED flickering on error
          setLEDTransferring(false);
          console.error("Transfer error:", error);

          // Show error and return to drop zone
          if (transferStatusText) {
            transferStatusText.textContent = "Transfer failed";
          }

          setTimeout(() => {
            if (transferProgressView && transferDropZone) {
              transferProgressView.classList.remove("active");
              transferDropZone.style.display = "flex";
            }
          }, 1000);
        });
    } else {
      console.error("PlaydateTransfer module not loaded");
    }
  });

  // File select button handler
  const selectBtn = document.getElementById("transfer-select-btn");
  const fileInput = document.getElementById("transfer-file-input");

  if (selectBtn && fileInput) {
    selectBtn.addEventListener("click", function (e) {
      e.preventDefault();
      if (playdateConnected) {
        fileInput.click();
      } else {
        console.log("No Playdate connection, cannot select files");
      }
    });

    fileInput.addEventListener("change", function (e) {
      const files = e.target.files;
      if (files.length === 0) return;

      console.log("Selected", files.length, "file(s)");

      // Transfer files to Playdate
      if (window.PlaydateTransfer) {
        const totalFiles = files.length;
        const transferProgressView = document.getElementById(
          "transfer-progress-view",
        );
        const transferDropZone = document.getElementById("transfer-drop-zone");
        const transferStatusText = document.getElementById(
          "transfer-status-text",
        );

        // Show progress view, hide drop zone
        if (transferProgressView && transferDropZone) {
          transferDropZone.style.display = "none";
          transferProgressView.classList.add("active");
        }

        // Start LED flickering to indicate transfer
        setLEDTransferring(true);

        // Progress callback to update UI
        const onProgress = (current, total, fileName) => {
          if (transferStatusText) {
            transferStatusText.textContent = `Transferring ${current} of ${total} file${total !== 1 ? "s" : ""}`;
          }
          console.log(`Transferring ${current}/${total}: ${fileName}`);
        };

        window.PlaydateTransfer.transferFiles(files, onProgress)
          .then((result) => {
            // Stop LED flickering when transfer completes
            setLEDTransferring(false);

            if (result.failed === 0) {
              console.log(
                `✅ All ${result.success} file(s) transferred successfully!`,
              );
            } else if (result.success === 0) {
              console.log(`❌ All ${result.failed} file(s) failed to transfer`);
            } else {
              console.log(
                `⚠️ ${result.success} succeeded, ${result.failed} failed`,
              );
            }

            // Show "Transfer finished" for 1 second
            if (transferStatusText) {
              transferStatusText.textContent = "Transfer finished";
            }

            setTimeout(() => {
              // Return to drop zone view
              if (transferProgressView && transferDropZone) {
                transferProgressView.classList.remove("active");
                transferDropZone.style.display = "flex";
              }
              // Reset file input
              fileInput.value = "";
            }, 1000);
          })
          .catch((error) => {
            // Stop LED flickering on error
            setLEDTransferring(false);
            console.error("Transfer error:", error);

            // Show error and return to drop zone
            if (transferStatusText) {
              transferStatusText.textContent = "Transfer failed";
            }

            setTimeout(() => {
              if (transferProgressView && transferDropZone) {
                transferProgressView.classList.remove("active");
                transferDropZone.style.display = "flex";
              }
              // Reset file input
              fileInput.value = "";
            }, 1000);
          });
      } else {
        console.error("PlaydateTransfer module not loaded");
      }
    });
  }
}
