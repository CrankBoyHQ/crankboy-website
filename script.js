document
  .querySelectorAll(".download-btn-overlay, .button-a")
  .forEach((btn) => {
    btn.addEventListener("click", function (e) {
      const downloadBtn = document.querySelector(".download-btn-overlay");
      downloadBtn.querySelector(".btn-text").style.display = "none";
      downloadBtn.querySelector(".btn-loading").style.display = "inline";
    });
  });

// Reset button text when returning via back button or switching apps
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
