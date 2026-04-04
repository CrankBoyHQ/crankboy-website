// Playdate File Transfer Module
// Handles folder selection and persistence via File System Access API

(function (global) {
  "use strict";

  // IndexedDB configuration
  const DB_NAME = "PlaydateTransferDB";
  const DB_VERSION = 1;
  const STORE_NAME = "folderHandles";
  const FOLDER_KEY = "playdateRoot";

  let db = null;
  let currentFolderHandle = null;

  /**
   * Initialize IndexedDB
   * @returns {Promise<IDBDatabase>}
   */
  function initDB() {
    return new Promise((resolve, reject) => {
      if (db) {
        resolve(db);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("Failed to open IndexedDB:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        db = request.result;
        console.log("IndexedDB initialized successfully");
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const database = event.target.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME);
          console.log("Created object store:", STORE_NAME);
        }
      };
    });
  }

  /**
   * Save folder handle to IndexedDB
   * @param {FileSystemDirectoryHandle} handle
   * @returns {Promise<boolean>}
   */
  async function saveFolderHandle(handle) {
    try {
      await initDB();
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.put(handle, FOLDER_KEY);

        request.onsuccess = () => {
          console.log("Folder handle saved to IndexedDB");
          resolve(true);
        };

        request.onerror = () => {
          console.error("Failed to save folder handle:", request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("Error saving folder handle:", error);
      return false;
    }
  }

  /**
   * Retrieve folder handle from IndexedDB
   * @returns {Promise<FileSystemDirectoryHandle|null>}
   */
  async function getStoredFolderHandle() {
    try {
      await initDB();
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.get(FOLDER_KEY);

        request.onsuccess = () => {
          if (request.result) {
            console.log("Retrieved stored folder handle from IndexedDB");
            resolve(request.result);
          } else {
            console.log("No stored folder handle found");
            resolve(null);
          }
        };

        request.onerror = () => {
          console.error("Failed to retrieve folder handle:", request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("Error retrieving folder handle:", error);
      return null;
    }
  }

  /**
   * Request permission for a stored folder handle
   * @param {FileSystemDirectoryHandle} handle
   * @returns {Promise<boolean>}
   */
  async function requestFolderPermission(handle) {
    try {
      const options = { mode: "readwrite" };
      const status = await handle.queryPermission(options);

      if (status === "granted") {
        console.log("Folder permission already granted");
        return true;
      }

      console.log("Requesting folder permission...");
      const newStatus = await handle.requestPermission(options);

      if (newStatus === "granted") {
        console.log("Folder permission granted");
        return true;
      } else {
        console.log("Folder permission denied");
        return false;
      }
    } catch (error) {
      console.error("Error requesting folder permission:", error);
      return false;
    }
  }

  /**
   * Show directory picker and let user select Playdate root folder
   * Validates that the selected folder is the root (contains expected Playdate folders)
   * @param {number} retryCount - Number of retry attempts (internal use)
   * @returns {Promise<FileSystemDirectoryHandle|null>}
   */
  async function selectPlaydateFolder(retryCount = 0) {
    const MAX_RETRIES = 3;

    try {
      console.log("Opening directory picker for Playdate root folder...");

      const handle = await window.showDirectoryPicker();
      console.log("Folder selected:", handle.name);

      // Validate that this is the Playdate root folder
      // A real Playdate should have at least one of these folders
      const expectedFolders = ["Games", "System", "Data", "Shared"];
      let foundFolders = [];

      for await (const entry of handle.values()) {
        if (
          entry.kind === "directory" &&
          expectedFolders.includes(entry.name)
        ) {
          foundFolders.push(entry.name);
        }
      }

      if (foundFolders.length > 0) {
        console.log("Found expected Playdate folders:", foundFolders);
        return handle;
      } else {
        console.warn(
          "No expected Playdate folders found. This might not be a Playdate drive.",
        );

        if (retryCount < MAX_RETRIES) {
          // eslint-disable-next-line no-alert
          alert(
            "Please select the Playdate ROOT folder (containing Games, System, Data, or Shared), not a subfolder.",
          );
          console.log(
            `Re-prompting for folder selection (attempt ${retryCount + 1} of ${MAX_RETRIES})...`,
          );
          return selectPlaydateFolder(retryCount + 1);
        } else {
          console.error(
            `Max retries (${MAX_RETRIES}) reached. Folder selection cancelled.`,
          );
          // eslint-disable-next-line no-alert
          alert(
            "Folder selection cancelled. Please select the Playdate root folder.",
          );
          return null;
        }
      }
    } catch (error) {
      if (error.name === "AbortError") {
        console.log("Folder selection cancelled by user");
      } else {
        console.error("Error selecting folder:", error);
      }
      return null;
    }
  }

  /**
   * Main function to setup Playdate folder
   * Tries to use stored handle first, then prompts for selection
   * @param {boolean} forceReselect - If true, always show folder picker (ignore stored handle)
   * @returns {Promise<FileSystemDirectoryHandle|null>}
   */
  async function setupPlaydateFolder(forceReselect = false) {
    console.log("Setting up Playdate folder...");

    // Check if File System Access API is supported
    if (!("showDirectoryPicker" in window)) {
      console.error("File System Access API not supported in this browser");
      return null;
    }

    // Try to get stored handle first (unless forceReselect is true)
    if (!forceReselect) {
      const storedHandle = await getStoredFolderHandle();

      if (storedHandle) {
        console.log("Found stored folder handle, checking permissions...");
        const hasPermission = await requestFolderPermission(storedHandle);

        if (hasPermission) {
          console.log("Using stored folder handle:", storedHandle.name);
          currentFolderHandle = storedHandle;
          return storedHandle;
        } else {
          console.log(
            "Permission denied for stored handle, will request new selection",
          );
        }
      }
    } else {
      console.log("Force reselect requested, skipping stored folder check");
    }

    // No stored handle or permission denied, request new selection
    const newHandle = await selectPlaydateFolder();

    if (newHandle) {
      // Save the new handle for future sessions
      const saved = await saveFolderHandle(newHandle);
      if (saved) {
        console.log("New folder handle saved successfully");
      } else {
        console.warn(
          "Failed to save folder handle, but it will work for this session",
        );
      }
      currentFolderHandle = newHandle;
      return newHandle;
    }

    console.log("No folder selected");
    return null;
  }

  /**
   * Get the current folder handle (if set)
   * @returns {FileSystemDirectoryHandle|null}
   */
  function getCurrentFolderHandle() {
    return currentFolderHandle;
  }

  /**
   * Clear the stored folder handle
   * @returns {Promise<boolean>}
   */
  async function clearStoredFolder() {
    try {
      await initDB();
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.delete(FOLDER_KEY);

        request.onsuccess = () => {
          console.log("Stored folder handle cleared");
          currentFolderHandle = null;
          resolve(true);
        };

        request.onerror = () => {
          console.error("Failed to clear folder handle:", request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("Error clearing folder handle:", error);
      return false;
    }
  }

  /**
   * Determine destination folder based on file extension
   * @param {string} filename
   * @returns {string|null} The destination folder path or null if not supported
   */
  function getDestinationFolder(filename) {
    const lowerName = filename.toLowerCase();
    const ext = lowerName.substring(lowerName.lastIndexOf(".") + 1);

    // ROM files -> /Shared/Emulation/gb/games
    const romExtensions = ["gb", "gbc", "gbz"];
    if (romExtensions.includes(ext)) {
      return "games";
    }

    // Cover files -> /Shared/Emulation/gb/covers
    const coverExtensions = ["pdi", "png", "jpg", "jpeg", "gif"];
    if (coverExtensions.includes(ext)) {
      return "covers";
    }

    return null;
  }

  /**
   * Navigate to target directory, creating folders if needed
   * @param {FileSystemDirectoryHandle} rootHandle
   * @param {string} targetFolder - 'games' or 'covers'
   * @returns {Promise<FileSystemDirectoryHandle|null>}
   */
  async function navigateToTargetFolder(rootHandle, targetFolder) {
    try {
      const path = ["Shared", "Emulation", "gb", targetFolder];
      let currentHandle = rootHandle;

      for (const folderName of path) {
        try {
          currentHandle = await currentHandle.getDirectoryHandle(folderName, {
            create: true,
          });
        } catch (error) {
          console.error(
            `Failed to access/create folder "${folderName}":`,
            error,
          );
          return null;
        }
      }

      return currentHandle;
    } catch (error) {
      console.error("Error navigating to target folder:", error);
      return null;
    }
  }

  /**
   * Write a file to the Playdate
   * @param {File} file - The File object to write
   * @param {FileSystemDirectoryHandle} targetFolderHandle
   * @returns {Promise<boolean>}
   */
  async function writeFile(file, targetFolderHandle) {
    try {
      const fileHandle = await targetFolderHandle.getFileHandle(file.name, {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(file);
      await writable.close();
      return true;
    } catch (error) {
      console.error(`Failed to write file "${file.name}":`, error);
      return false;
    }
  }

  /**
   * Transfer a single file to the Playdate
   * @param {File} file
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async function transferFile(file) {
    if (!currentFolderHandle) {
      return { success: false, message: "No Playdate folder selected" };
    }

    const targetFolder = getDestinationFolder(file.name);
    if (!targetFolder) {
      return { success: false, message: `Unsupported file type: ${file.name}` };
    }

    console.log(
      `Transferring "${file.name}" to /Shared/Emulation/gb/${targetFolder}/`,
    );

    const targetFolderHandle = await navigateToTargetFolder(
      currentFolderHandle,
      targetFolder,
    );
    if (!targetFolderHandle) {
      return {
        success: false,
        message: `Failed to access target folder for "${file.name}"`,
      };
    }

    const success = await writeFile(file, targetFolderHandle);
    if (success) {
      return {
        success: true,
        message: `Transferred "${file.name}" to ${targetFolder}/`,
      };
    } else {
      return { success: false, message: `Failed to write "${file.name}"` };
    }
  }

  /**
   * Transfer multiple files to the Playdate
   * @param {FileList} files
   * @param {Function} onProgress - Callback for progress updates (currentIndex, totalFiles, fileName)
   * @returns {Promise<{success: number, failed: number, results: Array}>}
   */
  async function transferFiles(files, onProgress) {
    if (!currentFolderHandle) {
      console.error(
        "No Playdate folder selected. Please select the Playdate drive first.",
      );
      return { success: 0, failed: files.length, results: [] };
    }

    const results = [];
    let successCount = 0;
    let failedCount = 0;
    const totalFiles = files.length;

    console.log(`Starting transfer of ${totalFiles} file(s)...`);

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];

      // Call progress callback if provided
      if (onProgress) {
        onProgress(i + 1, totalFiles, file.name);
      }

      const result = await transferFile(file);
      results.push(result);

      if (result.success) {
        successCount++;
        console.log("✅", result.message);
      } else {
        failedCount++;
        console.log("❌", result.message);
      }
    }

    console.log(
      `Transfer complete: ${successCount} succeeded, ${failedCount} failed`,
    );
    return { success: successCount, failed: failedCount, results };
  }

  // Initialize DB on load
  initDB().catch((error) => {
    console.error("Failed to initialize IndexedDB on load:", error);
  });

  // Expose functions globally
  global.PlaydateTransfer = {
    setupPlaydateFolder,
    getCurrentFolderHandle,
    clearStoredFolder,
    transferFile,
    transferFiles,
  };
})(window);
